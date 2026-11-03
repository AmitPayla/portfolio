import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, useAnimatedStyle, type SharedValue, Extrapolation } from 'react-native-reanimated';
import { formatMoney, formatPercent, formatSignedMoney, trendOf } from '@/domain/format';
import { dayChange } from '@/domain/quote';
import { companyName } from '@/domain/symbols';
import { useLtp, usePrevClose } from '@/state/hooks';
import { AppText } from '@/ui/components/AppText';
import { ChangePill, SymbolAvatar } from '@/ui/components/primitives';
import { PressableScale } from '@/ui/components/PressableScale';
import { PriceFlash } from '@/ui/components/PriceFlash';
import { makeStyles, useTheme } from '@/ui/theme/ThemeProvider';
import { radius, space } from '@/ui/theme/tokens';

export const WATCH_ROW_HEIGHT = 76;

function RemoveAction({ progress }: { readonly progress: SharedValue<number> }) {
  const { colors } = useTheme();
  // Invisible at rest: otherwise the red layer behind the card bleeds through its rounded, hairline edge.
  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.06], [0, 1], Extrapolation.CLAMP),
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.get(), [0, 0.6, 1], [0.6, 0.9, 1.1], Extrapolation.CLAMP) }],
    opacity: interpolate(progress.get(), [0, 0.4], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[styles.action, { backgroundColor: colors.loss }, containerStyle]}>
      <Animated.View style={[styles.actionInner, iconStyle]}>
        <Ionicons name="trash" size={20} color={colors.onLoss} />
        <AppText variant="caption" color={colors.onLoss}>
          Remove
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Watchlist row: last price and day change. Swipe left to remove; a full
 * swipe removes immediately. Subscribes only to its own ltp and prev close.
 */
export const WatchlistRow = memo(function WatchlistRow({
  symbol,
  onOpen,
  onRemove,
}: {
  readonly symbol: string;
  readonly onOpen: (symbol: string) => void;
  readonly onRemove: (symbol: string) => void;
}) {
  const s = useStyles();
  const ltp = useLtp(symbol);
  const prevClose = usePrevClose(symbol);
  const change = useMemo(() => dayChange(ltp == null ? undefined : { ltp, prevClose }), [ltp, prevClose]);
  const trend = trendOf(change?.abs);

  return (
    <Swipeable
      friction={1.6}
      rightThreshold={56}
      overshootFriction={8}
      containerStyle={s.swipeContainer}
      renderRightActions={(progress) => <RemoveAction progress={progress} />}
      onSwipeableOpen={() => onRemove(symbol)}
      testID={`watch-row-${symbol}`}
    >
      <PressableScale
        onPress={() => onOpen(symbol)}
        scaleTo={0.985}
        style={s.row}
        accessibilityRole="button"
        accessibilityLabel={`${symbol}, ${formatMoney(ltp)}, ${formatPercent(change?.pct)} today. Swipe left to remove.`}
        accessibilityActions={[{ name: 'remove', label: 'Remove from watchlist' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'remove' && onRemove(symbol)}
      >
        <SymbolAvatar symbol={symbol} size={44} />
        <View style={styles.names}>
          <AppText variant="heading" numberOfLines={1}>
            {symbol}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {companyName(symbol)}
          </AppText>
        </View>
        <View style={styles.prices}>
          <PriceFlash value={ltp}>
            <AppText variant="heading" numeric>
              {formatMoney(ltp)}
            </AppText>
          </PriceFlash>
          <View style={styles.changeRow}>
            <AppText variant="caption" numeric tone={trend === 'up' ? 'gain' : trend === 'down' ? 'loss' : 'faint'}>
              {formatSignedMoney(change?.abs)}
            </AppText>
            <ChangePill label={formatPercent(change?.pct)} sign={change?.abs ?? null} size="sm" />
          </View>
        </View>
      </PressableScale>
    </Swipeable>
  );
});


const styles = StyleSheet.create({
  names: { flex: 1, gap: 1 },
  prices: { alignItems: 'flex-end', gap: 3 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  action: { flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingRight: space.xl, minWidth: 96, borderRadius: radius.xl },
  actionInner: { alignItems: 'center', gap: 2 },
});

const useStyles = makeStyles((t) => ({
  // No background here: the red only exists on the revealed action, so it can't bleed round the card's edges.
  swipeContainer: { marginHorizontal: space.lg, marginBottom: 10, borderRadius: radius.xl, overflow: 'hidden' },
  row: {
    height: WATCH_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
}));
