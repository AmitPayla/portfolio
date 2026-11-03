import {
  formatCount,
  formatMoney,
  formatPercent,
  formatShares,
  formatSignedMoney,
  groupIndian,
  MISSING,
  trendOf,
} from '../format';
import { paise, ratio } from '../money';

describe('groupIndian', () => {
  it.each([
    ['1', '1'],
    ['999', '999'],
    ['1000', '1,000'],
    ['99999', '99,999'],
    ['100000', '1,00,000'],
    ['1234567', '12,34,567'],
    ['10000000', '1,00,00,000'],
    ['123456789012', '1,23,45,67,89,012'],
  ])('%s → %s', (input, expected) => {
    expect(groupIndian(input)).toBe(expected);
  });
});

describe('formatMoney', () => {
  it('uses Indian grouping and two decimals', () => {
    expect(formatMoney(paise(123456789))).toBe('₹12,34,567.89');
    expect(formatMoney(paise(116490))).toBe('₹1,164.90');
    expect(formatMoney(paise(5))).toBe('₹0.05');
    expect(formatMoney(paise(0))).toBe('₹0.00');
  });

  it('puts the sign before the currency symbol', () => {
    expect(formatMoney(paise(-1250))).toBe('-₹12.50');
    expect(formatSignedMoney(paise(123450))).toBe('+₹1,234.50');
    expect(formatSignedMoney(paise(-29225))).toBe('-₹292.25');
    expect(formatSignedMoney(paise(0))).toBe('₹0.00');
  });

  it('shows -- for missing values, never 0', () => {
    expect(formatMoney(null)).toBe(MISSING);
    expect(formatMoney(undefined)).toBe(MISSING);
    expect(formatSignedMoney(null)).toBe('--');
  });
});

describe('formatPercent', () => {
  it('formats fractions as signed percentages', () => {
    expect(formatPercent(0.03741)).toBe('+3.74%');
    expect(formatPercent(-0.0088588)).toBe('-0.89%');
    expect(formatPercent(12.345)).toBe('+1,234.50%');
  });

  it('rounds half away from zero on the hundredth', () => {
    expect(formatPercent(0.00005)).toBe('+0.01%');
    expect(formatPercent(-0.00005)).toBe('-0.01%');
    expect(formatPercent(0.0000499)).toBe('0.00%');
  });

  it('rounds exact halves away from zero when the percentage comes from paise', () => {
    // Previous close ₹4,000.00, up ₹0.60: exactly +0.015%.
    expect(formatPercent(ratio(paise(60), paise(400000)))).toBe('+0.02%');
    // -₹4,955.00 on ₹1,00,000.00 invested: exactly -4.955%.
    expect(formatPercent(ratio(paise(-495500), paise(10000000)))).toBe('-4.96%');
  });

  it('never prints a negative zero', () => {
    expect(formatPercent(-0.00001)).toBe('0.00%');
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('shows -- for missing values', () => {
    expect(formatPercent(null)).toBe('--');
    expect(formatPercent(Number.NaN)).toBe('--');
  });
});

describe('counts and trends', () => {
  it('groups counts the Indian way', () => {
    expect(formatCount(14753650)).toBe('1,47,53,650');
    expect(formatCount(null)).toBe('--');
    expect(formatShares(1)).toBe('1 share');
    expect(formatShares(100000)).toBe('1,00,000 shares');
  });

  it('derives the colour trend from the sign', () => {
    expect(trendOf(5)).toBe('up');
    expect(trendOf(-5)).toBe('down');
    expect(trendOf(0)).toBe('flat');
    expect(trendOf(null)).toBe('flat');
  });
});
