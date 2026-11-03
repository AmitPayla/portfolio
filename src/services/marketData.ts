/**
 * Composition root for live data. This is the only file that knows the feed
 * is simulated: to use a real socket, construct a WebSocket PriceFeed here and
 * drop the `seed` call. Nothing else changes.
 */
import { fetchOhlcSnapshot, type OhlcSnapshot } from '@/data/ohlcApi';
import { MARKET_SYMBOLS } from '@/domain/symbols';
import { SimulatedPriceFeed } from '@/feed/simulatedFeed';
import { marketStore } from '@/state/marketStore';
import { portfolioStore } from '@/state/portfolioStore';
import { MarketDataService } from './MarketDataService';

const simulator = new SimulatedPriceFeed({ ticksPerSecond: 20 });

function seedSimulator(snapshot: OhlcSnapshot): void {
  simulator.seed(
    snapshot.quotes.map((q) => ({
      symbol: q.symbol,
      ltpPaise: q.ltp,
      highPaise: q.high,
      lowPaise: q.low,
      volume: q.volume,
    })),
  );
}

export const marketData = new MarketDataService({
  feed: simulator,
  store: marketStore,
  fetchSnapshot: (symbols) => fetchOhlcSnapshot(symbols),
  // OLDCO is requested too: the API leaves it out, which is how we learn it has no price.
  symbols: () => [...new Set([...MARKET_SYMBOLS, ...portfolioStore.getState().symbols])],
  onSnapshot: seedSimulator,
});

/** Dev menu hooks into the simulator. Not used by any screen logic. */
export const feedDevControls = {
  get ticksPerSecond(): number {
    return simulator.ticksPerSecond;
  },
  setTicksPerSecond: (rate: number) => simulator.setTicksPerSecond(rate),
  simulateOutage: (durationMs: number) => simulator.simulateOutage(durationMs),
  stats: () => ({ ...marketData.stats }),
};
