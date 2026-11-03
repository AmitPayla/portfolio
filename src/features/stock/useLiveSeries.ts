import { useEffect, useState } from 'react';
import { marketStore } from '@/state/marketStore';
import type { ChartPoint } from '@/ui/charts/LiveLineChart';

/** Enough for several minutes at ~1 tick/s per symbol; older points scroll off. */
export const MAX_SERIES_POINTS = 300;

/**
 * Prices received for `symbol` since the screen mounted. It subscribes to the
 * store directly and appends only when this symbol's ltp actually changes, so
 * ticks for other symbols never touch the chart.
 */
export function useLiveSeries(symbol: string): readonly ChartPoint[] {
  const [points, setPoints] = useState<readonly ChartPoint[]>(() => {
    const ltp = marketStore.getState().quotes[symbol]?.ltp;
    return ltp == null ? [] : [{ t: Date.now(), v: ltp }];
  });

  useEffect(() => {
    let last: number | null = marketStore.getState().quotes[symbol]?.ltp ?? null;
    return marketStore.subscribe((state) => {
      const ltp = state.quotes[symbol]?.ltp ?? null;
      if (ltp == null || ltp === last) return;
      last = ltp;
      setPoints((previous) => {
        const next = previous.length >= MAX_SERIES_POINTS ? previous.slice(1 - MAX_SERIES_POINTS) : previous.slice();
        next.push({ t: Date.now(), v: ltp });
        return next;
      });
    });
  }, [symbol]);

  return points;
}
