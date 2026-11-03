import { useMemo, useSyncExternalStore } from 'react';
import type { StoreApi } from 'zustand/vanilla';

/**
 * Subscribes to a slice of a store and re-renders only when that slice
 * changes according to `isEqual`. Same idea as zustand's
 * `useStoreWithEqualityFn`, built directly on React's useSyncExternalStore.
 *
 * Use it for derived values (e.g. portfolio totals): the selector runs on
 * every store update, which is cheap, but the component only re-renders when
 * the derived result is actually different.
 *
 * Keep `selector` and `isEqual` stable (module-level or useCallback).
 */
export function useStoreSelector<S, T>(
  store: StoreApi<S>,
  selector: (state: S) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const getSelection = useMemo(() => {
    let hasMemo = false;
    let memoState: S;
    let memoValue: T;
    return (): T => {
      const state = store.getState();
      if (hasMemo && Object.is(memoState, state)) return memoValue;
      const next = selector(state);
      memoState = state;
      if (hasMemo && isEqual(memoValue, next)) return memoValue;
      hasMemo = true;
      memoValue = next;
      return next;
    };
  }, [store, selector, isEqual]);

  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}
