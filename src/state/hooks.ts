import { useCallback, useMemo } from 'react';
import { useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import type { Paise } from '@/domain/money';
import { computeHoldingMetrics, summarizePortfolio, type HoldingMetrics, type PortfolioSummary } from '@/domain/portfolio';
import type { Quote } from '@/domain/quote';
import { type MarketState } from './marketStore';
import { loadingPreviewStore } from './loadingPreview';
import { useMarketSource } from './marketSource';
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
 * - Market data is read through useMarketSource(), so a screen covered by
 *   another one can hold its prices still (<HoldPrices>) and skip every tick.
 */

// ── Market ───────────────────────────────────────────────────────────────

/** Full quote: for the detail screen, which shows every field. */
export function useQuote(symbol: string): Quote | undefined {
  return useStore(useMarketSource(), (s) => s.quotes[symbol]);
}

export function useLtp(symbol: string): Paise | null {
  return useStore(useMarketSource(), (s) => s.quotes[symbol]?.ltp ?? null);
}

export function usePrevClose(symbol: string): Paise | null {
  return useStore(useMarketSource(), (s) => s.quotes[symbol]?.prevClose ?? null);
}

export function useIsUnavailable(symbol: string): boolean {
  return useStore(useMarketSource(), (s) => s.load.status === 'ready' && s.quotes[symbol] == null);
}

export function useLoadState(): MarketState['load'] {
  const load = useStore(useMarketSource(), (s) => s.load);
  // Dev menu preview (loadingPreview.ts): report "loading" over loaded data for a few seconds.
  const previewing = useStore(loadingPreviewStore, (s) => s.active);
  return useMemo<MarketState['load']>(() => (previewing && load.status === 'ready' ? { ...load, status: 'loading' } : load), [previewing, load]);
}

export function useRefreshState(): MarketState['refresh'] {
  return useStore(useMarketSource(), (s) => s.refresh);
}

export function useStream(): MarketState['stream'] {
  return useStore(useMarketSource(), (s) => s.stream);
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
  return useStoreWithEqualityFn(useMarketSource(), select, summaryEquals);
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
