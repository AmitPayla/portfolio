import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatMoney, formatPercent, formatSignedMoney, trendOf } from '@/domain/format';
import { usePortfolioSummary } from '@/state/hooks';
import { AppText } from '@/ui/components/AppText';
import { Skeleton } from '@/ui/components/Skeleton';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, space } from '@/ui/theme/tokens';

/**
 * A % chip in the card's palette. `sign` picks green/red with an arrow; without
 * a sign (e.g. "99.38% priced") it is neutral, because it is not a gain or loss.
 */
function PctChip({ label, sign, testID }: { readonly label: string; readonly sign?: number | null; readonly testID?: string }) {
  const { colors } = useTheme();
  const hero = colors.hero;
  const trend = sign === undefined ? 'flat' : trendOf(sign);
  const color = trend === 'up' ? hero.gain : trend === 'down' ? hero.loss : hero.accent;
  const bg = trend === 'up' ? hero.gainSoft : trend === 'down' ? hero.lossSoft : hero.divider;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]} testID={testID}>
      {trend !== 'flat' ? <Ionicons name={trend === 'up' ? 'caret-up' : 'caret-down'} size={9} color={color} /> : null}
      <AppText variant="caption" numeric color={color}>
        {label}
      </AppText>
    </View>
  );
}

/** One line of the ledger: label, amount in ₹, and its % chip, aligned in columns. */
function LedgerRow({
  label,
  amount,
  amountColor,
  chip,
  testID,
}: {
  readonly label: string;
  readonly amount: string;
  readonly amountColor: string;
  readonly chip: ReactNode;
  readonly testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.ledgerRow} accessible accessibilityLabel={`${label} ${amount}`}>
      <AppText variant="caption" color={colors.hero.muted} style={styles.ledgerLabel}>
        {label}
      </AppText>
      <AppText variant="heading" numeric color={amountColor} style={styles.ledgerAmount} numberOfLines={1} testID={testID}>
        {amount}
      </AppText>
      <View style={styles.ledgerChip}>{chip}</View>
    </View>
  );
}

/**
 * Portfolio totals: current value, invested, total P&L and today's P&L, each
 * in ₹ and %. Subscribes through usePortfolioSummary, which only re-renders
 * this card when one of the displayed numbers changes.
 */
export const SummaryCard = memo(function SummaryCard() {
  const { colors } = useTheme();
  const summary = usePortfolioSummary();
  const hero = colors.hero;
  const priced = summary.pricedCount > 0;
  const dayKnown = summary.pricedCount > summary.dayExcludedCount;
  const unpricedSymbols = summary.unpriced.map((u) => u.symbol).join(', ');
  const moneyColor = (value: number) => {
    const trend = trendOf(value);
    return trend === 'up' ? hero.gain : trend === 'down' ? hero.loss : hero.text;
  };

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
        {formatMoney(priced ? summary.currentValuePaise : null)}
      </AppText>
      <View style={styles.valueChange}>
        <PctChip
          label={formatPercent(priced ? summary.valueVsInvestedPct : null)}
          sign={priced ? summary.pnlPaise : null}
          testID="summary-value-pct"
        />
        <AppText variant="caption" color={hero.muted}>
          vs invested
        </AppText>
      </View>

      <View style={[styles.divider, { backgroundColor: hero.divider }]} />

      <View style={styles.ledger}>
        <LedgerRow
          label="Invested"
          amount={formatMoney(priced ? summary.investedPaise : null)}
          amountColor={hero.text}
          testID="summary-invested"
          chip={<PctChip label={`${formatPercent(summary.pricedInvestedShare, 'negative-only')} priced`} testID="summary-priced-share" />}
        />
        <LedgerRow
          label="Total P&L"
          amount={formatSignedMoney(priced ? summary.pnlPaise : null)}
          amountColor={priced ? moneyColor(summary.pnlPaise) : hero.muted}
          testID="summary-pnl"
          chip={<PctChip label={formatPercent(priced ? summary.pnlPct : null)} sign={priced ? summary.pnlPaise : null} />}
        />
        <LedgerRow
          label="Today's P&L"
          amount={formatSignedMoney(dayKnown ? summary.dayPnlPaise : null)}
          amountColor={dayKnown ? moneyColor(summary.dayPnlPaise) : hero.muted}
          testID="summary-day-pnl"
          chip={<PctChip label={formatPercent(dayKnown ? summary.dayPnlPct : null)} sign={dayKnown ? summary.dayPnlPaise : null} />}
        />
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
      <Skeleton width="35%" height={16} style={{ marginTop: space.md }} />
      <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
      <View style={styles.ledger}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.ledgerRow}>
            <Skeleton width={70} height={12} />
            <View style={styles.ledgerAmount}>
              <Skeleton width="70%" height={16} style={styles.skeletonAmount} />
            </View>
            <Skeleton width={72} height={18} rounded={radius.pill} />
          </View>
        ))}
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
  valueChange: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: space.lg },
  ledger: { gap: space.md },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ledgerLabel: { width: 84 },
  ledgerAmount: { flex: 1, textAlign: 'right', alignItems: 'flex-end' },
  ledgerChip: { width: 108, alignItems: 'flex-end' },
  skeletonAmount: { alignSelf: 'flex-end' },
  note: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, padding: space.md, borderRadius: radius.md },
  noteText: { flex: 1 },
});
