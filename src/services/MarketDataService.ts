import { applyTicks, mergeSnapshot, type Tick } from '@/domain/quote';
import type { OhlcSnapshot } from '@/data/ohlcApi';
import { normalizeTick } from '@/feed/normalizeTick';
import type { FeedConnectionState, PriceFeed, Unsubscribe, WireTick } from '@/feed/types';
import type { MarketState, MarketStore, StreamStatus } from '@/state/marketStore';

export interface MarketDataServiceOptions {
  readonly feed: PriceFeed;
  readonly store: MarketStore;
  readonly fetchSnapshot: (symbols: readonly string[]) => Promise<OhlcSnapshot>;
  /** Every symbol the app needs prices for (universe ∪ holdings). */
  readonly symbols: () => readonly string[];
  /** Called after each snapshot is applied; the composition root re-seeds the simulator here. */
  readonly onSnapshot?: (snapshot: OhlcSnapshot) => void;
  /** Coalesces ticks; defaults to requestAnimationFrame so we commit at most once per frame. */
  readonly scheduleFlush?: (flush: () => void) => void;
  readonly now?: () => number;
  readonly random?: () => number;
  /** No tick for this long while connected = "prices paused". */
  readonly staleAfterMs?: number;
  readonly watchdogIntervalMs?: number;
  readonly reconnectDelaysMs?: readonly number[];
  /** Minimum gap between catch-up REST fetches after a reconnect. */
  readonly catchUpMinIntervalMs?: number;
}

export interface MarketDataStats {
  received: number;
  applied: number;
  stale: number;
  malformed: number;
  flushes: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong while loading prices';
}

/**
 * Owns the live data pipeline: REST snapshot → store, feed ticks → store.
 *
 *   feed.onTick → normalize (rupees → paise, validate) → pending buffer
 *     → one flush per frame → applyTicks (drops stale seq) → store.setState
 *
 * UI code never talks to the feed; it reads the store. That is what makes the
 * simulator swappable for a real socket and keeps re-renders scoped to the
 * symbols that changed.
 */
export class MarketDataService {
  private readonly feed: PriceFeed;
  private readonly store: MarketStore;
  private readonly options: MarketDataServiceOptions;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly staleAfterMs: number;
  private readonly reconnectDelaysMs: readonly number[];

  private started = false;
  private unsubscribers: Unsubscribe[] = [];
  private pending: Tick[] = [];
  private flushScheduled = false;
  private feedState: FeedConnectionState = 'closed';
  private wantConnected = false;
  private openedAt = 0;
  private lastTickAt: number | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private droppedUnexpectedly = false;
  private lastCatchUpAt = 0;
  private inFlight: Promise<boolean> | null = null;

  readonly stats: MarketDataStats = { received: 0, applied: 0, stale: 0, malformed: 0, flushes: 0 };

  constructor(options: MarketDataServiceOptions) {
    this.options = options;
    this.feed = options.feed;
    this.store = options.store;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.staleAfterMs = options.staleAfterMs ?? 1_500;
    this.reconnectDelaysMs = options.reconnectDelaysMs ?? [1_000, 2_000, 4_000, 8_000, 15_000];
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /** Idempotent: safe under Fast Refresh and double effects. Fetches only if we have no data yet. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.unsubscribers = [this.feed.onTick(this.handleTick), this.feed.onStateChange(this.handleFeedState)];
    this.watchdogTimer = setInterval(this.checkStaleness, this.options.watchdogIntervalMs ?? 250);
    if (this.store.getState().load.status === 'ready') this.connectFeed();
    else void this.load();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.wantConnected = false;
    this.clearReconnect();
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = null;
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers = [];
    this.feed.disconnect();
    this.feedState = 'closed'; // our state handler is already unsubscribed
    this.flush();
  }

  /** App went to the background: stop streaming. */
  pause(): void {
    this.wantConnected = false;
    this.clearReconnect();
    this.feed.disconnect();
    this.flush();
  }

  /** App is back in the foreground. */
  resume(): void {
    if (this.store.getState().load.status === 'ready') this.connectFeed();
  }

  // ── REST snapshot ──────────────────────────────────────────────────────

  /** Initial load, and "Retry" from the error state. */
  async load(): Promise<void> {
    const { load } = this.store.getState();
    if (load.status !== 'ready') this.patch({ load: { ...load, status: 'loading', error: null } });
    const ok = await this.fetchAndApply();
    if (!ok) return;
    this.connectFeed();
  }

  /** Pull to refresh. Keeps the current prices if the request fails. */
  async refresh(): Promise<void> {
    if (this.store.getState().load.status !== 'ready') return this.load();
    this.patch({ refresh: { inFlight: true, error: null } });
    await this.fetchAndApply();
    this.connectFeed();
  }

  private fetchAndApply(): Promise<boolean> {
    // Collapse concurrent callers onto one request: the API is a shared test server.
    this.inFlight ??= this.doFetch().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async doFetch(): Promise<boolean> {
    try {
      const snapshot = await this.options.fetchSnapshot(this.options.symbols());
      this.flush(); // ticks generated before the snapshot must not overwrite it
      const state = this.store.getState();
      this.patch({
        quotes: mergeSnapshot(state.quotes, snapshot.quotes),
        missing: snapshot.missing,
        load: { status: 'ready', error: null, fetchedAt: snapshot.fetchedAt },
        refresh: { inFlight: false, error: null },
      });
      this.options.onSnapshot?.(snapshot);
      this.feed.subscribe(snapshot.quotes.map((q) => q.symbol));
      return true;
    } catch (error) {
      const message = errorMessage(error);
      const state = this.store.getState();
      if (state.load.status === 'ready') {
        this.patch({ refresh: { inFlight: false, error: message } });
      } else {
        this.patch({ load: { ...state.load, status: 'error', error: message }, refresh: { inFlight: false, error: null } });
      }
      return false;
    }
  }

  // ── Feed ───────────────────────────────────────────────────────────────

  private connectFeed(): void {
    this.wantConnected = true;
    if (this.feedState === 'closed' && !this.reconnectTimer) this.feed.connect();
  }

  private readonly handleTick = (wire: WireTick): void => {
    this.stats.received += 1;
    const tick = normalizeTick(wire);
    if (!tick) {
      this.stats.malformed += 1;
      return;
    }
    this.lastTickAt = this.now();
    this.pending.push(tick);
    // Leave "paused" on the first tick back rather than waiting for the watchdog.
    if (this.store.getState().stream.status !== 'live') this.setStream('live');
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      (this.options.scheduleFlush ?? requestAnimationFrame)(this.flush);
    }
  };

  /** Applies every buffered tick in one store update, in arrival order. */
  private readonly flush = (): void => {
    this.flushScheduled = false;
    if (this.pending.length === 0) return;
    const ticks = this.pending;
    this.pending = [];
    const { quotes } = this.store.getState();
    const result = applyTicks(quotes, ticks, this.now());
    this.stats.applied += result.applied;
    this.stats.stale += result.stale;
    this.stats.flushes += 1;
    if (result.quotes !== quotes) this.store.setState({ quotes: result.quotes });
  };

  private readonly handleFeedState = (state: FeedConnectionState): void => {
    this.feedState = state;
    if (state === 'open') {
      this.openedAt = this.now();
      this.reconnectAttempt = 0;
      this.setStream(this.store.getState().stream.status === 'live' ? 'live' : 'connecting');
      if (this.droppedUnexpectedly) {
        this.droppedUnexpectedly = false;
        this.catchUp();
      }
    } else if (state === 'connecting') {
      if (this.store.getState().stream.status !== 'reconnecting') this.setStream('connecting');
    } else if (this.wantConnected) {
      // Closed without us asking: the network dropped or the server went away.
      this.droppedUnexpectedly = true;
      this.scheduleReconnect();
    } else {
      this.setStream('offline');
    }
  };

  private scheduleReconnect(): void {
    this.clearReconnect();
    const base = this.reconnectDelaysMs[Math.min(this.reconnectAttempt, this.reconnectDelaysMs.length - 1)] ?? 1_000;
    const delay = Math.round(base * (0.8 + this.random() * 0.4)); // jitter avoids reconnect stampedes
    this.reconnectAttempt += 1;
    this.setStream('reconnecting', this.now() + delay);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.wantConnected) this.feed.connect();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  /** After a drop, ticks were missed; one REST fetch brings every symbol up to date. */
  private catchUp(): void {
    const now = this.now();
    if (now - this.lastCatchUpAt < (this.options.catchUpMinIntervalMs ?? 30_000)) return;
    this.lastCatchUpAt = now;
    void this.fetchAndApply();
  }

  private readonly checkStaleness = (): void => {
    if (this.feedState !== 'open') return;
    const lastActivity = Math.max(this.lastTickAt ?? 0, this.openedAt);
    const current = this.store.getState().stream.status;
    if (this.now() - lastActivity > this.staleAfterMs) {
      if (current !== 'paused') this.setStream('paused');
    }
  };

  // ── Store helpers ──────────────────────────────────────────────────────

  private setStream(status: StreamStatus, retryAt: number | null = null): void {
    const { stream } = this.store.getState();
    if (stream.status === status && stream.retryAt === retryAt) return;
    this.patch({ stream: { status, retryAt, lastTickAt: this.lastTickAt } });
  }

  private patch(partial: Partial<MarketState>): void {
    this.store.setState(partial);
  }
}
