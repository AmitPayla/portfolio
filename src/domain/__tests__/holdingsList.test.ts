import { matchesQuery, sameOrder, sortAndFilterHoldings } from '../holdingsList';
import { paise } from '../money';
import { createHolding } from '../portfolio';
import type { Quote, QuoteMap } from '../quote';

const p = (rupees: number) => paise(Math.round(rupees * 100));
const q = (symbol: string, ltp: number): Quote => ({
  symbol,
  ltp: p(ltp),
  open: null,
  high: null,
  low: null,
  prevClose: null,
  volume: null,
  seq: 0,
  updatedAt: 0,
});

const holdings = [
  createHolding('TCS', 10, p(100)), // value 1,000 · P&L +0
  createHolding('INFY', 10, p(50)), // value 2,000 · P&L +1,500
  createHolding('OLDCO', 30, p(412.5)), // no price
  createHolding('ITC', 100, p(300)), // value 27,000 · P&L -3,000
];
const quotes: QuoteMap = { TCS: q('TCS', 100), INFY: q('INFY', 200), ITC: q('ITC', 270) };

describe('sortAndFilterHoldings', () => {
  it('sorts by name both ways', () => {
    expect(sortAndFilterHoldings(holdings, quotes, { key: 'name', direction: 'asc' }, '')).toEqual([
      'INFY',
      'ITC',
      'OLDCO',
      'TCS',
    ]);
    expect(sortAndFilterHoldings(holdings, quotes, { key: 'name', direction: 'desc' }, '')).toEqual([
      'TCS',
      'OLDCO',
      'ITC',
      'INFY',
    ]);
  });

  it('sorts by value and keeps unpriced holdings last in either direction', () => {
    expect(sortAndFilterHoldings(holdings, quotes, { key: 'value', direction: 'desc' }, '')).toEqual([
      'ITC',
      'INFY',
      'TCS',
      'OLDCO',
    ]);
    expect(sortAndFilterHoldings(holdings, quotes, { key: 'value', direction: 'asc' }, '')).toEqual([
      'TCS',
      'INFY',
      'ITC',
      'OLDCO',
    ]);
  });

  it('sorts by P&L in rupees', () => {
    expect(sortAndFilterHoldings(holdings, quotes, { key: 'pnl', direction: 'desc' }, '')).toEqual([
      'INFY',
      'TCS',
      'ITC',
      'OLDCO',
    ]);
  });

  it('filters by symbol, case-insensitively, as you type', () => {
    expect(sortAndFilterHoldings(holdings, quotes, { key: 'name', direction: 'asc' }, 'i')).toEqual([
      'INFY',
      'ITC',
    ]);
    expect(sortAndFilterHoldings(holdings, quotes, { key: 'value', direction: 'desc' }, ' tc ')).toEqual([
      'ITC',
      'TCS',
    ]);
    expect(sortAndFilterHoldings(holdings, quotes, { key: 'value', direction: 'desc' }, 'zzz')).toEqual([]);
  });
});

describe('helpers', () => {
  it('matches empty queries and compares orders', () => {
    expect(matchesQuery('TCS', '')).toBe(true);
    expect(sameOrder(['A', 'B'], ['A', 'B'])).toBe(true);
    expect(sameOrder(['A', 'B'], ['B', 'A'])).toBe(false);
  });
});
