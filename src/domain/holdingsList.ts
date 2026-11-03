import { computeHoldingMetrics, type Holding } from './portfolio';
import type { QuoteMap } from './quote';

export type SortKey = 'name' | 'value' | 'pnl';
export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

export const DEFAULT_SORT: SortSpec = { key: 'value', direction: 'desc' };

/** Does the order depend on live prices (and so need periodic re-sorting)? */
export function isPriceDependentSort(spec: SortSpec): boolean {
  return spec.key !== 'name';
}

/** Case-insensitive substring match on the symbol; an empty query matches everything. */
export function matchesQuery(symbol: string, query: string): boolean {
  const q = query.trim().toUpperCase();
  return q === '' || symbol.toUpperCase().includes(q);
}

/**
 * Returns the symbols to display, filtered and sorted. Holdings without a
 * price have no value or P&L to compare, so they always go last (in name
 * order) whichever direction is chosen; they are never sorted as if they were 0.
 */
export function sortAndFilterHoldings(
  holdings: readonly Holding[],
  quotes: QuoteMap,
  spec: SortSpec,
  query: string,
): string[] {
  const visible = holdings.filter((h) => matchesQuery(h.symbol, query));
  const factor = spec.direction === 'asc' ? 1 : -1;

  if (spec.key === 'name') {
    return visible.map((h) => h.symbol).sort((a, b) => factor * a.localeCompare(b));
  }

  const keyed = visible.map((h) => {
    const m = computeHoldingMetrics(h, quotes[h.symbol]);
    return { symbol: h.symbol, key: spec.key === 'value' ? m.valuePaise : m.pnlPaise };
  });
  keyed.sort((a, b) => {
    if (a.key == null || b.key == null) {
      if (a.key == null && b.key == null) return a.symbol.localeCompare(b.symbol);
      return a.key == null ? 1 : -1;
    }
    return factor * (a.key - b.key) || a.symbol.localeCompare(b.symbol);
  });
  return keyed.map((k) => k.symbol);
}

export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((symbol, i) => symbol === b[i]);
}
