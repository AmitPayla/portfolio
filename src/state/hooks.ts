import { useCallback, useMemo } from 'react';
import { useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import type { Paise } from '@/domain/money';
import { computeHoldingMetrics, summarizePortfolio, type HoldingMetrics, type PortfolioSummary } from '@/domain/portfolio';
import type { Quote } from '@/domain/quote';
import { marketStore, type MarketState } from './marketStore';
import { portfolioStore } from './portfolioStore';
import { watchlistStore } from './watchlistStore';

/*
 * Subscription rules (this is the re-render strategy):
 * - Select the narrowest value a component shows. Primitives compare by value,
 *   so a row that reads `ltp` does not re-render on a volume-only tick.
 * - Quote objects are replaced only for the symbol that ticked, so selecting
 *   `quotes[symbol]` re-renders one row, not the list.
 * - Derived totals use useStoreWithEqualityFn (React's
 *   useSyncExternalStoreWithSelector underneath) with a value equality, so the
 *   summary re-renders only when a number it shows actually changes.
 */

// ── Market ───────────────────────────────────────────────────────────────

/** Full quote: for the detail screen, which shows every field. */
export function useQuote(symbol: string): Quote | undefined {
  return useStore(marketStore, (s) => s.quotes[symbol]);
}

export function useLtp(symbol: string): Paise | null {
  return useStore(marketStore, (s) => s.quotes[symbol]?.ltp ?? null);
}

export function usePrevClose(symbol: string): Paise | null {
  return useStore(marketStore, (s) => s.quotes[symbol]?.prevClose ?? null);
}

export function useIsUnavailable(symbol: string): boolean {
  return useStore(marketStore, (s) => s.load.status === 'ready' && s.quotes[symbol] == null);
}

export function useLoadState(): MarketState['load'] {
  return useStore(marketStore, (s) => s.load);
}

export function useRefreshState(): MarketState['refresh'] {
  return useStore(marketStore, (s) => s.refresh);
}

export function useStream(): MarketState['stream'] {
  return useStore(marketStore, (s) => s.stream);
}

// ── Portfolio ────────────────────────────────────────────────────────────

export function useHoldingSymbols(): readonly string[] {
  return useStore(portfolioStore, (s) => s.symbols);
}

export function useHolding(symbol: string) {
  return useStore(portfolioStore, (s) => s.holdings[symbol]);
}

export function useHeldQty(symbol: string): number {
  return useStore(portfolioStore, (s) => s.holdings[symbol]?.qty ?? 0);
}

/** Metrics for one position, re-computed only when its holding, ltp or prev close change. */
export function useHoldingMetrics(symbol: string): HoldingMetrics | null {
  const holding = useHolding(symbol);
  const ltp = useLtp(symbol);
  const prevClose = usePrevClose(symbol);
  return useMemo(
    () => (holding ? computeHoldingMetrics(holding, ltp == null ? undefined : { ltp, prevClose }) : null),
    [holding, ltp, prevClose],
  );
}

function summaryEquals(a: PortfolioSummary, b: PortfolioSummary): boolean {
  return (
    a.currentValuePaise === b.currentValuePaise &&
    a.investedPaise === b.investedPaise &&
    a.dayPnlPaise === b.dayPnlPaise &&
    a.dayPnlPct === b.dayPnlPct &&
    a.holdingsCount === b.holdingsCount &&
    a.pricedCount === b.pricedCount &&
    a.dayExcludedCount === b.dayExcludedCount &&
    a.unpricedInvestedPaise === b.unpricedInvestedPaise &&
    a.unpriced.length === b.unpriced.length &&
    a.unpriced.every((u, i) => u.symbol === b.unpriced[i]?.symbol)
  );
}

/**
 * Portfolio totals. Recomputed on every flush (21 holdings: microseconds),
 * but the card re-renders only when one of its numbers changes, e.g. not on
 * ticks for watchlist-only symbols or volume-only ticks.
 */
export function usePortfolioSummary(): PortfolioSummary {
  const holdings = useStore(portfolioStore, (s) => s.holdings);
  const list = useMemo(() => Object.values(holdings), [holdings]);
  const select = useCallback((s: MarketState) => summarizePortfolio(list, s.quotes), [list]);
  return useStoreWithEqualityFn(marketStore, select, summaryEquals);
}

// ── Watchlist ────────────────────────────────────────────────────────────

export function useWatchlist(): readonly string[] {
  return useStore(watchlistStore, (s) => s.symbols);
}

export function useWatchlistHydrated(): boolean {
  return useStore(watchlistStore, (s) => s.hydrated);
}

export function useIsWatched(symbol: string): boolean {
  return useStore(watchlistStore, (s) => s.symbols.includes(symbol));
}
