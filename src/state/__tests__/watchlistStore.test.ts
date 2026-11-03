import type AsyncStorage from '@react-native-async-storage/async-storage';
import { createWatchlistStore, DEFAULT_WATCHLIST, sanitizeWatchlist } from '../watchlistStore';

/** In-memory AsyncStorage stand-in that survives "restarts" (new store instances). */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    storage: {
      getItem: async (key: string) => data.get(key) ?? null,
      setItem: async (key: string, value: string) => void data.set(key, value),
      removeItem: async (key: string) => void data.delete(key),
    } as unknown as typeof AsyncStorage,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('watchlist store', () => {
  it('starts with defaults and reports when hydration finished', async () => {
    const { storage } = memoryStorage();
    const store = createWatchlistStore(storage);
    expect(store.getState().hydrated).toBe(false);
    await settle();
    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().symbols).toEqual([...DEFAULT_WATCHLIST]);
  });

  it('survives a restart', async () => {
    const { storage } = memoryStorage();
    const first = createWatchlistStore(storage);
    await settle();
    first.getState().add('TCS');
    first.getState().remove('ONGC');
    await settle();

    const afterRestart = createWatchlistStore(storage);
    await settle();
    expect(afterRestart.getState().symbols).toEqual(['HCLTECH', 'TATASTEEL', 'POWERGRID', 'ADANIENT', 'TCS']);
  });

  it('keeps an emptied watchlist empty after a restart', async () => {
    const { storage } = memoryStorage();
    const store = createWatchlistStore(storage);
    await settle();
    DEFAULT_WATCHLIST.forEach((s) => store.getState().remove(s));
    await settle();
    const afterRestart = createWatchlistStore(storage);
    await settle();
    expect(afterRestart.getState().symbols).toEqual([]);
  });

  it('ignores duplicates, unknown symbols and restores at the old position', async () => {
    const { storage } = memoryStorage();
    const store = createWatchlistStore(storage);
    await settle();
    store.getState().add('HCLTECH');
    store.getState().add('NOTREAL');
    expect(store.getState().symbols).toEqual([...DEFAULT_WATCHLIST]);
    store.getState().remove('ONGC');
    store.getState().restore('ONGC', 2);
    expect(store.getState().symbols).toEqual([...DEFAULT_WATCHLIST]);
  });

  it('sanitizes corrupted storage', () => {
    expect(sanitizeWatchlist(['TCS', 'TCS', 'FAKE', 42, null])).toEqual(['TCS']);
    expect(sanitizeWatchlist('garbage')).toEqual([...DEFAULT_WATCHLIST]);
  });
});
