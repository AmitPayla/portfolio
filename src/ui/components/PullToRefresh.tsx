import * as Haptics from 'expo-haptics';
import { useCallback, useEffect } from 'react';
import { Platform, RefreshControl, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { DURATION, EASE_OUT } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 36;
const STROKE = 2.5;
const RING_RADIUS = (SIZE - 14) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
/** Pull distance at which the ring is full; close to where iOS starts the refresh. */
const FULL_PULL = 110;
/** Share of the ring drawn while spinning. */
const SPIN_ARC = 0.72;

/**
 * Pull-to-refresh for the main lists. On iOS the system spinner is hidden
 * and <PullIndicator> draws a branded one instead: its ring fills as you pull
 * and spins while refreshing, all on the UI thread. Android keeps its native
 * Material spinner in brand colours, as its lists don't bounce. Both give a
 * haptic tap the moment a refresh starts.
 *
 *   const pullToRefresh = usePullToRefresh(refresh.inFlight, onRefresh);
 *   <Animated.FlatList onScroll={pullToRefresh.onScroll} refreshControl={pullToRefresh.refreshControl} … />
 *   <PullIndicator pull={pullToRefresh.pull} refreshing={refresh.inFlight} />
 */
export function usePullToRefresh(refreshing: boolean, onRefresh: () => void) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  /** How far the list is pulled past its top, in points (iOS bounce only). */
  const pull = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      pull.set(Math.max(0, -e.contentOffset.y));
    },
  });
  const handleRefresh = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRefresh();
  }, [onRefresh]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      // iOS: hide the system spinner; PullIndicator draws ours.
      tintColor={Platform.OS === 'ios' ? 'transparent' : colors.text}
      colors={[colors.onBrand]}
      progressBackgroundColor={colors.brand}
      progressViewOffset={insets.top}
    />
  );
  return { pull, onScroll, refreshControl };
}

/**
 * The iOS refresh indicator: a small puck under the status bar. It slides
 * down as the list is pulled, its ring filling with the pull, then spins
 * until the refresh ends and slides back up. Renders nothing on Android.
 */
export function PullIndicator({ pull, refreshing }: { readonly pull: SharedValue<number>; readonly refreshing: boolean }) {
  if (Platform.OS !== 'ios') return null;
  return <PullIndicatorIOS pull={pull} refreshing={refreshing} />;
}

function PullIndicatorIOS({ pull, refreshing }: { readonly pull: SharedValue<number>; readonly refreshing: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  /** 1 while refreshing, easing back to 0 after, so the puck leaves smoothly. */
  const active = useSharedValue(refreshing ? 1 : 0);
  const spin = useSharedValue(0);

  useEffect(() => {
    active.set(withTiming(refreshing ? 1 : 0, { duration: DURATION.base, easing: EASE_OUT }));
    if (refreshing) {
      spin.set(0);
      spin.set(withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false));
    } else {
      cancelAnimation(spin);
    }
  }, [refreshing, active, spin]);

  const puckStyle = useAnimatedStyle(() => {
    const shown = Math.max(interpolate(pull.get(), [12, 64], [0, 1], Extrapolation.CLAMP), active.get());
    return {
      opacity: shown,
      transform: [{ translateY: (shown - 1) * 28 }, { scale: 0.85 + 0.15 * shown }],
    };
  });
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));
  const arcProps = useAnimatedProps(() => {
    const filled = interpolate(pull.get(), [0, FULL_PULL], [0, 1], Extrapolation.CLAMP);
    // While refreshing the ring shows a fixed arc that spins; before that it fills with the pull.
    const share = filled + (SPIN_ARC - filled) * active.get();
    return { strokeDashoffset: CIRCUMFERENCE * (1 - share) };
  });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.puck,
        { top: insets.top + space.sm, backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
        puckStyle,
      ]}
    >
      <Animated.View style={ringStyle}>
        <Svg width={SIZE - 4} height={SIZE - 4} viewBox={`0 0 ${SIZE - 4} ${SIZE - 4}`}>
          <Circle cx={(SIZE - 4) / 2} cy={(SIZE - 4) / 2} r={RING_RADIUS} stroke={colors.hairline} strokeWidth={STROKE} fill="none" />
          <AnimatedCircle
            cx={(SIZE - 4) / 2}
            cy={(SIZE - 4) / 2}
            r={RING_RADIUS}
            stroke={colors.brand}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            // Start the ring at 12 o'clock.
            transform={`rotate(-90 ${(SIZE - 4) / 2} ${(SIZE - 4) / 2})`}
            animatedProps={arcProps}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  puck: {
    position: 'absolute',
    alignSelf: 'center',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
