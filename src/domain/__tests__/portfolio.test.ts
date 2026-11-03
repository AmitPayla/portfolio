import { formatMoney, formatPercent } from '../format';
import { paise } from '../money';
import { applyBuy } from '../orders';
import { averagePricePaise, computeHoldingMetrics, createHolding, summarizePortfolio } from '../portfolio';
import type { Quote, QuoteMap } from '../quote';

const p = (rupees: number) => paise(Math.round(rupees * 100));

function quote(symbol: string, ltp: number, prevClose: number | null): Quote {
  return {
    symbol,
    ltp: p(ltp),
    open: null,
    high: null,
    low: null,
    prevClose: prevClose == null ? null : p(prevClose),
    volume: null,
    seq: 0,
    updatedAt: 0,
  };
}

const reliance = createHolding('RELIANCE', 25, p(1319.59));
const tcs = createHolding('TCS', 40, p(2589.71));
const oldco = createHolding('OLDCO', 30, p(412.5));

describe('computeHoldingMetrics', () => {
  it('computes value, P&L and P&L % from exact paise', () => {
    const m = computeHoldingMetrics(reliance, quote('RELIANCE', 1307.9, 1300));
    expect(m.investedPaise).toBe(3298975); // ₹32,989.75
    expect(m.valuePaise).toBe(3269750); // ₹32,697.50
    expect(m.pnlPaise).toBe(-29225); // -₹292.25
    expect(formatPercent(m.pnlPct)).toBe('-0.89%');
    expect(m.dayPnlPaise).toBe(19750); // 25 × ₹7.90
    expect(m.dayBasePaise).toBe(3250000);
  });

  it('returns nulls, not zeros, when there is no price', () => {
    const m = computeHoldingMetrics(oldco, undefined);
    expect(m).toMatchObject({ ltpPaise: null, valuePaise: null, pnlPaise: null, pnlPct: null, dayPnlPaise: null });
    expect(m.investedPaise).toBe(1237500); // cost is still known: ₹12,375.00
  });

  it('measures shares bought today against their fill price, not previous close', () => {
    const bought = applyBuy(reliance, 'RELIANCE', 10, p(1307.9));
    const m = computeHoldingMetrics(bought, quote('RELIANCE', 1307.9, 1300));
    // Only the 25 overnight shares moved today; the 10 new ones are flat.
    expect(m.dayPnlPaise).toBe(19750);
  });

  it('leaves day P&L unknown when the previous close is missing', () => {
    const m = computeHoldingMetrics(reliance, quote('RELIANCE', 1307.9, null));
    expect(m.valuePaise).toBe(3269750);
    expect(m.dayPnlPaise).toBeNull();
  });
});

describe('summarizePortfolio', () => {
  const quotes: QuoteMap = {
    RELIANCE: quote('RELIANCE', 1307.9, 1300),
    TCS: quote('TCS', 2499.1, 2501.7),
  };
  const summary = summarizePortfolio([reliance, tcs, oldco], quotes);

  it('totals equal the sum of the rows to the paisa', () => {
    const rows = [reliance, tcs].map((h) => computeHoldingMetrics(h, quotes[h.symbol]));
    const sum = (pick: (r: (typeof rows)[number]) => number | null) =>
      rows.reduce((acc, r) => acc + (pick(r) ?? 0), 0);
    expect(summary.currentValuePaise).toBe(sum((r) => r.valuePaise));
    expect(summary.investedPaise).toBe(sum((r) => r.investedPaise));
    expect(summary.pnlPaise).toBe(sum((r) => r.pnlPaise));
    expect(summary.dayPnlPaise).toBe(sum((r) => r.dayPnlPaise));
    expect(summary.pnlPaise).toBe(summary.currentValuePaise - summary.investedPaise);
  });

  it('leaves unpriced holdings out of every total and reports them', () => {
    expect(summary.holdingsCount).toBe(3);
    expect(summary.pricedCount).toBe(2);
    expect(summary.unpriced).toEqual([{ symbol: 'OLDCO', investedPaise: 1237500 }]);
    expect(summary.unpricedInvestedPaise).toBe(1237500);
    // Invested covers RELIANCE + TCS only: ₹32,989.75 + ₹1,03,588.40
    expect(formatMoney(summary.investedPaise)).toBe('₹1,36,578.15');
  });

  it('reports what share of invested capital is priced, and the value change vs invested', () => {
    // ₹1,36,578.15 priced out of ₹1,36,578.15 + ₹12,375.00 (OLDCO)
    expect(summary.pricedInvestedShare).toBeCloseTo(13657815 / (13657815 + 1237500), 12);
    expect(formatPercent(summary.pricedInvestedShare, 'negative-only')).toBe('91.69%');
    expect(summary.valueVsInvestedPct).toBe(summary.pnlPct);
    expect(summarizePortfolio([reliance, tcs], quotes).pricedInvestedShare).toBe(1);
  });

  it('computes Today % against the start-of-day value', () => {
    // RELIANCE +₹197.50, TCS 40 × -₹2.60 = -₹104.00
    expect(summary.dayPnlPaise).toBe(9350);
    expect(summary.dayPnlPct).toBeCloseTo(9350 / (3250000 + 40 * 250170), 12);
  });

  it('handles an empty or fully unpriced portfolio without dividing by zero', () => {
    const empty = summarizePortfolio([], {});
    expect(empty.pnlPct).toBeNull();
    expect(empty.dayPnlPct).toBeNull();
    const allUnpriced = summarizePortfolio([oldco], {});
    expect(allUnpriced.currentValuePaise).toBe(0);
    expect(allUnpriced.pricedCount).toBe(0);
    expect(allUnpriced.pnlPct).toBeNull();
    expect(allUnpriced.pricedInvestedShare).toBe(0);
    expect(empty.pricedInvestedShare).toBeNull();
  });
});

describe('averagePricePaise', () => {
  it('is the cost basis over quantity, rounded to the paisa', () => {
    expect(averagePricePaise(reliance)).toBe(131959);
    expect(averagePricePaise({ ...reliance, qty: 3, costPaise: paise(1000) })).toBe(333);
  });
});
