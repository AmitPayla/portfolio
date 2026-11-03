import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, ZoomIn, ZoomOut } from 'react-native-reanimated';
import type { MarketState, StreamStatus } from '@/state/marketStore';
import { useLoadState, useStream } from '@/state/hooks';
import { DURATION, EASE_IN, EASE_OUT } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { AppText } from './AppText';

/** Height of the paused nudge; a card that hosts it offsets it by half, so it straddles the card's top edge. */
export const NUDGE_HEIGHT = 22;

/** "Prices paused" applies whenever we have prices but they are not currently streaming. */
export function isPricesPaused(status: StreamStatus, hasData: boolean): boolean {
  return hasData && (status === 'paused' || status === 'reconnecting' || status === 'connecting');
}

/** Wall-clock time, ticking once a second. Only mounted while the banner shows, so no idle timers. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function PausedDetail({ status, lastTickAt, retryAt }: MarketState['stream']) {
  const now = useNow();
  let detail = 'Waiting for the feed';
  if (status === 'reconnecting') {
    const untilRetry = retryAt == null ? 0 : Math.ceil((retryAt - now) / 1_000);
    detail = untilRetry > 0 ? `Reconnecting in ${untilRetry}s` : 'Reconnecting…';
  } else if (lastTickAt != null) {
    detail = `No updates for ${Math.max(1, Math.round((now - lastTickAt) / 1_000))}s`;
  }
  return detail;
}

/**
 * Floating "Prices paused" banner. It overlays content instead of pushing it
 * down, so its appearance never shifts the list under the user's finger.
 */
export const PausedBanner = memo(function PausedBanner({ top = 0 }: { readonly top?: number }) {
  const { colors } = useTheme();
  const stream = useStream();
  const { status: loadStatus } = useLoadState();
  if (!isPricesPaused(stream.status, loadStatus === 'ready')) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(DURATION.base).easing(EASE_OUT)}
      exiting={FadeOutUp.duration(DURATION.fast).easing(EASE_IN)}
      pointerEvents="none"
      style={[styles.bannerWrap, { top }]}
      accessibilityLiveRegion="polite"
      testID="prices-paused-banner"
    >
      <View style={[styles.banner, { backgroundColor: colors.ink }]}>
        <Ionicons name="pause-circle" size={16} color={colors.warn} />
        <AppText variant="label" color={colors.onInk}>
          Prices paused
        </AppText>
        <View style={[styles.sep, { backgroundColor: colors.onInk }]} />
        <AppText variant="caption" numeric color={colors.onInk} style={styles.detail}>
          <PausedDetail {...stream} />
        </AppText>
      </View>
    </Animated.View>
  );
});

/**
 * "Prices paused" as a tag pinned to the top edge of a card, like a sale
 * badge. It pops in when the feed stalls and shrinks away on the first tick
 * back. The parent positions it absolutely, so it never moves the card's content.
 */
export const PausedNudge = memo(function PausedNudge({ style }: { readonly style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const stream = useStream();
  const { status: loadStatus } = useLoadState();
  if (!isPricesPaused(stream.status, loadStatus === 'ready')) return null;
  // onInk is white in light mode and near-black in dark mode: the readable pair for warn in each theme.
  return (
    <Animated.View
      entering={ZoomIn.duration(DURATION.base).easing(EASE_OUT)}
      exiting={ZoomOut.duration(DURATION.slow).easing(EASE_IN)}
      pointerEvents="none"
      style={[styles.nudge, { backgroundColor: colors.warn }, style]}
      accessibilityLiveRegion="polite"
      testID="prices-paused-nudge"
    >
      <Ionicons name="pause" size={11} color={colors.onInk} />
      <AppText variant="caption" numeric color={colors.onInk}>
        Prices paused · <PausedDetail {...stream} />
      </AppText>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  nudge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: NUDGE_HEIGHT,
    paddingHorizontal: space.sm + 2,
    borderRadius: radius.pill,
  },
  bannerWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    height: 38,
    borderRadius: radius.pill,
  },
  sep: { width: 3, height: 3, borderRadius: 2, opacity: 0.5 },
  detail: { opacity: 0.8 },
});
