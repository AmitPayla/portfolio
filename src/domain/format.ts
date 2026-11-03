import { roundHalfAwayFromZero, type Paise } from './money';

/** What every screen shows instead of a value we do not have. Never 0, never a guess. */
export const MISSING = '--';

const RUPEE = '₹';
const MINUS = '-';

type SignMode = 'negative-only' | 'always';

/**
 * Indian digit grouping: the last three digits form one group, then groups of
 * two. "1234567" → "12,34,567". We format by hand rather than with Intl so the
 * output is identical on Hermes (Android/iOS), in Jest, and across ICU versions.
 */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const lastThree = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) groups.unshift(rest);
  return `${groups.join(',')},${lastThree}`;
}

function signPrefix(value: number, mode: SignMode): string {
  if (value < 0) return MINUS;
  if (value > 0 && mode === 'always') return '+';
  return '';
}

/** Formats an integer with two implied decimals: 123456789 → "12,34,567.89". */
function formatHundredths(absHundredths: number): string {
  const whole = Math.floor(absHundredths / 100);
  const fraction = absHundredths % 100;
  return `${groupIndian(String(whole))}.${String(fraction).padStart(2, '0')}`;
}

/** ₹12,34,567.89 · -₹12.50 · "--" for null. */
export function formatMoney(value: Paise | null | undefined, sign: SignMode = 'negative-only'): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return `${signPrefix(value, sign)}${RUPEE}${formatHundredths(Math.abs(value))}`;
}

/** +₹1,234.50 / -₹12.00 / ₹0.00 — for P&L and day change. */
export function formatSignedMoney(value: Paise | null | undefined): string {
  return formatMoney(value, 'always');
}

/**
 * Formats a fraction as a percentage with two decimals: 0.03741 → "+3.74%".
 * Rounds half away from zero on the hundredth of a percent. Fractions from
 * `ratio` arrive already rounded on the integers, so exact halves come out right too.
 */
export function formatPercent(fraction: number | null | undefined, sign: SignMode = 'always'): string {
  if (fraction == null || !Number.isFinite(fraction)) return MISSING;
  const hundredths = roundHalfAwayFromZero(fraction * 10_000);
  // Normalise -0 so a tiny negative that rounds to zero prints "0.00%".
  const value = hundredths === 0 ? 0 : hundredths;
  return `${signPrefix(value, sign)}${formatHundredths(Math.abs(value))}%`;
}

/** Whole numbers with Indian grouping: 14753650 → "1,47,53,650". */
export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  const rounded = Math.trunc(value);
  return `${rounded < 0 ? MINUS : ''}${groupIndian(String(Math.abs(rounded)))}`;
}

/** "1 share" / "25 shares" with Indian grouping. */
export function formatShares(qty: number): string {
  return `${formatCount(qty)} ${qty === 1 ? 'share' : 'shares'}`;
}

/** Sign of a value for colouring: gains green, losses red, flat/unknown neutral. */
export type Trend = 'up' | 'down' | 'flat';

export function trendOf(value: number | null | undefined): Trend {
  if (value == null || !Number.isFinite(value) || value === 0) return 'flat';
  return value > 0 ? 'up' : 'down';
}
