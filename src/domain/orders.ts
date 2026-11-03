import { formatCount } from './format';
import { addPaise, mulDivRoundPaise, mulQty, subPaise, ZERO_PAISE, type Paise } from './money';
import type { Holding } from './portfolio';

export type OrderSide = 'buy' | 'sell';

/**
 * Upper bound per order. A fat-finger guard, and it keeps qty × price far
 * inside the safe-integer range for paise.
 */
export const MAX_ORDER_QTY = 100_000;

export type QuantityError =
  | 'empty'
  | 'not-a-number'
  | 'not-whole'
  | 'not-positive'
  | 'too-large'
  | 'nothing-to-sell'
  | 'exceeds-holding';

export type QuantityValidation =
  | { readonly ok: true; readonly qty: number }
  | { readonly ok: false; readonly error: QuantityError; readonly message: string };

function invalid(error: QuantityError, message: string): QuantityValidation {
  return { ok: false, error, message };
}

/**
 * Validates the raw text from the quantity field. Only whole numbers above zero
 * pass, and a sell may not exceed the shares held.
 */
export function validateOrderQuantity(input: string, side: OrderSide, heldQty: number): QuantityValidation {
  const text = input.trim();
  if (text === '') return invalid('empty', 'Enter a quantity');
  if (!/^[-+]?\d*\.?\d+$/.test(text)) return invalid('not-a-number', 'Use digits only');
  if (text.includes('.')) return invalid('not-whole', 'Whole shares only, no decimals');
  if (text.startsWith('-')) return invalid('not-positive', 'Quantity must be at least 1');
  const qty = Number(text.replace(/^\+/, ''));
  if (!Number.isSafeInteger(qty) || qty > MAX_ORDER_QTY) {
    return invalid('too-large', `Max ${formatCount(MAX_ORDER_QTY)} shares per order`);
  }
  if (qty < 1) return invalid('not-positive', 'Quantity must be at least 1');
  if (side === 'sell') {
    if (heldQty <= 0) return invalid('nothing-to-sell', "You don't hold any shares to sell");
    if (qty > heldQty) {
      return invalid('exceeds-holding', `You hold only ${formatCount(heldQty)} ${heldQty === 1 ? 'share' : 'shares'}`);
    }
  }
  return { ok: true, qty };
}

/**
 * Buy: cost basis grows by exactly qty × fill price, so the average price
 * becomes the weighted average (oldCost + qty × price) / (oldQty + qty).
 */
export function applyBuy(holding: Holding | undefined, symbol: string, qty: number, pricePaise: Paise): Holding {
  const cost = mulQty(pricePaise, qty);
  if (!holding) return { symbol, qty, costPaise: cost, todayQty: qty, todayCostPaise: cost };
  return {
    ...holding,
    qty: holding.qty + qty,
    costPaise: addPaise(holding.costPaise, cost),
    todayQty: holding.todayQty + qty,
    todayCostPaise: addPaise(holding.todayCostPaise, cost),
  };
}

export interface SellResult {
  /** null when the whole position was sold. */
  readonly holding: Holding | null;
  readonly costReleasedPaise: Paise;
  readonly realizedPnlPaise: Paise;
}

/**
 * Sell, average-cost method: the shares sold carry the average cost out with
 * them, so the average price of what remains is unchanged (to the paisa).
 * The released cost is rounded once, here, and realized P&L is computed from
 * that same rounded figure so Invested + realized always reconcile.
 * For Today's P&L, shares bought today are sold first (intraday square-off).
 */
export function applySell(holding: Holding, qty: number, pricePaise: Paise): SellResult {
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > holding.qty) {
    throw new RangeError(`Cannot sell ${qty} of ${holding.qty} ${holding.symbol}`);
  }
  const proceeds = mulQty(pricePaise, qty);
  const remainingQty = holding.qty - qty;
  const costReleasedPaise =
    remainingQty === 0 ? holding.costPaise : mulDivRoundPaise(holding.costPaise, qty, holding.qty);
  const realizedPnlPaise = subPaise(proceeds, costReleasedPaise);
  if (remainingQty === 0) return { holding: null, costReleasedPaise, realizedPnlPaise };

  const todaySold = Math.min(qty, holding.todayQty);
  const todayQty = holding.todayQty - todaySold;
  const todayCostPaise =
    todayQty === 0
      ? ZERO_PAISE
      : subPaise(holding.todayCostPaise, mulDivRoundPaise(holding.todayCostPaise, todaySold, holding.todayQty));

  return {
    holding: {
      ...holding,
      qty: remainingQty,
      costPaise: subPaise(holding.costPaise, costReleasedPaise),
      todayQty,
      todayCostPaise,
    },
    costReleasedPaise,
    realizedPnlPaise,
  };
}

export interface OrderFill {
  readonly id: string;
  readonly symbol: string;
  readonly side: OrderSide;
  readonly qty: number;
  readonly pricePaise: Paise;
  readonly valuePaise: Paise;
  /** Sells only. */
  readonly realizedPnlPaise: Paise | null;
  readonly filledAt: number;
}

export type OrderRejection = 'no-price' | 'invalid-quantity';

export type ExecutionResult =
  | { readonly ok: true; readonly holding: Holding | null; readonly fill: OrderFill }
  | { readonly ok: false; readonly reason: OrderRejection; readonly message: string };

export interface MarketOrder {
  readonly id: string;
  readonly symbol: string;
  readonly side: OrderSide;
  readonly qty: number;
}

/**
 * Fills a market order at the last traded price. Without a price there is
 * nothing honest to fill at, so the order is rejected rather than guessed.
 */
export function executeMarketOrder(
  holding: Holding | undefined,
  order: MarketOrder,
  ltpPaise: Paise | null,
  now: number,
): ExecutionResult {
  if (ltpPaise == null) {
    return { ok: false, reason: 'no-price', message: `No live price for ${order.symbol}, so the order can't be filled` };
  }
  const validation = validateOrderQuantity(String(order.qty), order.side, holding?.qty ?? 0);
  if (!validation.ok) return { ok: false, reason: 'invalid-quantity', message: validation.message };

  const valuePaise = mulQty(ltpPaise, order.qty);
  if (order.side === 'buy') {
    return {
      ok: true,
      holding: applyBuy(holding, order.symbol, order.qty, ltpPaise),
      fill: { ...order, pricePaise: ltpPaise, valuePaise, realizedPnlPaise: null, filledAt: now },
    };
  }
  if (!holding) {
    // validateOrderQuantity already rejects this; the guard lets the compiler see it too.
    return { ok: false, reason: 'invalid-quantity', message: "You don't hold any shares to sell" };
  }
  const sold = applySell(holding, order.qty, ltpPaise);
  return {
    ok: true,
    holding: sold.holding,
    fill: { ...order, pricePaise: ltpPaise, valuePaise, realizedPnlPaise: sold.realizedPnlPaise, filledAt: now },
  };
}
