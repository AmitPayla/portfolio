import { createStore } from 'zustand/vanilla';
import type { OrderFill } from '@/domain/orders';
import type { Holding } from '@/domain/portfolio';
import { parseHoldingsCsv, SEED_HOLDINGS_CSV } from '@/data/seedHoldings';

export interface PortfolioState {
  readonly holdings: Readonly<Record<string, Holding>>;
  /** Holding symbols in insertion order; the list screen sorts a copy. */
  readonly symbols: readonly string[];
  /** Local fills, newest first. */
  readonly fills: readonly OrderFill[];
}

export function portfolioStateFrom(holdings: readonly Holding[]): PortfolioState {
  return {
    holdings: Object.fromEntries(holdings.map((h) => [h.symbol, h])),
    symbols: holdings.map((h) => h.symbol),
    fills: [],
  };
}

/** Pure state transition for a filled order. A null holding means the position was closed. */
export function withFill(state: PortfolioState, holding: Holding | null, fill: OrderFill): PortfolioState {
  const holdings = { ...state.holdings };
  let symbols = state.symbols;
  if (holding) {
    if (!(fill.symbol in holdings)) symbols = [...symbols, fill.symbol];
    holdings[fill.symbol] = holding;
  } else {
    delete holdings[fill.symbol];
    symbols = symbols.filter((s) => s !== fill.symbol);
  }
  return { holdings, symbols, fills: [fill, ...state.fills] };
}

export function createPortfolioStore(initial: readonly Holding[]) {
  return createStore<PortfolioState>()(() => portfolioStateFrom(initial));
}

export type PortfolioStore = ReturnType<typeof createPortfolioStore>;

const seed = parseHoldingsCsv(SEED_HOLDINGS_CSV);
if (__DEV__ && seed.errors.length > 0) console.warn('Seed holdings:', seed.errors);

/** App-wide instance, seeded from the bundled CSV on every launch. */
export const portfolioStore = createPortfolioStore(seed.holdings);
