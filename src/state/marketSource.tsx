import { createContext, use, useMemo, type ReactNode } from 'react';
import { marketStore, type MarketState, type MarketStore } from './marketStore';

/** A read-only stand-in for the market store: always the same snapshot, never notifies. */
function heldStore(state: MarketState): MarketStore {
  return {
    getState: () => state,
    getInitialState: () => state,
    setState: () => {},
    subscribe: () => () => {},
  };
}

const MarketSourceContext = createContext<MarketStore>(marketStore);

/** The store the market hooks read: the live one, unless a <HoldPrices> above says otherwise. */
export function useMarketSource(): MarketStore {
  return use(MarketSourceContext);
}

/**
 * While `held`, everything below sees the prices as they were at that moment
 * and does not re-render on ticks. The screen stays visible (unlike a freeze),
 * so it suits a screen covered by another one: the tab under a pushed stock
 * detail, which the iOS swipe-back reveals before it regains focus. When
 * released, each subscriber renders once with the latest prices.
 */
export function HoldPrices({ held, children }: { readonly held: boolean; readonly children: ReactNode }) {
  const source = useMemo(() => (held ? heldStore(marketStore.getState()) : marketStore), [held]);
  return <MarketSourceContext value={source}>{children}</MarketSourceContext>;
}
