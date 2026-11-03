import { Skia, type SkImage } from '@shopify/react-native-skia';
import * as SystemUI from 'expo-system-ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { findNodeHandle, StyleSheet, useColorScheme, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { Easing, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useStore } from 'zustand';
import { CircularReveal, type RevealFrame } from './CircularReveal';
import { revealRadius, type ScreenEdge } from './revealMath';
import { resolveScheme, themePreferenceStore, type ColorScheme } from './themePreference';
import { darkTheme, lightTheme, type Theme } from './tokens';

/** Long enough to read as a wave, short enough not to feel slow. */
export const REVEAL_DURATION_MS = 720;
/** Gentle start, long soft landing: the edge slows as it nears the far corner. */
const REVEAL_EASING = Easing.bezier(0.45, 0, 0.15, 1);
/**
 * Frames between mounting the overlay and switching the theme under it. Skia
 * draws a new canvas as soon as its surface exists and Android shows that on
 * the next frame; the third frame is margin. Switching sooner could flash the
 * new theme across the whole screen.
 */
const OVERLAY_SETTLE_FRAMES = 3;

export interface RevealOrigin {
  /** Tap position in window coordinates (an event's pageX / pageY). */
  readonly x: number;
  readonly y: number;
}

/** Switches light ↔ dark. With an origin, the new theme spreads as a circle from that point. */
export type ToggleTheme = (origin?: RevealOrigin) => void;

/** The scheme each system bar's icons should suit. */
export interface SystemBarSchemes {
  readonly statusBar: ColorScheme;
  readonly navigationBar: ColorScheme;
}

const ThemeContext = createContext<Theme>(lightTheme);
const ToggleContext = createContext<ToggleTheme | null>(null);
const SystemBarsContext = createContext<SystemBarSchemes>({ statusBar: 'light', navigationBar: 'light' });

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function waitFrames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) await nextFrame();
}

/** Snapshot of a native view as a GPU image (what Skia's makeImageFromView does, with RN 0.88's ref types). */
function snapshotView(view: ComponentRef<typeof View> | null): Promise<SkImage | null> {
  const tag = view ? findNodeHandle(view) : null;
  return tag ? Skia.Image.MakeImageFromViewTag(tag) : Promise.resolve(null);
}

const bothBars = (scheme: ColorScheme): SystemBarSchemes => ({ statusBar: scheme, navigationBar: scheme });

interface PendingChange {
  readonly scheme: ColorScheme;
  readonly origin?: RevealOrigin;
}

/**
 * Provides the theme to the whole app and owns light/dark transitions. The
 * theme context only changes when the scheme flips, so consumers re-render on
 * that, never on price ticks.
 *
 * A reveal works like this:
 *   1. snapshot the app as it looks now (old theme);
 *   2. lay the snapshot over the app, so the screen looks unchanged;
 *   3. switch the real theme underneath (hidden by the snapshot);
 *   4. cut a circular hole in the snapshot at the tap point and grow it until
 *      it reaches the farthest corner, uncovering the live app in the new theme;
 *   5. drop the overlay.
 * The app is never remounted, so screen state and scroll positions survive.
 * Taps during a reveal are queued and the latest wins, so the theme always
 * ends where the last tap pointed.
 */
export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const system = useColorScheme();
  const preference = useStore(themePreferenceStore, (s) => s.preference);
  const target = resolveScheme(preference, system);
  const reduceMotion = useReducedMotion();

  const [applied, setApplied] = useState<ColorScheme>(target);
  const [bars, setBars] = useState<SystemBarSchemes>(() => bothBars(target));
  const [frame, setFrame] = useState<RevealFrame | null>(null);

  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const size = useRef({ width: 0, height: 0 });
  const radius = useSharedValue(0);
  const appliedRef = useRef(applied);
  /** Where the theme is heading: the latest request, even if it is still queued. */
  const intended = useRef(applied);
  const busy = useRef(false);
  const queued = useRef<PendingChange | null>(null);
  const reduceMotionRef = useRef(reduceMotion);
  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  const applyNow = useCallback((scheme: ColorScheme) => {
    appliedRef.current = scheme;
    setApplied(scheme);
    setBars(bothBars(scheme));
  }, []);

  // `run` and `finish` call each other across async boundaries; a ref keeps `run` current.
  const runRef = useRef<(change: PendingChange) => void>(() => undefined);

  const finish = useCallback(() => {
    busy.current = false;
    setBars(bothBars(appliedRef.current));
    setFrame(null);
    const next = queued.current;
    queued.current = null;
    if (next) runRef.current(next);
  }, []);

  const run = useCallback(
    async ({ scheme, origin }: PendingChange) => {
      intended.current = scheme;
      if (busy.current) {
        queued.current = { scheme, origin };
        return;
      }
      if (scheme === appliedRef.current) return;
      const { width, height } = size.current;
      if (!origin || reduceMotionRef.current || width === 0 || height === 0) {
        applyNow(scheme);
        return;
      }

      busy.current = true; // set before the first await, so a second tap queues instead of racing
      const image = await snapshotView(rootRef.current).catch(() => null);
      if (!image) {
        // Could not snapshot (rare): switch without the animation rather than not at all.
        applyNow(scheme);
        finish();
        return;
      }

      radius.set(0);
      setFrame({ image, cx: origin.x, cy: origin.y, width, height });
      await waitFrames(OVERLAY_SETTLE_FRAMES);
      appliedRef.current = scheme;
      setApplied(scheme);
      await nextFrame(); // let the new theme reach the screen before the circle opens
      radius.set(
        withTiming(revealRadius(origin.x, origin.y, width, height), { duration: REVEAL_DURATION_MS, easing: REVEAL_EASING }, () => {
          scheduleOnRN(finish);
        }),
      );
    },
    [applyNow, finish, radius],
  );
  useEffect(() => {
    runRef.current = (change) => void run(change);
  }, [run]);

  // Free each snapshot's native memory once its overlay is gone.
  useEffect(() => () => frame?.image.dispose(), [frame]);

  // The phone's light/dark setting changed (while the user has not picked one) or storage
  // hydrated: switch without a reveal, as there is no tap to start it from.
  useEffect(() => {
    if (target !== intended.current) void run({ scheme: target });
  }, [target, run]);

  const theme = applied === 'dark' ? darkTheme : lightTheme;
  useEffect(() => {
    // Root view colour shows during navigation transitions; keep it in step with the theme.
    void SystemUI.setBackgroundColorAsync(theme.colors.bg);
  }, [theme]);

  const toggle = useCallback<ToggleTheme>(
    (origin) => {
      // Relative to where the theme is heading, so quick repeated taps alternate as expected.
      const next: ColorScheme = intended.current === 'dark' ? 'light' : 'dark';
      void run({ scheme: next, origin });
      themePreferenceStore.setState({ preference: next });
    },
    [run],
  );

  const onEdgeCovered = useCallback((edge: ScreenEdge) => {
    const scheme = appliedRef.current;
    setBars((current) => (edge === 'top' ? { ...current, statusBar: scheme } : { ...current, navigationBar: scheme }));
  }, []);

  return (
    <ThemeContext.Provider value={theme}>
      <ToggleContext.Provider value={toggle}>
        <SystemBarsContext.Provider value={bars}>
          <View style={styles.fill}>
            <View
              ref={rootRef}
              collapsable={false}
              style={styles.fill}
              onLayout={(e) => {
                size.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
              }}
            >
              {children}
            </View>
            {frame ? <CircularReveal frame={frame} radius={radius} onEdgeCovered={onEdgeCovered} /> : null}
          </View>
        </SystemBarsContext.Provider>
      </ToggleContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export function useThemeToggle(): ToggleTheme {
  const toggle = useContext(ToggleContext);
  if (!toggle) throw new Error('useThemeToggle must be used inside ThemeProvider');
  return toggle;
}

/** Scheme for the status bar (top) and navigation bar (bottom) icons; during a reveal each flips once the circle has covered its edge. */
export function useSystemBarSchemes(): SystemBarSchemes {
  return useContext(SystemBarsContext);
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

const styles = StyleSheet.create({ fill: { flex: 1 } });
