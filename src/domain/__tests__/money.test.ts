import {
  divRoundPaise,
  mulDivRoundPaise,
  mulQty,
  paise,
  parsePricePaise,
  ratio,
  roundHalfAwayFromZero,
  sumPaise,
} from '../money';

describe('parsePricePaise', () => {
  it('converts rupee floats to exact integer paise', () => {
    // 1164.9 * 100 is 116489.99999999999 in floating point.
    expect(parsePricePaise(1164.9)).toBe(116490);
    expect(parsePricePaise(0.1 + 0.2)).toBe(30);
    expect(parsePricePaise(13017.25)).toBe(1301725);
    expect(parsePricePaise(196.01)).toBe(19601);
  });

  it('treats unusable values as missing, never as zero', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, '1164.9', null, undefined, {}]) {
      expect(parsePricePaise(bad)).toBeNull();
    }
  });
});

describe('integer arithmetic', () => {
  it('multiplies price by quantity exactly', () => {
    expect(mulQty(paise(131959), 25)).toBe(3298975); // 25 × ₹1,319.59 = ₹32,989.75
  });

  it('sums without drift', () => {
    const tenCents = Array.from({ length: 1000 }, () => paise(10));
    expect(sumPaise(tenCents)).toBe(10000);
  });

  it('refuses to leave the safe-integer range', () => {
    expect(() => mulQty(paise(Number.MAX_SAFE_INTEGER), 2)).toThrow(RangeError);
    expect(() => paise(1.5)).toThrow(RangeError);
  });

  it('rounds half away from zero', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(-2.4)).toBe(-2);
    expect(divRoundPaise(1000, 3)).toBe(333);
    expect(divRoundPaise(-1000, 3)).toBe(-333);
  });

  it('computes proportional shares exactly with BigInt', () => {
    expect(mulDivRoundPaise(paise(1000), 1, 3)).toBe(333);
    expect(mulDivRoundPaise(paise(1000), 2, 3)).toBe(667);
    // Product is far beyond 2^53 but the result is exact.
    expect(mulDivRoundPaise(paise(9_000_000_000_000), 999_999, 1_000_000)).toBe(8_999_991_000_000);
  });

  it('returns null ratios instead of dividing by zero', () => {
    expect(ratio(paise(5), paise(0))).toBeNull();
    expect(ratio(paise(5), paise(100))).toBe(0.05);
  });

  it('rounds ratios to the hundredth of a percent on the integers', () => {
    // As floats, 7041 / 20000 × 10,000 is 3520.4999999999995, which would round down.
    expect(ratio(paise(7041), paise(20000))).toBe(0.3521);
    expect(ratio(paise(-7041), paise(20000))).toBe(-0.3521);
    expect(ratio(paise(1), paise(3))).toBe(0.3333);
    expect(ratio(paise(-1), paise(300000))).toBe(0); // rounds to zero, never -0
  });
});
