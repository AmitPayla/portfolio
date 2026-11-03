import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatMoney, formatPercent, formatShares, formatSignedMoney, trendOf } from '@/domain/format';
import type { Paise } from '@/domain/money';
import { dayChange } from '@/domain/quote';
import { useHoldingMetrics, useHolding, usePrevClose } from '@/state/hooks';
import { AppText } from '@/ui/components/AppText';
import { ChangePill, SymbolAvatar } from '@/ui/components/primitives';
import { PressableScale } from '@/ui/components/PressableScale';
import { PriceFlash } from '@/ui/components/PriceFlash';
import { makeStyles, useTheme } from '@/ui/theme/ThemeProvider';
import { cardShadow, radius, space } from '@/ui/theme/tokens';

/** Fixed height so the list can use getItemLayout (no measuring while scrolling). */
export const HOLDING_ROW_HEIGHT = 124;
export const HOLDING_ROW_GAP = 10;

/** Left half: changes only on a buy/sell, so it skips every price tick. */
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
    <View style={styles.identity}>
      <SymbolAvatar symbol={symbol} />
      <View style={styles.identityText}>
        <AppText variant="heading" numberOfLines={1}>
          {symbol}
        </AppText>
        <AppText variant="caption" tone="muted" numeric numberOfLines={1}>
          {formatShares(qty)} · Avg {formatMoney(avgPricePaise)}
        </AppText>
      </View>
    </View>
  );
});

/**
 * One holding. It subscribes to its own holding, ltp and prev close only, so
 * a tick for RELIANCE re-renders the RELIANCE row and nothing else. A
 * volume-only tick re-renders nothing (ltp is a primitive and did not change).
 */
export const HoldingRow = memo(function HoldingRow({
  symbol,
  onOpen,
}: {
  readonly symbol: string;
  readonly onOpen: (symbol: string) => void;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const holding = useHolding(symbol);
  const metrics = useHoldingMetrics(symbol);
  const prevClose = usePrevClose(symbol);
  if (!holding || !metrics) return null;

  const { ltpPaise, valuePaise, pnlPaise, pnlPct } = metrics;
  const dayPct = dayChange(ltpPaise == null ? undefined : { ltp: ltpPaise, prevClose })?.pct ?? null;
  const pnlTrend = trendOf(pnlPaise);
  const pnlColor = pnlTrend === 'up' ? colors.gain : pnlTrend === 'down' ? colors.loss : colors.textMuted;
  const dayTrend = trendOf(dayPct);

  return (
    <PressableScale
      onPress={() => onOpen(symbol)}
      scaleTo={0.98}
      style={s.card}
      accessibilityRole="button"
      accessibilityLabel={`${symbol}, ${formatShares(holding.qty)}, last price ${formatMoney(ltpPaise)}, P and L ${formatSignedMoney(pnlPaise)}`}
      testID={`holding-row-${symbol}`}
    >
      <View style={styles.top}>
        <RowIdentity symbol={symbol} qty={holding.qty} avgPricePaise={metrics.avgPricePaise} />
        <View style={styles.right}>
          <AppText variant="heading" numeric color={pnlColor} numberOfLines={1}>
            {formatSignedMoney(pnlPaise)}
          </AppText>
          <ChangePill label={formatPercent(pnlPct)} sign={pnlPaise} size="sm" />
        </View>
      </View>
      <View style={s.divider} />
      <View style={styles.bottom}>
        <View style={styles.ltp}>
          <AppText variant="caption" tone="faint">
            LTP
          </AppText>
          <PriceFlash value={ltpPaise}>
            <AppText variant="label" numeric>
              {formatMoney(ltpPaise)}
            </AppText>
          </PriceFlash>
          <AppText variant="caption" numeric tone={dayTrend === 'up' ? 'gain' : dayTrend === 'down' ? 'loss' : 'faint'}>
            {formatPercent(dayPct)}
          </AppText>
        </View>
        <View style={styles.value}>
          <AppText variant="caption" tone="faint">
            Value
          </AppText>
          <AppText variant="label" numeric numberOfLines={1}>
            {formatMoney(valuePaise)}
          </AppText>
        </View>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexShrink: 1 },
  identityText: { flexShrink: 1, gap: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ltp: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
});

const useStyles = makeStyles((t) => ({
  card: {
    height: HOLDING_ROW_HEIGHT,
    marginBottom: HOLDING_ROW_GAP,
    marginHorizontal: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    borderRadius: radius.xl,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    justifyContent: 'space-between',
    ...cardShadow(t),
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.hairline, marginVertical: 2 },
}));
