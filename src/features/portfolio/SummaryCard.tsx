import { Ionicons } from '@expo/vector-icons';
import { memo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { formatMoney, formatPercent, formatSignedMoney, trendOf } from '@/domain/format';
import { usePortfolioSummary } from '@/state/hooks';
import { AppText } from '@/ui/components/AppText';
import { Skeleton } from '@/ui/components/Skeleton';
import { THEME_TOGGLE_SIZE, ThemeToggle } from '@/ui/components/ThemeToggle';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, space } from '@/ui/theme/tokens';

// The cutout in the top-right corner holds the theme toggle: an even gap round
// the button, open to the screen edge on the right.
const NOTCH_GAP = 6;
const NOTCH_WIDTH = space.lg + THEME_TOGGLE_SIZE + NOTCH_GAP;
const NOTCH_HEIGHT = THEME_TOGGLE_SIZE + 2 * NOTCH_GAP;
/** The cutout's inner corner is centred on the round button, so the gap stays even. */
const NOTCH_RADIUS = THEME_TOGGLE_SIZE / 2 + NOTCH_GAP;
const EDGE_RADIUS = 12;

/**
 * Outline of the full-width card with the cutout. The sides run 1px past the
 * screen, so only the top, the cutout and the bottom get a border line, and
 * the top and bottom sit half a pixel in so that line isn't clipped.
 */
function cardOutline(width: number, height: number): string {
  const notchX = width - NOTCH_WIDTH;
  const top = 0.5;
  return [
    `M-1 ${top}`,
    `H${notchX - EDGE_RADIUS}`,
    `A${EDGE_RADIUS} ${EDGE_RADIUS} 0 0 1 ${notchX} ${top + EDGE_RADIUS}`,
    `V${NOTCH_HEIGHT - NOTCH_RADIUS}`,
    `A${NOTCH_RADIUS} ${NOTCH_RADIUS} 0 0 0 ${notchX + NOTCH_RADIUS} ${NOTCH_HEIGHT}`,
    `H${width - EDGE_RADIUS}`,
    `A${EDGE_RADIUS} ${EDGE_RADIUS} 0 0 1 ${width} ${NOTCH_HEIGHT + EDGE_RADIUS}`,
    `H${width + 1}`,
    `V${height - 0.5}`,
    'H-1',
    'Z',
  ].join(' ');
}

/**
 * Edge-to-edge card with the theme toggle in a cutout at its top-right corner.
 * The shape is drawn with SVG rather than covered with a patch, so the header
 * wash behind it shows through the cutout in either theme.
 */
function NotchedCard({
  fill,
  stroke,
  glow,
  children,
  testID,
}: {
  /** A solid colour, or a gradient running from the top-left to the bottom-right corner. */
  readonly fill: string | readonly string[];
  readonly stroke: string;
  /** Soft light bloom around the cutout, like a premium card. Decorative only. */
  readonly glow?: string;
  readonly children: ReactNode;
  readonly testID?: string;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
  };
  const outline = size.width > 0 ? cardOutline(size.width, size.height) : null;
  return (
    <View style={styles.card} onLayout={onLayout} testID={testID}>
      {outline ? (
        <Svg style={StyleSheet.absoluteFill} width={size.width} height={size.height} pointerEvents="none">
          <Defs>
            {typeof fill === 'string' ? null : (
              <LinearGradient id="cardFill" x1="0" y1="0" x2="1" y2="1">
                {fill.map((color, i) => (
                  <Stop key={i} offset={i / Math.max(1, fill.length - 1)} stopColor={color} />
                ))}
              </LinearGradient>
            )}
            <ClipPath id="cardClip">
              <Path d={outline} />
            </ClipPath>
          </Defs>
          <Path d={outline} fill={typeof fill === 'string' ? fill : 'url(#cardFill)'} />
          {glow ? (
            <G clipPath="url(#cardClip)">
              <Circle cx={size.width - 50} cy={0} r={120} fill={glow} />
              <Circle cx={size.width - 40} cy={30} r={70} fill={glow} />
            </G>
          ) : null}
          <Path d={outline} fill="none" stroke={stroke} strokeWidth={StyleSheet.hairlineWidth} />
        </Svg>
      ) : null}
      {children}
      {/* Last, so it sits above the content in the touch order too. */}
      <View style={styles.notchButton}>
        <ThemeToggle />
      </View>
    </View>
  );
}

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
  const moneyColor = (value: number) => {
    const trend = trendOf(value);
    return trend === 'up' ? hero.gain : trend === 'down' ? hero.loss : hero.text;
  };

  return (
    <NotchedCard fill={hero.gradient} stroke={hero.border} glow={hero.glow} testID="summary-card">
      <View style={styles.headerRow}>
        <AppText variant="micro" color={hero.muted}>
          Current value
        </AppText>
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
    </NotchedCard>
  );
});

export function SummaryCardSkeleton() {
  const { colors } = useTheme();
  return (
    <NotchedCard fill={colors.surface} stroke={colors.border}>
      <View style={styles.headerRow}>
        <Skeleton width={110} height={11} />
      </View>
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
    </NotchedCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.xl },
  notchButton: { position: 'absolute', top: NOTCH_GAP, right: space.lg },
  // Tall enough that the big value below starts under the cutout, never beside it.
  headerRow: { minHeight: NOTCH_HEIGHT - space.xl, justifyContent: 'center', marginBottom: 2 },
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
});
