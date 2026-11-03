import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { NavigationBar } from 'expo-navigation-bar';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useStore } from 'zustand';
import { SheetHost } from '@/features/sheets/SheetHost';
import { useMarketDataLifecycle } from '@/services/useMarketDataLifecycle';
import { ToastHost } from '@/ui/components/Toast';
import { ThemeProvider, useSystemBarSchemes, useTheme } from '@/ui/theme/ThemeProvider';
import { themePreferenceStore } from '@/ui/theme/themePreference';

void SplashScreen.preventAutoHideAsync();

/** Keeps React Navigation's own colours (screen backgrounds during transitions) on our theme. */
function NavigationTheme({ children }: { readonly children: ReactNode }) {
  const theme = useTheme();
  const navTheme = useMemo(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.colors.bg,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        primary: theme.colors.brand,
      },
    };
  }, [theme]);
  return <NavigationThemeProvider value={navTheme}>{children}</NavigationThemeProvider>;
}

/** Light icons on a dark app and vice versa. Each bar flips when the theme reveal has swept past it. */
function SystemBars() {
  const { statusBar, navigationBar } = useSystemBarSchemes();
  return (
    <>
      <StatusBar style={statusBar === 'dark' ? 'light' : 'dark'} />
      <NavigationBar style={navigationBar === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

function AppStack() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
        // Screens underneath a pushed screen stop rendering while hidden.
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="stock/[symbol]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  // The saved light/dark choice, so the first frame is already in the right theme.
  const themeHydrated = useStore(themePreferenceStore, (s) => s.hydrated);
  useMarketDataLifecycle();

  const ready = (fontsLoaded || fontError !== null) && themeHydrated;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <NavigationTheme>
          <SystemBars />
          <AppStack />
          <SheetHost />
          <ToastHost />
        </NavigationTheme>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
