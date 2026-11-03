import { executeMarketOrder, type ExecutionResult, type OrderSide } from '@/domain/orders';
import { marketStore, type MarketStore } from '@/state/marketStore';
import { portfolioStore, withFill, type PortfolioStore } from '@/state/portfolioStore';

export interface TradingDeps {
  readonly market: MarketStore;
  readonly portfolio: PortfolioStore;
  readonly now: () => number;
}

const defaultDeps: TradingDeps = { market: marketStore, portfolio: portfolioStore, now: Date.now };
let orderCounter = 0;

/**
 * Places a local market order. The price is read at the moment of confirm,
 * not when the sheet opened, so the fill is at the true last price. Holdings
 * and Summary both derive from the same store update, so they cannot disagree.
 */
export function placeMarketOrder(
  side: OrderSide,
  symbol: string,
  qty: number,
  deps: TradingDeps = defaultDeps,
): ExecutionResult {
  const now = deps.now();
  const ltp = deps.market.getState().quotes[symbol]?.ltp ?? null;
  const holding = deps.portfolio.getState().holdings[symbol];
  orderCounter += 1;
  const result = executeMarketOrder(holding, { id: `ord-${now}-${orderCounter}`, symbol, side, qty }, ltp, now);
  if (result.ok) {
    deps.portfolio.setState((state) => withFill(state, result.holding, result.fill));
  }
  return result;
}
