import { randomBetween } from './random';
import type { FeedConnectionState, PriceFeed, Unsubscribe, WireTick } from './types';

/** Starting point for one simulated instrument, in paise (taken from the REST snapshot). */
export interface SimulatorSeed {
  readonly symbol: string;
  readonly ltpPaise: number;
  readonly highPaise: number | null;
  readonly lowPaise: number | null;
  readonly volume: number | null;
}

export interface SimulatedFeedOptions {
  /** Total ticks per second across all symbols. */
  readonly ticksPerSecond?: number;
  /** Largest move of one tick as a fraction of the price (0.002 = ±0.2%). */
  readonly maxMoveFraction?: number;
  /** Share of ticks delivered late, after a newer tick for the same symbol. */
  readonly lateTickProbability?: number;
  /** Gap between silent periods, picked uniformly from this range. */
  readonly silenceEveryMs?: readonly [number, number];
  readonly silenceDurationMs?: number;
  readonly connectDelayMs?: number;
  readonly random?: () => number;
}

interface Instrument {
  ltp: number;
  high: number | null;
  low: number | null;
  volume: number | null;
}

/** NSE price-band tick sizes, in paise. */
export function tickSizePaise(pricePaise: number): number {
  if (pricePaise < 250_00) return 1;
  if (pricePaise < 1_000_00) return 5;
  if (pricePaise < 5_000_00) return 10;
  if (pricePaise < 10_000_00) return 50;
  if (pricePaise < 20_000_00) return 100;
  return 500;
}

const toRupees = (paise: number): number => paise / 100;

/**
 * A fake market data socket. It behaves like a socket client (connect,
 * disconnect, subscribe, push ticks, connection state) and emits only what a
 * real feed would: partial ticks with per-symbol sequence numbers, a few of
 * them late and out of order, and a 5-second silence roughly once a minute.
 * Nothing outside the composition root knows this class exists.
 */
export class SimulatedPriceFeed implements PriceFeed {
  private readonly random: () => number;
  private readonly maxMoveFraction: number;
  private readonly lateTickProbability: number;
  private readonly silenceEveryMs: readonly [number, number];
  private readonly silenceDurationMs: number;
  private readonly connectDelayMs: number;
  private rate: number;

  private state: FeedConnectionState = 'closed';
  private readonly tickHandlers = new Set<(tick: WireTick) => void>();
  private readonly stateHandlers = new Set<(state: FeedConnectionState) => void>();
  private readonly instruments = new Map<string, Instrument>();
  private readonly seqBySymbol = new Map<string, number>();
  /** Ticks held back to be delivered after a newer one for the same symbol. */
  private readonly heldBack = new Map<string, WireTick>();
  private subscribed: ReadonlySet<string> | null = null;

  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private silentUntil = 0;
  private nextSilenceAt = 0;
  private outageUntil = 0;

  constructor(options: SimulatedFeedOptions = {}) {
    this.random = options.random ?? Math.random;
    this.rate = options.ticksPerSecond ?? 20;
    this.maxMoveFraction = options.maxMoveFraction ?? 0.002;
    this.lateTickProbability = options.lateTickProbability ?? 0.02;
    this.silenceEveryMs = options.silenceEveryMs ?? [50_000, 70_000];
    this.silenceDurationMs = options.silenceDurationMs ?? 5_000;
    this.connectDelayMs = options.connectDelayMs ?? 350;
  }

  // ── PriceFeed ──────────────────────────────────────────────────────────

  connect(): void {
    if (this.state !== 'closed') return;
    this.setState('connecting');
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      if (Date.now() < this.outageUntil) {
        this.setState('closed'); // the "server" is unreachable: the connect attempt fails
        return;
      }
      this.nextSilenceAt = Date.now() + randomBetween(this.random, ...this.silenceEveryMs);
      this.silentUntil = 0;
      this.setState('open');
      this.scheduleNextTick();
    }, this.connectDelayMs);
  }

  disconnect(): void {
    this.teardown();
    if (this.state !== 'closed') this.setState('closed');
  }

  subscribe(symbols: readonly string[]): void {
    this.subscribed = new Set(symbols);
  }

  onTick(handler: (tick: WireTick) => void): Unsubscribe {
    this.tickHandlers.add(handler);
    return () => this.tickHandlers.delete(handler);
  }

  onStateChange(handler: (state: FeedConnectionState) => void): Unsubscribe {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  // ── Simulator-only controls (composition root and dev menu) ─────────────

  /** Resets the simulated market to a REST snapshot. Sequence numbers keep counting up. */
  seed(seeds: readonly SimulatorSeed[]): void {
    this.instruments.clear();
    this.heldBack.clear();
    for (const s of seeds) {
      this.instruments.set(s.symbol, { ltp: s.ltpPaise, high: s.highPaise, low: s.lowPaise, volume: s.volume });
    }
  }

  get ticksPerSecond(): number {
    return this.rate;
  }

  setTicksPerSecond(rate: number): void {
    this.rate = Math.max(1, Math.min(500, rate));
  }

  /** Drops the connection and refuses reconnects for `durationMs`, like a network outage. */
  simulateOutage(durationMs: number): void {
    this.outageUntil = Date.now() + durationMs;
    this.teardown();
    if (this.state !== 'closed') this.setState('closed');
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private teardown(): void {
    if (this.tickTimer) clearTimeout(this.tickTimer);
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.tickTimer = null;
    this.connectTimer = null;
    this.heldBack.clear();
  }

  private setState(state: FeedConnectionState): void {
    this.state = state;
    for (const handler of [...this.stateHandlers]) handler(state);
  }

  private scheduleNextTick(): void {
    // Jittered gaps averaging 1000/rate ms look like real, bursty traffic.
    const meanGap = 1000 / this.rate;
    this.tickTimer = setTimeout(() => this.onTimer(), meanGap * (0.5 + this.random()));
  }

  private onTimer(): void {
    this.tickTimer = null;
    if (this.state !== 'open') return;
    const now = Date.now();
    if (now >= this.nextSilenceAt) {
      // Held-back ticks survive the silence and still arrive late afterwards.
      this.silentUntil = now + this.silenceDurationMs;
      this.nextSilenceAt = this.silentUntil + randomBetween(this.random, ...this.silenceEveryMs);
    }
    if (now >= this.silentUntil) this.emitOne();
    this.scheduleNextTick();
  }

  private pickSymbol(): string | null {
    const symbols = [...this.instruments.keys()].filter((s) => this.subscribed?.has(s) ?? true);
    if (symbols.length === 0) return null;
    return symbols[Math.floor(this.random() * symbols.length)] ?? null;
  }

  private emitOne(): void {
    const symbol = this.pickSymbol();
    const instrument = symbol ? this.instruments.get(symbol) : undefined;
    if (!symbol || !instrument) return;

    const seq = (this.seqBySymbol.get(symbol) ?? 0) + 1;
    this.seqBySymbol.set(symbol, seq);

    const step = tickSizePaise(instrument.ltp);
    // Truncate toward zero so a move never exceeds ±maxMoveFraction after rounding to the tick size.
    const steps = Math.trunc(((this.random() * 2 - 1) * this.maxMoveFraction * instrument.ltp) / step);
    const tick: { -readonly [K in keyof WireTick]: WireTick[K] } = { symbol, seq };

    if (steps !== 0) {
      instrument.ltp += steps * step;
      tick.ltp = toRupees(instrument.ltp);
      if (instrument.high != null && instrument.ltp > instrument.high) {
        instrument.high = instrument.ltp;
        tick.high = toRupees(instrument.high);
      }
      if (instrument.low != null && instrument.ltp < instrument.low) {
        instrument.low = instrument.ltp;
        tick.low = toRupees(instrument.low);
      }
    }
    if (instrument.volume != null && (steps === 0 || this.random() < 0.8)) {
      instrument.volume += 1 + Math.floor(this.random() * 2_000);
      tick.volume = instrument.volume;
    }
    if (tick.ltp === undefined && tick.volume === undefined) return; // nothing changed

    const pending = this.heldBack.get(symbol);
    if (!pending && this.random() < this.lateTickProbability) {
      this.heldBack.set(symbol, tick); // released after the next tick for this symbol: late and out of order
      return;
    }
    this.deliver(tick);
    if (pending) {
      this.heldBack.delete(symbol);
      this.deliver(pending);
    }
  }

  private deliver(tick: WireTick): void {
    for (const handler of [...this.tickHandlers]) handler(tick);
  }
}
