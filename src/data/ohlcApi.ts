import { parsePricePaise } from '@/domain/money';
import type { Quote } from '@/domain/quote';

export const OHLC_URL = 'https://api.v2.liquide.life/api/markets/ohlc';
const TIMEOUT_MS = 10_000;

export interface OhlcSnapshot {
  readonly quotes: Quote[];
  /** Requested symbols the API did not return (or returned without a usable price). */
  readonly missing: string[];
  readonly fetchedAt: number;
}

export type OhlcErrorKind = 'network' | 'timeout' | 'http' | 'parse';

export class OhlcError extends Error {
  constructor(
    readonly kind: OhlcErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'OhlcError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseVolume(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * Validates the response body. The list lives at `message.data`; unknown
 * symbols are simply absent. Any field that is missing or not a usable number
 * becomes null (rendered "--"). A row without a usable ltp is treated like an
 * absent symbol: no Quote, no price.
 */
export function parseOhlcResponse(body: unknown, requested: readonly string[], now: number): OhlcSnapshot {
  const message = isRecord(body) ? body.message : undefined;
  const data = isRecord(message) ? message.data : undefined;
  if (!Array.isArray(data)) throw new OhlcError('parse', 'Unexpected response: message.data is not a list');

  const wanted = new Set(requested);
  const bySymbol = new Map<string, Quote>();
  for (const row of data) {
    if (!isRecord(row) || typeof row.symbol !== 'string') continue;
    const symbol = row.symbol.toUpperCase();
    const ltp = parsePricePaise(row.ltp);
    if (!wanted.has(symbol) || ltp == null) continue;
    bySymbol.set(symbol, {
      symbol,
      ltp,
      open: parsePricePaise(row.open),
      high: parsePricePaise(row.high),
      low: parsePricePaise(row.low),
      prevClose: parsePricePaise(row.prevClose),
      volume: parseVolume(row.volume),
      seq: 0,
      updatedAt: now,
    });
  }
  return {
    quotes: [...bySymbol.values()],
    missing: requested.filter((s) => !bySymbol.has(s)),
    fetchedAt: now,
  };
}

export interface FetchOhlcOptions {
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
}

/**
 * One POST for every symbol we care about. Success is any 2xx: the API
 * answers 201. This is a shared test server, so callers fetch once per load
 * and on explicit refresh/retry only, never on a timer.
 */
export async function fetchOhlcSnapshot(symbols: readonly string[], options: FetchOhlcOptions = {}): Promise<OhlcSnapshot> {
  const { fetchImpl = fetch, now = Date.now } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  let response: Response;
  try {
    response = await fetchImpl(OHLC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ symbols }),
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = controller.signal.aborted && !options.signal?.aborted;
    throw new OhlcError(
      timedOut ? 'timeout' : 'network',
      timedOut ? 'The price server took too long to respond' : "Couldn't reach the price server",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }

  if (!response.ok) {
    throw new OhlcError('http', `Price server error (HTTP ${response.status})`, response.status);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new OhlcError('parse', 'The price server sent an unreadable response');
  }
  return parseOhlcResponse(body, symbols, now());
}
