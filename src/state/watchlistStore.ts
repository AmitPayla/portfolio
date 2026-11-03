import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { isMarketSymbol } from '@/domain/symbols';

export interface WatchlistState {
  readonly symbols: readonly string[];
  /** False until the persisted list has been read, so screens don't flash "empty". */
  readonly hydrated: boolean;
  add(symbol: string): void;
  remove(symbol: string): void;
  /** Re-inserts a removed symbol at its old position (undo). */
  restore(symbol: string, index: number): void;
}

/** First-run list: the tradable symbols not already in the bundled holdings. */
export const DEFAULT_WATCHLIST = ['HCLTECH', 'TATASTEEL', 'ONGC', 'POWERGRID', 'ADANIENT'] as const;

/** Keeps only known, unique symbols; anything else in storage is dropped. */
export function sanitizeWatchlist(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_WATCHLIST];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string' && isMarketSymbol(item)) seen.add(item);
  }
  return [...seen];
}

export function createWatchlistStore(storage = AsyncStorage) {
  let store: StoreApi<WatchlistState> | undefined;
  // Deferred because a synchronous storage (tests) can finish before `store` is assigned.
  const markHydrated = () => queueMicrotask(() => store?.setState({ hydrated: true }));

  const created = createStore<WatchlistState>()(
    persist(
      (set, get) => ({
        symbols: [...DEFAULT_WATCHLIST],
        hydrated: false,
        add: (symbol) => {
          if (!isMarketSymbol(symbol) || get().symbols.includes(symbol)) return;
          set({ symbols: [...get().symbols, symbol] });
        },
        remove: (symbol) => set({ symbols: get().symbols.filter((s) => s !== symbol) }),
        restore: (symbol, index) => {
          const current = get().symbols;
          if (current.includes(symbol) || !isMarketSymbol(symbol)) return;
          const at = Math.max(0, Math.min(index, current.length));
          set({ symbols: [...current.slice(0, at), symbol, ...current.slice(at)] });
        },
      }),
      {
        name: 'watchlist',
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ symbols: state.symbols }),
        merge: (persisted, current) => ({
          ...current,
          // Storage is untrusted input: narrow it instead of casting it.
          symbols: sanitizeWatchlist(
            typeof persisted === 'object' && persisted !== null && 'symbols' in persisted ? persisted.symbols : undefined,
          ),
        }),
        // Runs after the merge, or after a failed read: either way the list is final now.
        onRehydrateStorage: () => (_state, error) => {
          if (error && __DEV__) console.warn('Watchlist restore failed; using defaults', error);
          markHydrated();
        },
      },
    ),
  );
  store = created;
  return created;
}

export type WatchlistStore = ReturnType<typeof createWatchlistStore>;

export const watchlistStore = createWatchlistStore();
