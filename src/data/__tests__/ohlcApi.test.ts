import { MARKET_SYMBOLS } from '@/domain/symbols';
import { fetchOhlcSnapshot, OhlcError, parseOhlcResponse } from '../ohlcApi';
import fixture from './fixtures/ohlc-response.json';

const requested = [...MARKET_SYMBOLS, 'OLDCO'];

describe('parseOhlcResponse', () => {
  it('reads message.data, converts to paise and reports omitted symbols', () => {
    const snapshot = parseOhlcResponse(fixture, requested, 123);
    expect(snapshot.quotes).toHaveLength(25);
    expect(snapshot.missing).toEqual(['OLDCO']);
    const reliance = snapshot.quotes.find((q) => q.symbol === 'RELIANCE');
    expect(reliance).toEqual({
      symbol: 'RELIANCE',
      ltp: 130790,
      open: 128790,
      high: 130790,
      low: 128200,
      prevClose: 130000,
      volume: 42319913,
      seq: 0,
      updatedAt: 123,
    });
  });

  it('turns bad fields into null and drops rows without a usable ltp', () => {
    const body = {
      message: {
        data: [
          { symbol: 'TCS', ltp: 2499.1, open: 'n/a', high: 0, low: -1, prevClose: null, volume: 1.5 },
          { symbol: 'INFY', ltp: 0, prevClose: 1161 },
          { symbol: 'NOTREQUESTED', ltp: 10 },
        ],
      },
    };
    const snapshot = parseOhlcResponse(body, ['TCS', 'INFY'], 1);
    expect(snapshot.quotes).toEqual([
      { symbol: 'TCS', ltp: 249910, open: null, high: null, low: null, prevClose: null, volume: null, seq: 0, updatedAt: 1 },
    ]);
    expect(snapshot.missing).toEqual(['INFY']);
  });

  it('throws a parse error for an unexpected shape', () => {
    expect(() => parseOhlcResponse({ message: 'oops' }, ['TCS'], 1)).toThrow(OhlcError);
  });
});

describe('fetchOhlcSnapshot', () => {
  const okResponse = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

  it('treats HTTP 201 as success and POSTs every symbol once', async () => {
    const fetchImpl = jest.fn(async () => okResponse(201, fixture));
    const snapshot = await fetchOhlcSnapshot(requested, { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => 7 });
    expect(snapshot.quotes).toHaveLength(25);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ symbols: requested });
  });

  it('maps HTTP and network failures to typed errors', async () => {
    const http = jest.fn(async () => okResponse(503, {}));
    await expect(fetchOhlcSnapshot(['TCS'], { fetchImpl: http as unknown as typeof fetch })).rejects.toMatchObject({
      kind: 'http',
      status: 503,
    });
    const offline = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(fetchOhlcSnapshot(['TCS'], { fetchImpl: offline as unknown as typeof fetch })).rejects.toMatchObject({
      kind: 'network',
    });
  });
});
