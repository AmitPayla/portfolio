import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { formatCount, formatMoney, formatPercent, formatShares, formatSignedMoney, trendOf } from '@/domain/format';
import { dayChange } from '@/domain/quote';
import { useHolding, useHoldingMetrics, useLtp, usePrevClose, useQuote } from '@/state/hooks';
import { LiveLineChart } from '@/ui/charts/LiveLineChart';
import { AppText } from '@/ui/components/AppText';
import { Card, ChangePill } from '@/ui/components/primitives';
import { PriceFlash } from '@/ui/components/PriceFlash';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, space } from '@/ui/theme/tokens';
import { useLiveSeries } from './useLiveSeries';

// ── Price hero ───────────────────────────────────────────────────────────

export const PriceHero = memo(function PriceHero({ symbol }: { readonly symbol: string }) {
  const ltp = useLtp(symbol);
  const prevClose = usePrevClose(symbol);
  const change = dayChange(ltp == null ? undefined : { ltp, prevClose });
  const trend = trendOf(change?.abs);
  return (
    <View style={styles.hero}>
      <PriceFlash value={ltp} style={styles.heroFlash}>
        <AppText variant="display" numeric testID="detail-ltp" style={styles.heroPrice}>
          {formatMoney(ltp)}
        </AppText>
      </PriceFlash>
      <View style={styles.heroChange}>
        <AppText variant="heading" numeric tone={trend === 'up' ? 'gain' : trend === 'down' ? 'loss' : 'muted'}>
          {formatSignedMoney(change?.abs)}
        </AppText>
        <ChangePill label={formatPercent(change?.pct)} sign={change?.abs ?? null} />
        <AppText variant="caption" tone="faint">
          today
        </AppText>
      </View>
    </View>
  );
});

// ── Live chart ───────────────────────────────────────────────────────────

export const LiveChartCard = memo(function LiveChartCard({ symbol }: { readonly symbol: string }) {
  const { colors } = useTheme();
  const points = useLiveSeries(symbol);
  const first = points[0]?.v;
  const last = points[points.length - 1]?.v;
  const sessionTrend = first == null || last == null ? 'flat' : trendOf(last - first);
  const color = sessionTrend === 'down' ? colors.loss : sessionTrend === 'up' ? colors.gain : colors.textMuted;
  return (
    <Card style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <AppText variant="label">Since you opened</AppText>
        <AppText variant="caption" tone="muted" numeric>
          {points.length} {points.length === 1 ? 'tick' : 'ticks'}
        </AppText>
      </View>
      {points.length > 0 ? (
        <LiveLineChart points={points} color={color} height={150} />
      ) : (
        <View style={styles.chartEmpty}>
          <AppText variant="caption" tone="muted">
            No price to chart yet
          </AppText>
        </View>
      )}
    </Card>
  );
});

// ── Day range ────────────────────────────────────────────────────────────

function DayRange({ low, high, ltp }: { readonly low: number | null; readonly high: number | null; readonly ltp: number | null }) {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useSharedValue(0.5);
  const known = low != null && high != null && ltp != null && high > low;
  useEffect(() => {
    if (!known) return;
    position.value = withTiming(Math.min(1, Math.max(0, (ltp - low) / (high - low))), { duration: 260 });
  }, [known, ltp, low, high, position]);
  const markerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * trackWidth - 7 }] }));
  return (
    <View style={styles.range}>
      <View style={[styles.track, { backgroundColor: colors.sunken }]} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <View style={[styles.trackFill, { backgroundColor: colors.brandSoft }]} />
        {known ? <Animated.View style={[styles.marker, { backgroundColor: colors.ink, borderColor: colors.surface }, markerStyle]} /> : null}
      </View>
    </View>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────

function Stat({ label, value, testID }: { readonly label: string; readonly value: string; readonly testID?: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="label" numeric testID={testID}>
        {value}
      </AppText>
    </View>
  );
}

export const StatsCard = memo(function StatsCard({ symbol }: { readonly symbol: string }) {
  const quote = useQuote(symbol);
  return (
    <Card style={styles.card}>
      <AppText variant="heading" style={styles.cardTitle}>
        Market today
      </AppText>
      <View style={styles.rangeLabels}>
        <Stat label="Day low" value={formatMoney(quote?.low)} />
        <View style={styles.rangeRight}>
          <Stat label="Day high" value={formatMoney(quote?.high)} />
        </View>
      </View>
      <DayRange low={quote?.low ?? null} high={quote?.high ?? null} ltp={quote?.ltp ?? null} />
      <View style={styles.grid}>
        <Stat label="Open" value={formatMoney(quote?.open)} testID="stat-open" />
        <Stat label="Prev. close" value={formatMoney(quote?.prevClose)} testID="stat-prev-close" />
        <Stat label="Volume" value={formatCount(quote?.volume)} testID="stat-volume" />
      </View>
    </Card>
  );
});

// ── Position ─────────────────────────────────────────────────────────────

export const PositionCard = memo(function PositionCard({ symbol }: { readonly symbol: string }) {
  const { colors } = useTheme();
  const holding = useHolding(symbol);
  const metrics = useHoldingMetrics(symbol);
  if (!holding || !metrics) return null;
  const pnlTrend = trendOf(metrics.pnlPaise);
  const dayTrend = trendOf(metrics.dayPnlPaise);
  return (
    <Card style={styles.card}>
      <View style={styles.positionHeader}>
        <AppText variant="heading">Your position</AppText>
        <View style={[styles.qtyBadge, { backgroundColor: colors.brandSoft }]}>
          <AppText variant="caption" weight="extrabold" color={colors.brand} numeric>
            {formatShares(holding.qty)}
          </AppText>
        </View>
      </View>
      <View style={styles.grid}>
        <Stat label="Avg. price" value={formatMoney(metrics.avgPricePaise)} testID="position-avg" />
        <Stat label="Invested" value={formatMoney(metrics.investedPaise)} testID="position-invested" />
        <Stat label="Current value" value={formatMoney(metrics.valuePaise)} testID="position-value" />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
      <View style={styles.pnlRow}>
        <View style={styles.pnlCell}>
          <AppText variant="caption" tone="muted">
            Total P&L
          </AppText>
          <AppText variant="heading" numeric tone={pnlTrend === 'up' ? 'gain' : pnlTrend === 'down' ? 'loss' : 'muted'}>
            {formatSignedMoney(metrics.pnlPaise)}
          </AppText>
          <ChangePill label={formatPercent(metrics.pnlPct)} sign={metrics.pnlPaise} size="sm" />
        </View>
        <View style={styles.pnlCell}>
          <AppText variant="caption" tone="muted">
            {"Today's P&L"}
          </AppText>
          <AppText variant="heading" numeric tone={dayTrend === 'up' ? 'gain' : dayTrend === 'down' ? 'loss' : 'muted'}>
            {formatSignedMoney(metrics.dayPnlPaise)}
          </AppText>
          <ChangePill label={formatPercent(metrics.dayPnlPct)} sign={metrics.dayPnlPaise} size="sm" />
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, gap: space.xs },
  heroFlash: { alignSelf: 'flex-start', borderRadius: radius.md, paddingHorizontal: 6, marginHorizontal: -6 },
  heroPrice: { fontSize: 36, lineHeight: 44 },
  heroChange: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  card: { marginHorizontal: space.lg, marginBottom: space.md, padding: space.lg },
  cardTitle: { marginBottom: space.md },
  chartCard: { marginHorizontal: space.lg, marginBottom: space.md, paddingVertical: space.lg, paddingHorizontal: space.md },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xs, marginBottom: space.sm },
  chartEmpty: { height: 150, alignItems: 'center', justifyContent: 'center' },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeRight: { alignItems: 'flex-end' },
  range: { marginTop: space.sm, marginBottom: space.lg },
  track: { height: 8, borderRadius: 4, justifyContent: 'center' },
  trackFill: { ...StyleSheet.absoluteFill, borderRadius: 4 },
  marker: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2.5 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  stat: { gap: 2, flexShrink: 1 },
  positionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  qtyBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: space.md },
  pnlRow: { flexDirection: 'row', gap: space.lg },
  pnlCell: { flex: 1, gap: 3 },
});
