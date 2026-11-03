import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { darkTheme, lightTheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(lightTheme);

/**
 * Follows the system light/dark setting. The context value only changes when
 * the scheme flips, so consumers re-render on that, never on price ticks.
 */
export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  useEffect(() => {
    // Root view colour shows during screen transitions; keep it in step with the theme.
    void SystemUI.setBackgroundColorAsync(theme.colors.bg);
  }, [theme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

type NamedStyles = { readonly [key: string]: ViewStyle | TextStyle | ImageStyle };

/**
 * Builds a StyleSheet once per theme and caches it, so components don't
 * recreate style objects on every render (which would also defeat memo()).
 *
 *   const useStyles = makeStyles((t) => ({ row: { backgroundColor: t.colors.surface } }));
 */
export function makeStyles<S extends NamedStyles>(factory: (theme: Theme) => S & NamedStyles) {
  const cache = new WeakMap<Theme, Readonly<S>>();
  return function useStyles(): Readonly<S> {
    const theme = useTheme();
    return useMemo(() => {
      const cached = cache.get(theme);
      if (cached) return cached;
      const created = StyleSheet.create(factory(theme));
      cache.set(theme, created);
      return created;
    }, [theme]);
  };
}
