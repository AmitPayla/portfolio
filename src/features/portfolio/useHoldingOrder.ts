import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useStore } from 'zustand';
import { isPriceDependentSort, sameOrder, sortAndFilterHoldings, type SortSpec } from '@/domain/holdingsList';
import { marketStore } from '@/state/marketStore';
import { portfolioStore } from '@/state/portfolioStore';

/** How often a value/P&L sort is re-evaluated against live prices. */
export const RESORT_INTERVAL_MS = 1_500;

/**
 * The list's data: an array of symbols. It changes only when the visible order
 * changes, never on a plain price tick, so the FlatList itself does not
 * re-render 20 times a second; each row subscribes to its own symbol instead.
 *
 * Value/P&L sorts depend on live prices, so they are re-checked on a timer
 * (not per tick), skipped while the user is dragging the list, and committed
 * only if the order actually changed. Rows therefore don't jump under a finger.
 */
export function useHoldingOrder(
  sort: SortSpec,
  query: string,
  options: { readonly enabled: boolean; readonly isInteracting: RefObject<boolean> },
): readonly string[] {
  const holdings = useStore(portfolioStore, (s) => s.holdings);
  // A fresh snapshot (first load or pull-to-refresh) should re-sort immediately.
  const fetchedAt = useStore(marketStore, (s) => s.load.fetchedAt);

  const compute = useCallback(
    () => sortAndFilterHoldings(Object.values(holdings), marketStore.getState().quotes, sort, query),
    [holdings, sort, query],
  );
  const [order, setOrder] = useState<readonly string[]>(compute);

  const { enabled, isInteracting } = options;
  useEffect(() => {
    const apply = () => {
      setOrder((previous) => {
        const next = compute();
        return sameOrder(previous, next) ? previous : next;
      });
    };
    apply();
    if (!enabled || !isPriceDependentSort(sort)) return;
    const id = setInterval(() => {
      if (!isInteracting.current) apply();
    }, RESORT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [compute, sort, enabled, isInteracting, fetchedAt]);

  return order;
}
