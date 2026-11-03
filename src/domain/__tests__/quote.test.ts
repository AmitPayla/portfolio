import { paise, type Paise } from '../money';
import { applyTick, applyTicks, dayChange, mergeSnapshot, type Quote, type Tick } from '../quote';

const p = (rupees: number) => paise(Math.round(rupees * 100));

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: 'RELIANCE',
    ltp: p(1307.9),
    open: p(1287.9),
    high: p(1310),
    low: p(1282),
    prevClose: p(1300),
    volume: 42_319_913,
    seq: 10,
    updatedAt: 0,
    ...overrides,
  };
}

function tick(seq: number, fields: Partial<Record<'ltp' | 'high' | 'low', Paise>> & { volume?: number } = {}): Tick {
  return { symbol: 'RELIANCE', seq, ...fields };
}

describe('applyTick', () => {
  it('ignores ticks that are not newer than the last applied seq', () => {
    expect(applyTick(quote(), tick(10, { ltp: p(1), volume: 1 }), 1).kind).toBe('stale');
    expect(applyTick(quote(), tick(9, { ltp: p(1) }), 1).kind).toBe('stale');
  });

  it('changes only the fields present on the tick', () => {
    const result = applyTick(quote(), tick(11, { volume: 42_320_000 }), 5);
    expect(result).toEqual({
      kind: 'applied',
      quote: { ...quote(), volume: 42_320_000, seq: 11, updatedAt: 5 },
    });
  });

  it('widens a known high/low to include the new price', () => {
    const up = applyTick(quote(), tick(11, { ltp: p(1312.5) }), 1);
    expect(up.kind === 'applied' && up.quote.high).toBe(p(1312.5));
    const down = applyTick(quote(), tick(11, { ltp: p(1280) }), 1);
    expect(down.kind === 'applied' && down.quote.low).toBe(p(1280));
  });

  it('keeps an unknown high/low unknown instead of guessing it', () => {
    const result = applyTick(quote({ high: null, low: null }), tick(11, { ltp: p(1320) }), 1);
    expect(result.kind === 'applied' && result.quote.high).toBeNull();
    expect(result.kind === 'applied' && result.quote.low).toBeNull();
  });

  it('starts tracking an unknown symbol only once a tick carries a price', () => {
    expect(applyTick(undefined, tick(1, { volume: 5 }), 1).kind).toBe('unknown-symbol');
    const created = applyTick(undefined, tick(1, { ltp: p(10) }), 1);
    expect(created.kind === 'applied' && created.quote).toMatchObject({ ltp: p(10), prevClose: null, open: null });
  });
});

describe('applyTicks', () => {
  const other = { ...quote(), symbol: 'TCS', seq: 3 };
  const quotes = { RELIANCE: quote(), TCS: other };

  it('drops a late tick that arrives after a newer one', () => {
    const result = applyTicks(quotes, [tick(12, { ltp: p(1309) }), tick(11, { ltp: p(1250) })], 1);
    expect(result.applied).toBe(1);
    expect(result.stale).toBe(1);
    expect(result.quotes.RELIANCE?.ltp).toBe(p(1309));
    expect(result.quotes.RELIANCE?.seq).toBe(12);
  });

  it('keeps object identity for symbols that did not change', () => {
    const result = applyTicks(quotes, [tick(11, { ltp: p(1309) })], 1);
    expect(result.quotes.TCS).toBe(other);
    expect(result.quotes.RELIANCE).not.toBe(quotes.RELIANCE);
  });

  it('returns the same map when every tick was stale', () => {
    const result = applyTicks(quotes, [tick(1, { ltp: p(1) })], 1);
    expect(result.quotes).toBe(quotes);
  });
});

describe('mergeSnapshot', () => {
  it('takes REST prices, keeps feed seq, and drops symbols the API no longer returns', () => {
    const fresh = { ...quote({ ltp: p(1290), seq: 0 }) };
    const merged = mergeSnapshot({ RELIANCE: quote({ seq: 40 }), OLDCO: quote({ symbol: 'OLDCO' }) }, [fresh]);
    expect(merged.RELIANCE?.ltp).toBe(p(1290));
    expect(merged.RELIANCE?.seq).toBe(40);
    expect(merged.OLDCO).toBeUndefined();
  });
});

describe('dayChange', () => {
  it('is ltp minus previous close', () => {
    // ₹7.90 on a ₹1,300.00 previous close: 0.6077%, kept to the hundredth of a percent.
    expect(dayChange(quote())).toEqual({ abs: p(7.9), pct: 0.0061 });
  });

  it('is unknown without a previous close or quote', () => {
    expect(dayChange(quote({ prevClose: null }))).toBeNull();
    expect(dayChange(undefined)).toBeNull();
  });
});
