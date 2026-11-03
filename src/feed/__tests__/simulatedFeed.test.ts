import { createSeededRandom } from '../random';
import { SimulatedPriceFeed, tickSizePaise, type SimulatorSeed } from '../simulatedFeed';
import type { FeedConnectionState, WireTick } from '../types';

const seeds: SimulatorSeed[] = [
  { symbol: 'RELIANCE', ltpPaise: 130790, highPaise: 130790, lowPaise: 128200, volume: 42_319_913 },
  { symbol: 'WIPRO', ltpPaise: 19800, highPaise: 19850, lowPaise: 19601, volume: 8_431_185 },
  { symbol: 'MARUTI', ltpPaise: 1186900, highPaise: 1190200, lowPaise: 1167500, volume: 363_875 },
];

interface Received {
  tick: WireTick;
  at: number;
}

function startFeed(seed = 42) {
  const feed = new SimulatedPriceFeed({ random: createSeededRandom(seed) });
  feed.seed(seeds);
  const received: Received[] = [];
  const states: FeedConnectionState[] = [];
  feed.onTick((tick) => received.push({ tick, at: Date.now() }));
  feed.onStateChange((s) => states.push(s));
  feed.connect();
  return { feed, received, states };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-03T10:00:00Z'));
});
afterEach(() => jest.useRealTimers());

describe('SimulatedPriceFeed', () => {
  it('connects like a socket and emits about 20 ticks per second', () => {
    const { received, states } = startFeed();
    jest.advanceTimersByTime(350);
    expect(states).toEqual(['connecting', 'open']);
    jest.advanceTimersByTime(10_000);
    expect(received.length).toBeGreaterThan(170);
    expect(received.length).toBeLessThan(230);
  });

  it('sends partial ticks with only the changed fields', () => {
    const { received } = startFeed();
    jest.advanceTimersByTime(30_000);
    const allowed = new Set(['symbol', 'seq', 'ltp', 'high', 'low', 'volume']);
    for (const { tick } of received) {
      Object.keys(tick).forEach((k) => expect(allowed.has(k)).toBe(true));
      expect(tick.ltp !== undefined || tick.volume !== undefined).toBe(true);
    }
    expect(received.some(({ tick }) => tick.ltp === undefined)).toBe(true);
  });

  it('moves a price by at most ±0.2% per tick, on the tick-size grid', () => {
    const { received } = startFeed();
    jest.advanceTimersByTime(60_000);
    const last = new Map(seeds.map((s) => [s.symbol, s.ltpPaise]));
    const inSeqOrder = [...received].sort((a, b) => a.tick.seq - b.tick.seq);
    for (const { tick } of inSeqOrder) {
      if (tick.ltp === undefined) continue;
      const paise = Math.round(tick.ltp * 100);
      expect(Math.abs(tick.ltp * 100 - paise)).toBeLessThan(1e-6);
      const previous = last.get(tick.symbol) ?? paise;
      expect(Math.abs(paise - previous) / previous).toBeLessThanOrEqual(0.002);
      expect(Math.abs((paise - previous) % tickSizePaise(previous))).toBe(0);
      last.set(tick.symbol, paise);
    }
  });

  it('numbers ticks per symbol and delivers about 2% late, out of order', () => {
    const { received } = startFeed(7);
    jest.advanceTimersByTime(10 * 60_000);
    const maxSeen = new Map<string, number>();
    let late = 0;
    for (const { tick } of received) {
      const max = maxSeen.get(tick.symbol) ?? 0;
      if (tick.seq < max) late += 1;
      else maxSeen.set(tick.symbol, tick.seq);
    }
    const share = late / received.length;
    expect(share).toBeGreaterThan(0.01);
    expect(share).toBeLessThan(0.035);
  });

  it('goes silent for 5 seconds roughly once a minute, then resumes', () => {
    const { received } = startFeed();
    jest.advanceTimersByTime(3 * 60_000 + 350);
    const gaps: number[] = [];
    for (let i = 1; i < received.length; i += 1) {
      const gap = (received[i]?.at ?? 0) - (received[i - 1]?.at ?? 0);
      if (gap > 2_000) gaps.push(gap);
    }
    expect(gaps.length).toBeGreaterThanOrEqual(2);
    expect(gaps.length).toBeLessThanOrEqual(4);
    gaps.forEach((gap) => {
      expect(gap).toBeGreaterThanOrEqual(5_000);
      expect(gap).toBeLessThan(5_400);
    });
  });

  it('stops on disconnect and refuses connections during an outage', () => {
    const { feed, received, states } = startFeed();
    jest.advanceTimersByTime(2_000);
    feed.disconnect();
    const count = received.length;
    jest.advanceTimersByTime(5_000);
    expect(received.length).toBe(count);
    expect(states.at(-1)).toBe('closed');

    feed.simulateOutage(10_000);
    feed.connect();
    jest.advanceTimersByTime(400);
    expect(states.slice(-2)).toEqual(['connecting', 'closed']);
    jest.advanceTimersByTime(10_000);
    feed.connect();
    jest.advanceTimersByTime(400);
    expect(states.at(-1)).toBe('open');
  });

  it('continues the sequence from seeded seqs so a re-seeded feed is not mistaken for stale', () => {
    const feed = new SimulatedPriceFeed({ random: createSeededRandom(3) });
    feed.seed(seeds.map((s) => ({ ...s, seq: 500 })));
    const received: WireTick[] = [];
    feed.onTick((t) => received.push(t));
    feed.connect();
    jest.advanceTimersByTime(3_000);
    expect(received.length).toBeGreaterThan(0);
    received.forEach((t) => expect(t.seq).toBeGreaterThan(500));
  });

  it('only streams subscribed symbols', () => {
    const { feed, received } = startFeed();
    feed.subscribe(['WIPRO']);
    jest.advanceTimersByTime(5_000);
    expect(new Set(received.map((r) => r.tick.symbol))).toEqual(new Set(['WIPRO']));
  });
});

describe('tickSizePaise', () => {
  it('follows NSE price bands', () => {
    expect(tickSizePaise(19800)).toBe(1);
    expect(tickSizePaise(97025)).toBe(5);
    expect(tickSizePaise(130790)).toBe(10);
    expect(tickSizePaise(600000)).toBe(50);
    expect(tickSizePaise(1186900)).toBe(100);
    expect(tickSizePaise(2500000)).toBe(500);
  });
});
