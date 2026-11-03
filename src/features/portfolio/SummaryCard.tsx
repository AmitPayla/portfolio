import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatMoney, formatPercent, formatSignedMoney, trendOf } from '@/domain/format';
import type { Paise } from '@/domain/money';
import { usePortfolioSummary } from '@/state/hooks';
import { AppText } from '@/ui/components/AppText';
import { Skeleton } from '@/ui/components/Skeleton';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, space } from '@/ui/theme/tokens';

function Delta({ amount, pct, size = 'md' }: { readonly amount: Paise; readonly pct: number | null; readonly size?: 'md' | 'lg' }) {
  const { colors } = useTheme();
  const trend = trendOf(amount);
  const color = trend === 'up' ? colors.hero.gain : trend === 'down' ? colors.hero.loss : colors.hero.muted;
  const bg = trend === 'up' ? colors.hero.gainSoft : trend === 'down' ? colors.hero.lossSoft : colors.hero.divider;
  return (
    <View style={styles.deltaRow}>
      <AppText variant={size === 'lg' ? 'heading' : 'label'} numeric color={color}>
        {formatSignedMoney(amount)}
      </AppText>
      <View style={[styles.deltaPill, { backgroundColor: bg }]}>
        <AppText variant="caption" numeric color={color}>
          {formatPercent(pct)}
        </AppText>
      </View>
    </View>
  );
}

/**
 * Portfolio totals. Subscribes through usePortfolioSummary, which only
 * re-renders this card when one of the displayed numbers changes.
 */
export const SummaryCard = memo(function SummaryCard() {
  const { colors } = useTheme();
  const summary = usePortfolioSummary();
  const hero = colors.hero;
  const unpricedSymbols = summary.unpriced.map((u) => u.symbol).join(', ');

  return (
    <LinearGradient
      colors={hero.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: hero.border }]}
      testID="summary-card"
    >
      {/* Soft light bloom in the corner, like a premium card. Decorative only. */}
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: hero.glow }]} />
      <View pointerEvents="none" style={[styles.glowSmall, { backgroundColor: hero.glow }]} />
      <View style={styles.headerRow}>
        <AppText variant="micro" color={hero.muted}>
          Current value
        </AppText>
        <View style={[styles.badge, { backgroundColor: hero.divider }]}>
          <Ionicons name="stats-chart" size={13} color={hero.accent} />
        </View>
      </View>
      <AppText variant="display" numeric color={hero.text} testID="summary-current-value" adjustsFontSizeToFit numberOfLines={1}>
        {formatMoney(summary.pricedCount > 0 ? summary.currentValuePaise : null)}
      </AppText>
      <View style={styles.totalReturns}>
        {summary.pricedCount > 0 ? (
          <Delta amount={summary.pnlPaise} pct={summary.pnlPct} size="lg" />
        ) : (
          <AppText variant="heading" color={hero.muted}>
            --
          </AppText>
        )}
        <AppText variant="caption" color={hero.muted}>
          total P&L
        </AppText>
      </View>

      <View style={[styles.divider, { backgroundColor: hero.divider }]} />

      <View style={styles.grid}>
        <View style={styles.cell}>
          <AppText variant="caption" color={hero.muted}>
            Invested
          </AppText>
          <AppText variant="heading" numeric color={hero.text} testID="summary-invested">
            {formatMoney(summary.pricedCount > 0 ? summary.investedPaise : null)}
          </AppText>
        </View>
        <View style={styles.cell}>
          <AppText variant="caption" color={hero.muted}>
            {"Today's P&L"}
          </AppText>
          {summary.pricedCount > summary.dayExcludedCount ? (
            <Delta amount={summary.dayPnlPaise} pct={summary.dayPnlPct} />
          ) : (
            <AppText variant="heading" color={hero.muted}>
              --
            </AppText>
          )}
        </View>
      </View>

      {summary.unpriced.length > 0 ? (
        <View style={[styles.note, { backgroundColor: hero.divider }]} testID="summary-unpriced-note">
          <Ionicons name="information-circle-outline" size={15} color={hero.accent} />
          <AppText variant="caption" color={hero.muted} style={styles.noteText} numeric>
            {`${unpricedSymbols} ${summary.unpriced.length === 1 ? 'has' : 'have'} no live price and ${summary.unpriced.length === 1 ? 'is' : 'are'} left out of these totals (${formatMoney(summary.unpricedInvestedPaise)} invested).`}
          </AppText>
        </View>
      ) : null}
    </LinearGradient>
  );
});

export function SummaryCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
      <Skeleton width={110} height={11} />
      <Skeleton width="70%" height={30} style={{ marginTop: space.md }} />
      <Skeleton width="45%" height={16} style={{ marginTop: space.md }} />
      <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
      <View style={styles.grid}>
        <Skeleton width="40%" height={28} />
        <Skeleton width="40%" height={28} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.lg,
    borderRadius: radius.xl + 4,
    padding: space.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  glow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, top: -120, right: -70 },
  glowSmall: { position: 'absolute', width: 140, height: 140, borderRadius: 70, top: -40, right: -30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  badge: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  totalReturns: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs, flexWrap: 'wrap' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  deltaPill: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: space.lg },
  grid: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg },
  cell: { flex: 1, gap: 3 },
  note: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, padding: space.md, borderRadius: radius.md },
  noteText: { flex: 1 },
});
