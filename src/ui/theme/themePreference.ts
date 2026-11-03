import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

export type ColorScheme = 'light' | 'dark';

/** The app starts dark; the header toggle switches theme and the choice is saved. */
export const DEFAULT_SCHEME: ColorScheme = 'dark';

export function isColorScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark';
}

interface ThemePreferenceState {
  /** The scheme the user last chose, or the default until they choose. */
  readonly preference: ColorScheme;
  /** False until storage has been read, so startup never flashes the wrong theme. */
  readonly hydrated: boolean;
}

export function createThemePreferenceStore(storage = AsyncStorage) {
  const store = createStore<ThemePreferenceState>()(
    persist((): ThemePreferenceState => ({ preference: DEFAULT_SCHEME, hydrated: false }), {
      name: 'theme-preference',
      version: 1,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ preference: state.preference }),
      // Storage is untrusted input: anything else, including an older "system" value, means the default.
      merge: (persisted, current) => ({
        ...current,
        preference:
          typeof persisted === 'object' && persisted !== null && 'preference' in persisted && isColorScheme(persisted.preference)
            ? persisted.preference
            : DEFAULT_SCHEME,
      }),
      // Deferred so a synchronous storage (tests) cannot run this before `store` exists.
      onRehydrateStorage: () => () => queueMicrotask(() => store.setState({ hydrated: true })),
    }),
  );
  return store;
}

export const themePreferenceStore = createThemePreferenceStore();
