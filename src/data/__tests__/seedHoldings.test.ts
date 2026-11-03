import { averagePricePaise } from '@/domain/portfolio';
import { parseHoldingsCsv, SEED_HOLDINGS_CSV } from '../seedHoldings';

describe('parseHoldingsCsv', () => {
  it('parses all 21 bundled holdings, including OLDCO', () => {
    const { holdings, errors } = parseHoldingsCsv(SEED_HOLDINGS_CSV);
    expect(errors).toEqual([]);
    expect(holdings).toHaveLength(21);
    expect(holdings.map((h) => h.symbol)).toContain('OLDCO');
    const ultracemco = holdings.find((h) => h.symbol === 'ULTRACEMCO');
    expect(ultracemco?.costPaise).toBe(100 * 1018127);
    expect(ultracemco && averagePricePaise(ultracemco)).toBe(1018127);
  });

  it('skips and reports bad rows instead of zero-filling them', () => {
    const { holdings, errors } = parseHoldingsCsv(
      ['symbol,qty,avgPrice', 'GOOD,2,10', 'NOQTY,,10', 'FRAC,1.5,10', 'NEG,3,-1', 'GOOD,1,1', 'EXTRA,1,1,1'].join('\n'),
    );
    expect(holdings.map((h) => h.symbol)).toEqual(['GOOD']);
    expect(errors).toHaveLength(5);
  });
});
