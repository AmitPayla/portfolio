import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

/**
 * The saved theme. "system" (the default, until the user first taps the
 * light/dark toggle) follows the phone's setting; after that it is "light" or "dark".
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** The scheme to render for a preference, given what the system reports (which can be null). */
export function resolveScheme(preference: ThemePreference, system: string | null | undefined): ColorScheme {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}

interface ThemePreferenceState {
  readonly preference: ThemePreference;
  /** False until storage has been read, so startup never flashes the wrong theme. */
  readonly hydrated: boolean;
}

export function createThemePreferenceStore(storage = AsyncStorage) {
  const store = createStore<ThemePreferenceState>()(
    persist((): ThemePreferenceState => ({ preference: 'system', hydrated: false }), {
      name: 'theme-preference',
      version: 1,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ preference: state.preference }),
      // Storage is untrusted input: anything unexpected falls back to "system".
      merge: (persisted, current) => ({
        ...current,
        preference:
          typeof persisted === 'object' && persisted !== null && 'preference' in persisted && isThemePreference(persisted.preference)
            ? persisted.preference
            : 'system',
      }),
      // Deferred so a synchronous storage (tests) cannot run this before `store` exists.
      onRehydrateStorage: () => () => queueMicrotask(() => store.setState({ hydrated: true })),
    }),
  );
  return store;
}

export const themePreferenceStore = createThemePreferenceStore();
