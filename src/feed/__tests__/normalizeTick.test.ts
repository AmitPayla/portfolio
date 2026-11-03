import { normalizeTick } from '../normalizeTick';

describe('normalizeTick', () => {
  it('converts rupees to paise and keeps only present fields', () => {
    expect(normalizeTick({ symbol: 'TCS', seq: 4, ltp: 2499.1, volume: 3488517 })).toEqual({
      symbol: 'TCS',
      seq: 4,
      ltp: 249910,
      volume: 3488517,
    });
  });

  it('rejects malformed ticks instead of guessing', () => {
    expect(normalizeTick({ symbol: '', seq: 1, ltp: 1 })).toBeNull();
    expect(normalizeTick({ symbol: 'TCS', seq: 0, ltp: 1 })).toBeNull();
    expect(normalizeTick({ symbol: 'TCS', seq: 1.5, ltp: 1 })).toBeNull();
    expect(normalizeTick({ symbol: 'TCS', seq: 2, ltp: 0 })).toBeNull();
    expect(normalizeTick({ symbol: 'TCS', seq: 2, ltp: Number.NaN })).toBeNull();
    expect(normalizeTick({ symbol: 'TCS', seq: 2, high: -1 })).toBeNull();
    expect(normalizeTick({ symbol: 'TCS', seq: 2, volume: -5 })).toBeNull();
  });
});
