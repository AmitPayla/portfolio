import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatMoney, formatPercent, formatShares, formatSignedMoney, trendOf } from '@/domain/format';
import type { Paise } from '@/domain/money';
import { useHolding, useHoldingMetrics } from '@/state/hooks';
import { AppText } from '@/ui/components/AppText';
import { GroupDivider, PressableRow, useGroupedItemStyle } from '@/ui/components/GroupedList';
import { PriceFlash } from '@/ui/components/PriceFlash';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { space } from '@/ui/theme/tokens';

/** Fixed height so the list can use getItemLayout (no measuring while scrolling). */
export const HOLDING_ROW_HEIGHT = 92;

/** Symbol and position size: changes only on a buy/sell, so it skips every price tick. */
const RowIdentity = memo(function RowIdentity({
  symbol,
  qty,
  avgPricePaise,
}: {
  readonly symbol: string;
  readonly qty: number;
  readonly avgPricePaise: Paise;
}) {
  return (
    <>
      <AppText variant="heading" numberOfLines={1}>
        {symbol}
      </AppText>
      <AppText variant="caption" tone="muted" numeric numberOfLines={1}>
        {formatShares(qty)} · Avg {formatMoney(avgPricePaise)}
      </AppText>
    </>
  );
});

/**
 * One holding, laid out as two aligned columns: who and what price on the
 * left; P&L ₹, P&L % and value on the right, so numbers line up down the list.
 *
 * It subscribes to its own holding, ltp and prev close only, so a tick for
 * RELIANCE re-renders the RELIANCE row and nothing else. A volume-only tick
 * re-renders nothing (ltp is a primitive and did not change).
 */
export const HoldingRow = memo(function HoldingRow({
  symbol,
  onOpen,
  first,
  last,
}: {
  readonly symbol: string;
  readonly onOpen: (symbol: string) => void;
  /** Position in the group, for the rounded ends and dividers. */
  readonly first: boolean;
  readonly last: boolean;
}) {
  const { colors } = useTheme();
  const itemStyle = useGroupedItemStyle(first, last, HOLDING_ROW_HEIGHT);
  const holding = useHolding(symbol);
  const metrics = useHoldingMetrics(symbol);
  if (!holding || !metrics) return null;

  const { ltpPaise, valuePaise, pnlPaise, pnlPct } = metrics;
  const trend = trendOf(pnlPaise);
  const pnlColor = trend === 'up' ? colors.gain : trend === 'down' ? colors.loss : colors.textMuted;

  return (
    <View style={itemStyle}>
      <PressableRow
        onPress={() => onOpen(symbol)}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${symbol}, ${formatShares(holding.qty)}, last price ${formatMoney(ltpPaise)}, P and L ${formatSignedMoney(pnlPaise)}, ${formatPercent(pnlPct)}`}
        testID={`holding-row-${symbol}`}
      >
        <View style={styles.left}>
          <RowIdentity symbol={symbol} qty={holding.qty} avgPricePaise={metrics.avgPricePaise} />
          <View style={styles.ltp}>
            <AppText variant="caption" tone="faint">
              LTP
            </AppText>
            <PriceFlash value={ltpPaise}>
              <AppText variant="caption" weight="bold" numeric>
                {formatMoney(ltpPaise)}
              </AppText>
            </PriceFlash>
          </View>
        </View>
        <View style={styles.right}>
          <AppText variant="heading" numeric color={pnlColor} numberOfLines={1}>
            {formatSignedMoney(pnlPaise)}
          </AppText>
          <View style={styles.pct}>
            {trend !== 'flat' ? <Ionicons name={trend === 'up' ? 'caret-up' : 'caret-down'} size={10} color={pnlColor} /> : null}
            <AppText variant="caption" weight="bold" numeric color={pnlColor}>
              {formatPercent(pnlPct)}
            </AppText>
          </View>
          <View style={styles.ltp}>
            <AppText variant="caption" tone="faint">
              Value
            </AppText>
            <AppText variant="caption" weight="bold" numeric numberOfLines={1}>
              {formatMoney(valuePaise)}
            </AppText>
          </View>
        </View>
      </PressableRow>
      {last ? null : <GroupDivider />}
    </View>
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
  ltp: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pct: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 16 },
});
