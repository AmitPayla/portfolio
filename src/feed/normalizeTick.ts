import { parsePricePaise } from '@/domain/money';
import type { Tick } from '@/domain/quote';
import type { WireTick } from './types';

/**
 * Converts a wire tick (rupees) into a domain tick (paise) and rejects
 * anything malformed. A price field that is present but unusable (NaN, 0,
 * negative) invalidates the whole tick: we would rather skip one update than
 * show a wrong price.
 */
export function normalizeTick(wire: WireTick): Tick | null {
  if (typeof wire.symbol !== 'string' || wire.symbol === '') return null;
  if (!Number.isSafeInteger(wire.seq) || wire.seq < 1) return null;

  const tick: { -readonly [K in keyof Tick]: Tick[K] } = { symbol: wire.symbol, seq: wire.seq };
  for (const field of ['ltp', 'high', 'low'] as const) {
    const raw = wire[field];
    if (raw === undefined) continue;
    const value = parsePricePaise(raw);
    if (value == null) return null;
    tick[field] = value;
  }
  if (wire.volume !== undefined) {
    if (!Number.isSafeInteger(wire.volume) || wire.volume < 0) return null;
    tick.volume = wire.volume;
  }
  return tick;
}
