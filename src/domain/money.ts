/**
 * Money is stored as integer paise (₹1 = 100 paise) everywhere inside the app.
 *
 * Floats only exist at the edges (API JSON, feed wire format) and are converted
 * exactly once, with explicit rounding, by `parsePricePaise`. Inside the app
 * every amount is an integer, so `qty × price`, sums and differences are exact
 * and a total always equals the sum of the rows it was built from.
 *
 * `Paise` is a branded number: the compiler refuses a plain number (say, a
 * rupee float) where paise are expected. Arithmetic goes through the helpers
 * below, which also assert we never leave the safe-integer range.
 */
declare const paiseBrand: unique symbol;
export type Paise = number & { readonly [paiseBrand]: true };

export const ZERO_PAISE = 0 as Paise;

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} is not a safe integer number of paise: ${value}`);
  }
}

/** Wraps a value that is already an integer number of paise. */
export function paise(value: number): Paise {
  assertSafeInteger(value, 'paise()');
  return value as Paise;
}

/**
 * Converts a rupee amount from the API or feed into paise.
 * Returns null for anything that is not a usable price: non-numbers, NaN,
 * Infinity, zero and negatives. A missing price must stay missing; it never
 * becomes 0.
 */
export function parsePricePaise(rupees: unknown): Paise | null {
  if (typeof rupees !== 'number' || !Number.isFinite(rupees) || rupees <= 0) return null;
  // 1164.9 * 100 === 116489.99999999999 in IEEE-754, so round instead of truncating.
  const value = Math.round(rupees * 100);
  if (value <= 0 || !Number.isSafeInteger(value)) return null;
  return value as Paise;
}

export function addPaise(a: Paise, b: Paise): Paise {
  return paise(a + b);
}

export function subPaise(a: Paise, b: Paise): Paise {
  return paise(a - b);
}

/** price × whole-share quantity. Exact, because both are integers. */
export function mulQty(price: Paise, qty: number): Paise {
  assertSafeInteger(qty, 'quantity');
  return paise(price * qty);
}

export function sumPaise(values: Iterable<Paise>): Paise {
  let total = 0;
  for (const v of values) total += v;
  return paise(total);
}

/** Rounds half away from zero (so -2.5 → -3 and 2.5 → 3), unlike Math.round. */
export function roundHalfAwayFromZero(value: number): number {
  const rounded = Math.round(Math.abs(value));
  return value < 0 ? -rounded : rounded;
}

/**
 * Integer division of paise rounded half away from zero, for the few places
 * that need a share of an amount (average cost, cost released on a sell).
 * The float quotient is exact enough here: inputs stay far below 2^53 and
 * denominators are share counts (≤ MAX_ORDER_QTY scale).
 */
export function divRoundPaise(numerator: number, denominator: number): Paise {
  if (denominator === 0) throw new RangeError('divRoundPaise: division by zero');
  return paise(roundHalfAwayFromZero(numerator / denominator));
}

/**
 * Exact (value × multiplier) / divisor for non-negative integers, rounded half
 * up. Uses BigInt so the intermediate product cannot lose precision even for
 * large positions. Used to release a proportional share of a cost basis.
 */
export function mulDivRoundPaise(value: Paise, multiplier: number, divisor: number): Paise {
  if (divisor <= 0) throw new RangeError('mulDivRoundPaise: divisor must be positive');
  if (value < 0 || multiplier < 0) throw new RangeError('mulDivRoundPaise: expects non-negative inputs');
  assertSafeInteger(multiplier, 'multiplier');
  assertSafeInteger(divisor, 'divisor');
  const numerator = BigInt(value) * BigInt(multiplier);
  const d = BigInt(divisor);
  return paise(Number((numerator * 2n + d) / (2n * d)));
}

/** a / b as a fraction (0.0374 = 3.74%), or null when b is zero. Display-only. */
export function ratio(numerator: Paise, denominator: Paise): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}
