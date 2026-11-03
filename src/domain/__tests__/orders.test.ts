import { paise } from '../money';
import { applyBuy, applySell, executeMarketOrder, MAX_ORDER_QTY, validateOrderQuantity } from '../orders';
import { averagePricePaise, createHolding } from '../portfolio';

const p = (rupees: number) => paise(Math.round(rupees * 100));
const reliance = createHolding('RELIANCE', 25, p(1319.59)); // cost ₹32,989.75

describe('validateOrderQuantity', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'not-a-number'],
    ['1e3', 'not-a-number'],
    ['12abc', 'not-a-number'],
    ['1.5', 'not-whole'],
    ['2.0', 'not-whole'],
    ['-3', 'not-positive'],
    ['0', 'not-positive'],
    ['000', 'not-positive'],
    [String(MAX_ORDER_QTY + 1), 'too-large'],
    ['99999999999999999999', 'too-large'],
  ])('rejects %p as %s', (input, error) => {
    const result = validateOrderQuantity(input, 'buy', 0);
    expect(result).toMatchObject({ ok: false, error });
  });

  it.each([
    ['1', 1],
    [' 12 ', 12],
    ['007', 7],
    ['+5', 5],
    [String(MAX_ORDER_QTY), MAX_ORDER_QTY],
  ])('accepts %p as %d', (input, qty) => {
    expect(validateOrderQuantity(input, 'buy', 0)).toEqual({ ok: true, qty });
  });

  it('does not allow selling more than is held', () => {
    expect(validateOrderQuantity('26', 'sell', 25)).toMatchObject({
      ok: false,
      error: 'exceeds-holding',
      message: 'You hold only 25 shares',
    });
    expect(validateOrderQuantity('25', 'sell', 25)).toEqual({ ok: true, qty: 25 });
    expect(validateOrderQuantity('1', 'sell', 0)).toMatchObject({ ok: false, error: 'nothing-to-sell' });
  });
});

describe('applyBuy', () => {
  it('moves the average price to the weighted average', () => {
    const after = applyBuy(reliance, 'RELIANCE', 10, p(1307.9));
    expect(after.qty).toBe(35);
    expect(after.costPaise).toBe(3298975 + 1307900);
    // (25 × 1319.59 + 10 × 1307.90) / 35 = 1316.25 exactly
    expect(averagePricePaise(after)).toBe(131625);
    expect(after.todayQty).toBe(10);
    expect(after.todayCostPaise).toBe(1307900);
  });

  it('opens a new position at the fill price', () => {
    const fresh = applyBuy(undefined, 'HCLTECH', 3, p(1439.1));
    expect(fresh).toEqual({ symbol: 'HCLTECH', qty: 3, costPaise: 431730, todayQty: 3, todayCostPaise: 431730 });
  });
});

describe('applySell', () => {
  it('keeps the average price and books realized P&L against average cost', () => {
    const position = applyBuy(reliance, 'RELIANCE', 10, p(1307.9)); // 35 @ 1316.25
    const result = applySell(position, 10, p(1320));
    expect(result.costReleasedPaise).toBe(1316250);
    expect(result.realizedPnlPaise).toBe(1320000 - 1316250); // +₹37.50
    expect(result.holding && averagePricePaise(result.holding)).toBe(131625);
    expect(result.holding?.qty).toBe(25);
  });

  it('rounds the released cost once and reconciles it with realized P&L', () => {
    const odd = { ...reliance, qty: 3, costPaise: paise(1000) }; // avg 333.33…
    const result = applySell(odd, 1, p(5));
    expect(result.costReleasedPaise).toBe(333);
    expect(result.holding?.costPaise).toBe(667);
    expect(result.realizedPnlPaise).toBe(500 - 333);
    // Nothing is lost: remaining cost + released cost = original cost.
    expect((result.holding?.costPaise ?? 0) + result.costReleasedPaise).toBe(1000);
  });

  it('sells today’s shares first for the day P&L split', () => {
    const position = applyBuy(reliance, 'RELIANCE', 10, p(1307.9)); // 25 overnight + 10 today
    const result = applySell(position, 15, p(1310));
    expect(result.holding).toMatchObject({ qty: 20, todayQty: 0, todayCostPaise: 0 });
  });

  it('removes the position when everything is sold', () => {
    const result = applySell(reliance, 25, p(1300));
    expect(result.holding).toBeNull();
    expect(result.costReleasedPaise).toBe(3298975);
    expect(result.realizedPnlPaise).toBe(3250000 - 3298975);
  });

  it('refuses to oversell', () => {
    expect(() => applySell(reliance, 26, p(1300))).toThrow(RangeError);
  });
});

describe('executeMarketOrder', () => {
  const order = { id: 'o1', symbol: 'RELIANCE', side: 'buy' as const, qty: 2 };

  it('fills at the last traded price', () => {
    const result = executeMarketOrder(reliance, order, p(1307.9), 99);
    expect(result).toMatchObject({
      ok: true,
      fill: { pricePaise: 130790, valuePaise: 261580, filledAt: 99, realizedPnlPaise: null },
    });
  });

  it('rejects an order when there is no price instead of guessing one', () => {
    expect(executeMarketOrder(undefined, { ...order, symbol: 'OLDCO' }, null, 1)).toMatchObject({
      ok: false,
      reason: 'no-price',
    });
  });

  it('rejects a sell larger than the holding', () => {
    expect(executeMarketOrder(reliance, { ...order, side: 'sell', qty: 30 }, p(1300), 1)).toMatchObject({
      ok: false,
      reason: 'invalid-quantity',
    });
  });
});
