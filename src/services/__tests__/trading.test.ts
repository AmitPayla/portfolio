import { paise } from '@/domain/money';
import { computeHoldingMetrics, createHolding, summarizePortfolio } from '@/domain/portfolio';
import type { Quote } from '@/domain/quote';
import { createMarketStore } from '@/state/marketStore';
import { createPortfolioStore } from '@/state/portfolioStore';
import { placeMarketOrder, type TradingDeps } from '../trading';

const p = (rupees: number) => paise(Math.round(rupees * 100));
const quote = (symbol: string, ltp: number): Quote => ({
  symbol,
  ltp: p(ltp),
  open: null,
  high: null,
  low: null,
  prevClose: p(ltp),
  volume: null,
  seq: 0,
  updatedAt: 0,
});

function setup(): TradingDeps {
  const market = createMarketStore();
  market.setState({ quotes: { RELIANCE: quote('RELIANCE', 1307.9), HCLTECH: quote('HCLTECH', 1439.1) } });
  const portfolio = createPortfolioStore([
    createHolding('RELIANCE', 25, p(1319.59)),
    createHolding('OLDCO', 30, p(412.5)),
  ]);
  return { market, portfolio, now: () => 1_000 };
}

function totalsMatchRows(deps: TradingDeps) {
  const { holdings } = deps.portfolio.getState();
  const { quotes } = deps.market.getState();
  const summary = summarizePortfolio(Object.values(holdings), quotes);
  const priced = Object.values(holdings).map((h) => computeHoldingMetrics(h, quotes[h.symbol]));
  const rowsInvested = priced.reduce((acc, m) => acc + (m.valuePaise == null ? 0 : m.investedPaise), 0);
  const rowsValue = priced.reduce((acc, m) => acc + (m.valuePaise ?? 0), 0);
  expect(summary.investedPaise).toBe(rowsInvested);
  expect(summary.currentValuePaise).toBe(rowsValue);
}

describe('placeMarketOrder', () => {
  it('buys at the last price and keeps holdings and summary consistent', () => {
    const deps = setup();
    deps.market.setState((s) => ({ quotes: { ...s.quotes, RELIANCE: quote('RELIANCE', 1310) } }));
    const result = placeMarketOrder('buy', 'RELIANCE', 10, deps);
    expect(result).toMatchObject({ ok: true, fill: { pricePaise: 131000, qty: 10, side: 'buy' } });
    const holding = deps.portfolio.getState().holdings.RELIANCE;
    expect(holding).toMatchObject({ qty: 35, costPaise: 3298975 + 1310000 });
    expect(deps.portfolio.getState().fills).toHaveLength(1);
    totalsMatchRows(deps);
  });

  it('adds a new holding when buying a symbol you do not own', () => {
    const deps = setup();
    placeMarketOrder('buy', 'HCLTECH', 2, deps);
    expect(deps.portfolio.getState().symbols).toEqual(['RELIANCE', 'OLDCO', 'HCLTECH']);
    totalsMatchRows(deps);
  });

  it('removes the holding when everything is sold and books realized P&L', () => {
    const deps = setup();
    const result = placeMarketOrder('sell', 'RELIANCE', 25, deps);
    expect(result.ok && result.fill.realizedPnlPaise).toBe(25 * 130790 - 3298975);
    expect(deps.portfolio.getState().holdings.RELIANCE).toBeUndefined();
    expect(deps.portfolio.getState().symbols).toEqual(['OLDCO']);
  });

  it('rejects orders it cannot fill honestly and leaves state untouched', () => {
    const deps = setup();
    const before = deps.portfolio.getState();
    expect(placeMarketOrder('buy', 'OLDCO', 1, deps)).toMatchObject({ ok: false, reason: 'no-price' });
    expect(placeMarketOrder('sell', 'RELIANCE', 26, deps)).toMatchObject({ ok: false, reason: 'invalid-quantity' });
    expect(deps.portfolio.getState()).toBe(before);
  });
});
