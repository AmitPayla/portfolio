import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

export type ColorScheme = 'light' | 'dark';

export function isColorScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark';
}

/** What the phone reports, as a scheme. Null or "unspecified" count as light. */
export function systemScheme(value: string | null | undefined): ColorScheme {
  return value === 'dark' ? 'dark' : 'light';
}

/**
 * A tap on the header toggle, and the phone setting it was made against. It
 * holds only until the phone's setting changes; then the app follows the phone again.
 */
export interface ThemeOverride {
  readonly scheme: ColorScheme;
  readonly system: ColorScheme;
}

function isThemeOverride(value: unknown): value is ThemeOverride {
  return (
    typeof value === 'object' &&
    value !== null &&
    'scheme' in value &&
    'system' in value &&
    isColorScheme(value.scheme) &&
    isColorScheme(value.system)
  );
}

/** The scheme to show: the phone's, unless the user toggled since the phone last changed. */
export function resolveScheme(override: ThemeOverride | null, system: ColorScheme): ColorScheme {
  return override && override.system === system ? override.scheme : system;
}

/** The override after the user picks `next`: none when it matches the phone, which resumes following it. */
export function overrideFor(next: ColorScheme, system: ColorScheme): ThemeOverride | null {
  return next === system ? null : { scheme: next, system };
}

interface ThemePreferenceState {
  readonly override: ThemeOverride | null;
  /** False until storage has been read, so startup never flashes the wrong theme. */
  readonly hydrated: boolean;
}

export function createThemePreferenceStore(storage = AsyncStorage) {
  const store = createStore<ThemePreferenceState>()(
    persist((): ThemePreferenceState => ({ override: null, hydrated: false }), {
      name: 'theme-preference',
      version: 1,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ override: state.override }),
      // Storage is untrusted input: anything else, including older saved shapes, means "follow the phone".
      merge: (persisted, current) => ({
        ...current,
        override:
          typeof persisted === 'object' && persisted !== null && 'override' in persisted && isThemeOverride(persisted.override)
            ? persisted.override
            : null,
      }),
      // Deferred so a synchronous storage (tests) cannot run this before `store` exists.
      onRehydrateStorage: () => () => queueMicrotask(() => store.setState({ hydrated: true })),
    }),
  );
  return store;
}

export const themePreferenceStore = createThemePreferenceStore();
