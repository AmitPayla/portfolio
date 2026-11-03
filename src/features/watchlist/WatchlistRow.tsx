import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, useAnimatedStyle, type SharedValue, Extrapolation } from 'react-native-reanimated';
import { formatMoney, formatPercent, formatSignedMoney, MISSING, trendOf } from '@/domain/format';
import { dayChange } from '@/domain/quote';
import { companyName } from '@/domain/symbols';
import { useLtp, usePrevClose } from '@/state/hooks';
import { AppText } from '@/ui/components/AppText';
import { GroupDivider, PressableRow, useGroupedItemStyle } from '@/ui/components/GroupedList';
import { PriceFlash } from '@/ui/components/PriceFlash';
import { makeStyles, useTheme } from '@/ui/theme/ThemeProvider';
import { space } from '@/ui/theme/tokens';

export const WATCH_ROW_HEIGHT = 72;

function RemoveAction({ progress }: { readonly progress: SharedValue<number> }) {
  const { colors } = useTheme();
  // Invisible at rest, so the red layer never shows through the row's edges.
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
 * Watchlist row: symbol and company on the left; last price and day change on
 * the right. Swipe left to remove; a full swipe removes immediately.
 * Subscribes only to its own ltp and prev close.
 */
export const WatchlistRow = memo(function WatchlistRow({
  symbol,
  onOpen,
  onRemove,
  first,
  last,
}: {
  readonly symbol: string;
  readonly onOpen: (symbol: string) => void;
  readonly onRemove: (symbol: string) => void;
  /** Position in the group, for the rounded ends and dividers. */
  readonly first: boolean;
  readonly last: boolean;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const itemStyle = useGroupedItemStyle(first, last, WATCH_ROW_HEIGHT);
  const ltp = useLtp(symbol);
  const prevClose = usePrevClose(symbol);
  const change = useMemo(() => dayChange(ltp == null ? undefined : { ltp, prevClose }), [ltp, prevClose]);
  const trend = trendOf(change?.abs);
  const changeColor = trend === 'up' ? colors.gain : trend === 'down' ? colors.loss : colors.textMuted;
  const changeLabel = change ? `${formatSignedMoney(change.abs)} (${formatPercent(change.pct)})` : MISSING;

  return (
    <Swipeable
      friction={1.6}
      rightThreshold={56}
      overshootFriction={8}
      containerStyle={itemStyle}
      childrenContainerStyle={s.surface}
      renderRightActions={(progress) => <RemoveAction progress={progress} />}
      onSwipeableOpen={() => onRemove(symbol)}
      testID={`watch-row-${symbol}`}
    >
      <PressableRow
        onPress={() => onOpen(symbol)}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${symbol}, ${formatMoney(ltp)}, ${formatPercent(change?.pct)} today. Swipe left to remove.`}
        accessibilityActions={[{ name: 'remove', label: 'Remove from watchlist' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'remove' && onRemove(symbol)}
      >
        <View style={styles.left}>
          <AppText variant="heading" numberOfLines={1}>
            {symbol}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {companyName(symbol)}
          </AppText>
        </View>
        <View style={styles.right}>
          <PriceFlash value={ltp}>
            <AppText variant="heading" numeric>
              {formatMoney(ltp)}
            </AppText>
          </PriceFlash>
          <View style={styles.change}>
            {trend !== 'flat' ? <Ionicons name={trend === 'up' ? 'caret-up' : 'caret-down'} size={10} color={changeColor} /> : null}
            <AppText variant="caption" weight="bold" numeric color={changeColor}>
              {changeLabel}
            </AppText>
          </View>
        </View>
      </PressableRow>
      {last ? null : <GroupDivider />}
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  left: { flexShrink: 1, gap: 4 },
  right: { alignItems: 'flex-end', gap: 4 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 16 },
  action: { flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingRight: space.xl, minWidth: 96 },
  actionInner: { alignItems: 'center', gap: 2 },
});

const useStyles = makeStyles((t) => ({
  // The sliding part: opaque, so the red action only shows where the row has moved away.
  surface: { flex: 1, backgroundColor: t.colors.surface },
}));
