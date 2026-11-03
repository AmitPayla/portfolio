import { paise } from '@/domain/money';
import type { Quote } from '@/domain/quote';
import { OhlcError, type OhlcSnapshot } from '@/data/ohlcApi';
import type { FeedConnectionState, PriceFeed, WireTick } from '@/feed/types';
import { createMarketStore } from '@/state/marketStore';
import { MarketDataService } from '../MarketDataService';

/** A hand-driven feed: tests decide exactly when it opens, closes and ticks. */
class FakeFeed implements PriceFeed {
  tickHandlers = new Set<(t: WireTick) => void>();
  stateHandlers = new Set<(s: FeedConnectionState) => void>();
  connectCalls = 0;
  subscribed: readonly string[] = [];
  connect() {
    this.connectCalls += 1;
    this.setState('connecting');
  }
  disconnect() {
    this.setState('closed');
  }
  subscribe(symbols: readonly string[]) {
    this.subscribed = symbols;
  }
  onTick(h: (t: WireTick) => void) {
    this.tickHandlers.add(h);
    return () => this.tickHandlers.delete(h);
  }
  onStateChange(h: (s: FeedConnectionState) => void) {
    this.stateHandlers.add(h);
    return () => this.stateHandlers.delete(h);
  }
  setState(s: FeedConnectionState) {
    this.stateHandlers.forEach((h) => h(s));
  }
  emit(tick: WireTick) {
    this.tickHandlers.forEach((h) => h(tick));
  }
}

const quote = (symbol: string, ltp: number): Quote => ({
  symbol,
  ltp: paise(ltp),
  open: null,
  high: paise(ltp + 500),
  low: paise(ltp - 500),
  prevClose: paise(ltp),
  volume: 100,
  seq: 0,
  updatedAt: 0,
});

const snapshot = (ltp = 130790): OhlcSnapshot => ({
  quotes: [quote('RELIANCE', ltp), quote('TCS', 249910)],
  missing: ['OLDCO'],
  fetchedAt: 1,
});

function setup(fetchSnapshot: jest.Mock = jest.fn(async () => snapshot())) {
  const feed = new FakeFeed();
  const store = createMarketStore();
  const frames: (() => void)[] = [];
  const onSnapshot = jest.fn();
  const service = new MarketDataService({
    feed,
    store,
    fetchSnapshot,
    symbols: () => ['RELIANCE', 'TCS', 'OLDCO'],
    onSnapshot,
    scheduleFlush: (flush) => frames.push(flush),
    random: () => 0.5,
  });
  const runFrame = () => frames.splice(0).forEach((f) => f());
  return { feed, store, service, fetchSnapshot, onSnapshot, runFrame };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const flushPromises = () => jest.advanceTimersByTimeAsync(0);

describe('MarketDataService', () => {
  it('loads the snapshot once, records missing symbols, then connects the feed', async () => {
    const { service, store, feed, fetchSnapshot, onSnapshot } = setup();
    service.start();
    expect(store.getState().load.status).toBe('loading');
    await flushPromises();
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchSnapshot).toHaveBeenCalledWith(['RELIANCE', 'TCS', 'OLDCO']);
    expect(store.getState().load.status).toBe('ready');
    expect(store.getState().missing).toEqual(['OLDCO']);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(feed.subscribed).toEqual(['RELIANCE', 'TCS']);
    expect(feed.connectCalls).toBe(1);
    // A second start (Fast Refresh, double effect) must not fetch again.
    service.stop();
    service.start();
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('batches ticks into one store update per frame and drops late ones', async () => {
    const { service, store, feed, runFrame } = setup();
    service.start();
    await flushPromises();
    feed.setState('open');
    const before = store.getState().quotes;
    let updates = 0;
    store.subscribe(() => (updates += 1));

    feed.emit({ symbol: 'RELIANCE', seq: 5, ltp: 1310 });
    feed.emit({ symbol: 'RELIANCE', seq: 4, ltp: 1200 }); // late: must be ignored
    feed.emit({ symbol: 'RELIANCE', seq: 6, volume: 150 });
    const updatesBeforeFrame = updates;
    runFrame();

    expect(updates - updatesBeforeFrame).toBe(1);
    const after = store.getState().quotes;
    expect(after.RELIANCE).toMatchObject({ ltp: 131000, volume: 150, seq: 6 });
    expect(after.TCS).toBe(before.TCS); // untouched symbol keeps identity
    expect(service.stats).toMatchObject({ received: 3, applied: 2, stale: 1 });
  });

  it('shows paused when the open feed goes quiet, and live on the next tick', async () => {
    const { service, store, feed, runFrame } = setup();
    service.start();
    await flushPromises();
    feed.setState('open');
    feed.emit({ symbol: 'TCS', seq: 1, ltp: 2500 });
    runFrame();
    expect(store.getState().stream.status).toBe('live');

    jest.advanceTimersByTime(1_000);
    expect(store.getState().stream.status).toBe('live');
    jest.advanceTimersByTime(1_000);
    expect(store.getState().stream.status).toBe('paused');

    feed.emit({ symbol: 'TCS', seq: 2, ltp: 2501 });
    expect(store.getState().stream.status).toBe('live');
  });

  it('reconnects with backoff after an unexpected drop and catches up once over REST', async () => {
    const { service, store, feed, fetchSnapshot } = setup();
    service.start();
    await flushPromises();
    feed.setState('open');

    feed.setState('closed'); // not requested by us
    expect(store.getState().stream.status).toBe('reconnecting');
    expect(feed.connectCalls).toBe(1);
    jest.advanceTimersByTime(1_000); // first backoff step (1s with no jitter at random=0.5)
    expect(feed.connectCalls).toBe(2);

    feed.setState('closed'); // retry failed: next delay doubles
    jest.advanceTimersByTime(1_500);
    expect(feed.connectCalls).toBe(2);
    jest.advanceTimersByTime(500);
    expect(feed.connectCalls).toBe(3);

    feed.setState('open');
    await flushPromises();
    expect(fetchSnapshot).toHaveBeenCalledTimes(2); // initial load + one catch-up
  });

  it('does not reconnect after an intentional pause', async () => {
    const { service, store, feed } = setup();
    service.start();
    await flushPromises();
    feed.setState('open');
    service.pause();
    expect(store.getState().stream.status).toBe('offline');
    jest.advanceTimersByTime(30_000);
    expect(feed.connectCalls).toBe(1);
    service.resume();
    expect(feed.connectCalls).toBe(2);
  });

  it('keeps existing prices when a refresh fails', async () => {
    const fetchSnapshot = jest
      .fn()
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValueOnce(new OhlcError('network', "Couldn't reach the price server"));
    const { service, store } = setup(fetchSnapshot);
    service.start();
    await flushPromises();
    await service.refresh();
    expect(store.getState().quotes.RELIANCE?.ltp).toBe(130790);
    expect(store.getState().refresh).toEqual({ inFlight: false, error: "Couldn't reach the price server" });
    expect(store.getState().load.status).toBe('ready');
  });

  it('shows an error state when the first load fails, and recovers on retry', async () => {
    const fetchSnapshot = jest
      .fn()
      .mockRejectedValueOnce(new OhlcError('timeout', 'The price server took too long to respond'))
      .mockResolvedValueOnce(snapshot());
    const { service, store, feed } = setup(fetchSnapshot);
    service.start();
    await flushPromises();
    expect(store.getState().load).toMatchObject({ status: 'error', error: 'The price server took too long to respond' });
    expect(feed.connectCalls).toBe(0); // nothing to simulate on without a snapshot

    await service.load();
    expect(store.getState().load.status).toBe('ready');
    expect(feed.connectCalls).toBe(1);
  });

  it('lets a REST refresh win over ticks buffered before it arrived', async () => {
    const fetchSnapshot = jest.fn().mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot(129000));
    const { service, store, feed, runFrame } = setup(fetchSnapshot);
    service.start();
    await flushPromises();
    feed.setState('open');
    const refreshing = service.refresh();
    feed.emit({ symbol: 'RELIANCE', seq: 9, ltp: 1400 });
    await refreshing;
    runFrame();
    expect(store.getState().quotes.RELIANCE).toMatchObject({ ltp: 129000, seq: 9 });
  });
});
