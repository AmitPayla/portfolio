import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { MarketState, StreamStatus } from '@/state/marketStore';
import { useLoadState, useStream } from '@/state/hooks';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

/** "Prices paused" applies whenever we have prices but they are not currently streaming. */
export function isPricesPaused(status: StreamStatus, hasData: boolean): boolean {
  return hasData && (status === 'paused' || status === 'reconnecting' || status === 'connecting');
}

function PulseDot({ color, pulsing }: { readonly color: string; readonly pulsing: boolean }) {
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.value = pulsing ? withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false) : 0;
  }, [pulsing, ring]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: pulsing ? 0.55 * (1 - ring.value) : 0,
    transform: [{ scale: 1 + ring.value * 1.6 }],
  }));
  return (
    <View style={styles.dotBox}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, ringStyle]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

/** Header pill: LIVE with a breathing dot, or the reason prices are not moving. Long-press opens dev controls. */
export const FeedStatusPill = memo(function FeedStatusPill({ onLongPress }: { readonly onLongPress?: () => void }) {
  const { colors } = useTheme();
  const { status } = useStream();
  const live = status === 'live';
  const label: Record<StreamStatus, string> = {
    idle: 'Offline',
    connecting: 'Connecting',
    live: 'Live',
    paused: 'Paused',
    reconnecting: 'Reconnecting',
    offline: 'Offline',
  };
  const color = live ? colors.gain : status === 'paused' || status === 'reconnecting' ? colors.warn : colors.textFaint;
  return (
    <PressableScale
      onLongPress={onLongPress}
      delayLongPress={450}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={`Price feed ${label[status]}. Long press for simulator controls`}
      testID="feed-status-pill"
      style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <PulseDot color={color} pulsing={live} />
      <AppText variant="micro" color={color}>
        {label[status]}
      </AppText>
    </PressableScale>
  );
});

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
      entering={FadeInDown.springify().damping(16)}
      exiting={FadeOutUp.duration(180)}
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

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dotBox: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
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
