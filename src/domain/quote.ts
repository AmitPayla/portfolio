import { ratio, subPaise, type Paise } from './money';

/**
 * Latest known market data for one symbol. `ltp` is required: a symbol without
 * a usable last price has no Quote at all, and the UI renders "--" for it.
 * Every other field may be unknown (null) and is rendered as "--" too.
 */
export interface Quote {
  readonly symbol: string;
  readonly ltp: Paise;
  readonly open: Paise | null;
  readonly high: Paise | null;
  readonly low: Paise | null;
  readonly prevClose: Paise | null;
  readonly volume: number | null;
  /** Highest feed sequence applied to this symbol. 0 = REST snapshot only. */
  readonly seq: number;
  /** Epoch ms of the last change, for "last updated" labels. */
  readonly updatedAt: number;
}

export type QuoteMap = Readonly<Record<string, Quote>>;

/** A feed update after validation: prices already in paise, only changed fields present. */
export interface Tick {
  readonly symbol: string;
  readonly seq: number;
  readonly ltp?: Paise;
  readonly high?: Paise;
  readonly low?: Paise;
  readonly volume?: number;
}

export interface DayChange {
  readonly abs: Paise;
  /** Fraction of previous close: 0.0045 = +0.45%. */
  readonly pct: number | null;
}

export function dayChange(quote: Pick<Quote, 'ltp' | 'prevClose'> | undefined): DayChange | null {
  if (!quote || quote.prevClose == null) return null;
  const abs = subPaise(quote.ltp, quote.prevClose);
  return { abs, pct: ratio(abs, quote.prevClose) };
}

/** Widens a known extreme to include `ltp`. An unknown extreme stays unknown: we never invent a day high. */
function widenHigh(high: Paise | null, ltp: Paise): Paise | null {
  return high == null ? null : ltp > high ? ltp : high;
}

function widenLow(low: Paise | null, ltp: Paise): Paise | null {
  return low == null ? null : ltp < low ? ltp : low;
}

export type TickResult =
  | { readonly kind: 'applied'; readonly quote: Quote }
  | { readonly kind: 'stale' }
  | { readonly kind: 'unknown-symbol' };

/**
 * Applies one partial tick to a quote.
 *
 * - A tick whose seq is not newer than the last applied seq for the symbol is
 *   stale (it arrived late or out of order) and is ignored. Applying it would
 *   roll the price back.
 * - Only fields present on the tick change; the rest carry over.
 * - Known day high/low are widened to include the new ltp. The feed reports a
 *   new extreme on the tick that made it, but that tick may be the late one we
 *   drop, so we keep low ≤ ltp ≤ high true ourselves. An unknown high/low stays
 *   unknown ("--") rather than being guessed from the ltp.
 */
export function applyTick(quote: Quote | undefined, tick: Tick, now: number): TickResult {
  if (!quote) {
    // A symbol we have no snapshot for: we can only start tracking it once a tick carries a price.
    if (tick.ltp == null) return { kind: 'unknown-symbol' };
    const ltp = tick.ltp;
    return {
      kind: 'applied',
      quote: {
        symbol: tick.symbol,
        ltp,
        open: null,
        high: widenHigh(tick.high ?? null, ltp),
        low: widenLow(tick.low ?? null, ltp),
        prevClose: null,
        volume: tick.volume ?? null,
        seq: tick.seq,
        updatedAt: now,
      },
    };
  }

  if (tick.seq <= quote.seq) return { kind: 'stale' };

  const ltp = tick.ltp ?? quote.ltp;
  const reportedHigh = tick.high ?? quote.high;
  const reportedLow = tick.low ?? quote.low;
  return {
    kind: 'applied',
    quote: {
      ...quote,
      ltp,
      high: widenHigh(reportedHigh, ltp),
      low: widenLow(reportedLow, ltp),
      volume: tick.volume ?? quote.volume,
      seq: tick.seq,
      updatedAt: now,
    },
  };
}

export interface ApplyTicksResult {
  /** Same object as the input when nothing changed, so subscribers can skip work. */
  readonly quotes: QuoteMap;
  readonly applied: number;
  readonly stale: number;
}

/**
 * Applies a batch of ticks in arrival order. Only the symbols that changed get
 * a new Quote object; every other entry keeps its identity, which is what lets
 * a row subscribed to one symbol skip re-rendering.
 */
export function applyTicks(quotes: QuoteMap, ticks: readonly Tick[], now: number): ApplyTicksResult {
  let next: Record<string, Quote> | null = null;
  let applied = 0;
  let stale = 0;
  for (const tick of ticks) {
    const current: Quote | undefined = (next ?? quotes)[tick.symbol];
    const result = applyTick(current, tick, now);
    if (result.kind === 'applied') {
      next ??= { ...quotes };
      next[tick.symbol] = result.quote;
      applied += 1;
    } else if (result.kind === 'stale') {
      stale += 1;
    }
  }
  return { quotes: next ?? quotes, applied, stale };
}

/**
 * Replaces the quote set with a fresh REST snapshot. The REST API is the source
 * of truth, so its prices win; we only carry over each symbol's feed sequence
 * so that late ticks from before the refresh are still recognised as stale.
 * Symbols missing from the snapshot are dropped: their price is now unknown.
 */
export function mergeSnapshot(previous: QuoteMap, snapshot: readonly Quote[]): QuoteMap {
  const next: Record<string, Quote> = {};
  for (const quote of snapshot) {
    const seq = Math.max(previous[quote.symbol]?.seq ?? 0, quote.seq);
    next[quote.symbol] = seq === quote.seq ? quote : { ...quote, seq };
  }
  return next;
}
