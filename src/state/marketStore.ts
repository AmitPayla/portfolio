import { createStore } from 'zustand/vanilla';
import type { QuoteMap } from '@/domain/quote';

/**
 * What the price indicator shows.
 * - connecting:   first connection attempt, nothing streamed yet
 * - live:         ticks are arriving
 * - paused:       socket is open but silent for longer than the stale threshold
 * - reconnecting: the socket dropped; a retry is scheduled (see retryAt)
 * - offline:      we closed it on purpose (app in background)
 */
export type StreamStatus = 'idle' | 'connecting' | 'live' | 'paused' | 'reconnecting' | 'offline';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface MarketState {
  /** Latest quote per symbol. Each tick replaces only the changed symbol's object. */
  readonly quotes: QuoteMap;
  /** Symbols we asked the API for that came back without a price. */
  readonly missing: readonly string[];
  readonly load: {
    readonly status: LoadStatus;
    readonly error: string | null;
    readonly fetchedAt: number | null;
  };
  readonly refresh: {
    readonly inFlight: boolean;
    /** Last refresh failure; existing prices are kept. Cleared on the next success. */
    readonly error: string | null;
  };
  /**
   * Written only when the status changes, never per tick: anything that
   * subscribes to `stream` re-renders on transitions, not 20 times a second.
   */
  readonly stream: {
    readonly status: StreamStatus;
    readonly lastTickAt: number | null;
    readonly retryAt: number | null;
  };
}

export const initialMarketState: MarketState = {
  quotes: {},
  missing: [],
  load: { status: 'idle', error: null, fetchedAt: null },
  refresh: { inFlight: false, error: null },
  stream: { status: 'idle', lastTickAt: null, retryAt: null },
};

export function createMarketStore() {
  return createStore<MarketState>()(() => initialMarketState);
}

export type MarketStore = ReturnType<typeof createMarketStore>;

/** App-wide instance. Tests create their own with createMarketStore(). */
export const marketStore = createMarketStore();
