import { Ionicons } from '@expo/vector-icons';
import { memo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { formatMoney, formatPercent, formatSignedMoney, trendOf } from '@/domain/format';
import type { Paise } from '@/domain/money';
import { describeUnpriced } from '@/domain/portfolio';
import { usePortfolioSummary } from '@/state/hooks';
import { AppText } from '@/ui/components/AppText';
import { NUDGE_HEIGHT, PausedNudge } from '@/ui/components/FeedStatus';
import { Skeleton } from '@/ui/components/Skeleton';
import { THEME_TOGGLE_SIZE, ThemeToggle } from '@/ui/components/ThemeToggle';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { space } from '@/ui/theme/tokens';

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

interface CardPaint {
  /** A solid colour, or a gradient running from the top-left to the bottom-right corner. */
  readonly fill: string | readonly string[];
  readonly stroke: string;
  /** Soft light bloom around the cutout, like a premium card. Decorative only. */
  readonly glow?: string;
}

/**
 * The card's shape, gradient and glow. Memoised on its size and colours, so a
 * price tick re-renders only the numbers on top, not this SVG.
 */
const CardBackground = memo(function CardBackground({
  width,
  height,
  fill,
  stroke,
  glow,
}: CardPaint & { readonly width: number; readonly height: number }) {
  const outline = cardOutline(width, height);
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
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
          <Circle cx={width - 50} cy={0} r={120} fill={glow} />
          <Circle cx={width - 40} cy={30} r={70} fill={glow} />
        </G>
      ) : null}
      <Path d={outline} fill="none" stroke={stroke} strokeWidth={StyleSheet.hairlineWidth} />
    </Svg>
  );
});

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
}: CardPaint & {
  readonly children: ReactNode;
  readonly testID?: string;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
  };
  return (
    <View style={styles.card} onLayout={onLayout} testID={testID}>
      {size.width > 0 ? (
        <CardBackground width={size.width} height={size.height} fill={fill} stroke={stroke} glow={glow} />
      ) : null}
      {children}
      {/* Last, so it sits above the content in the touch order too. */}
      <View style={styles.notchButton}>
        <ThemeToggle />
      </View>
    </View>
  );
}

/** "▲ 2.87%" in the card's palette: green/red with an arrow, muted when unknown. */
function Change({ pct, sign, testID }: { readonly pct: number | null; readonly sign: number | null; readonly testID?: string }) {
  const { colors } = useTheme();
  const hero = colors.hero;
  const trend = trendOf(sign);
  const color = trend === 'up' ? hero.gain : trend === 'down' ? hero.loss : hero.muted;
  return (
    <View style={styles.change} testID={testID}>
      {trend !== 'flat' ? <Ionicons name={trend === 'up' ? 'caret-up' : 'caret-down'} size={10} color={color} /> : null}
      <AppText variant="label" numeric color={color}>
        {formatPercent(pct, 'negative-only')}
      </AppText>
    </View>
  );
}

/** One of the two P&L figures under the divider: label, signed ₹ amount, and its % change. */
function Stat({
  label,
  amount,
  pct,
  testID,
}: {
  readonly label: string;
  readonly amount: Paise | null;
  readonly pct: number | null;
  readonly testID?: string;
}) {
  const { colors } = useTheme();
  const hero = colors.hero;
  const trend = trendOf(amount);
  const color = amount == null ? hero.muted : trend === 'up' ? hero.gain : trend === 'down' ? hero.loss : hero.text;
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${formatSignedMoney(amount)}, ${formatPercent(pct)}`}>
      <AppText variant="micro" color={hero.muted}>
        {label}
      </AppText>
      <AppText variant="heading" numeric color={color} numberOfLines={1} adjustsFontSizeToFit testID={testID}>
        {formatSignedMoney(amount)}
      </AppText>
      <Change pct={pct} sign={amount} />
    </View>
  );
}

/**
 * Portfolio totals, laid out to be read top-down: the current value with its
 * overall change, what was invested (and how much of it has a live price),
 * then total and today's P&L side by side. Every figure has ₹ and %.
 * Subscribes through usePortfolioSummary, which only re-renders this card
 * when one of the displayed numbers changes. A "Prices paused" nudge sits on
 * the top edge while the feed is stalled.
 */
export const SummaryCard = memo(function SummaryCard({ onLongPress }: { readonly onLongPress?: () => void }) {
  const { colors } = useTheme();
  const summary = usePortfolioSummary();
  const hero = colors.hero;
  const priced = summary.pricedCount > 0;
  const dayKnown = summary.pricedCount > summary.dayExcludedCount;

  return (
    <NotchedCard fill={hero.gradient} stroke={hero.border} glow={hero.glow} testID="summary-card">
      {/* Hidden gesture: long-press the value for the simulator dev menu. */}
      <Pressable onLongPress={onLongPress} delayLongPress={450} disabled={!onLongPress} accessible={false}>
        <View style={styles.headerRow}>
          <AppText variant="micro" color={hero.muted}>
            Current value
          </AppText>
        </View>
        <View style={styles.valueRow}>
          <AppText
            variant="display"
            numeric
            color={hero.text}
            style={styles.value}
            testID="summary-current-value"
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {formatMoney(priced ? summary.currentValuePaise : null)}
          </AppText>
          <Change
            pct={priced ? summary.valueVsInvestedPct : null}
            sign={priced ? summary.pnlPaise : null}
            testID="summary-value-pct"
          />
        </View>
        <AppText variant="caption" numeric color={hero.muted} style={styles.invested}>
          {'Invested '}
          <AppText variant="caption" numeric color={hero.text} testID="summary-invested">
            {formatMoney(priced ? summary.investedPaise : null)}
          </AppText>
          {'  ·  '}
          <AppText variant="caption" numeric color={hero.muted} testID="summary-priced-share">
            {`${formatPercent(summary.pricedInvestedShare, 'negative-only')} priced`}
          </AppText>
        </AppText>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: hero.divider }]} />

      <View style={styles.stats}>
        <Stat
          label="Total P&L"
          amount={priced ? summary.pnlPaise : null}
          pct={priced ? summary.pnlPct : null}
          testID="summary-pnl"
        />
        <View style={[styles.statDivider, { backgroundColor: hero.divider }]} />
        <Stat
          label="Today's P&L"
          amount={dayKnown ? summary.dayPnlPaise : null}
          pct={dayKnown ? summary.dayPnlPct : null}
          testID="summary-day-pnl"
        />
      </View>

      <UnpricedNote unpriced={summary.unpriced} investedPaise={summary.unpricedInvestedPaise} />

      <PausedNudge style={styles.nudge} />
    </NotchedCard>
  );
});

/**
 * Footnote naming what the totals leave out and how much was invested in it,
 * e.g. "OLDCO has no live price · ₹12,375.00 left out of totals". Only shown
 * when some holding has no price; the "x% priced" beside Invested is the share.
 */
function UnpricedNote({
  unpriced,
  investedPaise,
}: {
  readonly unpriced: readonly { readonly symbol: string }[];
  readonly investedPaise: Paise;
}) {
  const { colors } = useTheme();
  const hero = colors.hero;
  const who = describeUnpriced(unpriced);
  if (!who) return null;
  return (
    <View
      style={[styles.note, { borderTopColor: hero.divider }]}
      accessible
      accessibilityLabel={`${who}, so the ${formatMoney(investedPaise)} invested in it is left out of these totals.`}
      testID="summary-unpriced-note"
    >
      <Ionicons name="information-circle-outline" size={15} color={hero.muted} style={styles.noteIcon} />
      <AppText variant="caption" color={hero.muted} style={styles.noteText}>
        {`${who} · `}
        <AppText variant="caption" numeric color={hero.text}>
          {formatMoney(investedPaise)}
        </AppText>
        {' left out of totals'}
      </AppText>
    </View>
  );
}

export function SummaryCardSkeleton() {
  const { colors } = useTheme();
  return (
    <NotchedCard fill={colors.surface} stroke={colors.border}>
      <View style={styles.headerRow}>
        <Skeleton width={110} height={11} />
      </View>
      <Skeleton width="65%" height={30} style={{ marginTop: space.xs }} />
      <Skeleton width="55%" height={12} style={{ marginTop: space.md }} />
      <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
      <View style={styles.stats}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.stat, i === 1 && styles.skeletonStat]}>
            <Skeleton width={64} height={10} />
            <Skeleton width={96} height={16} />
            <Skeleton width={48} height={12} />
          </View>
        ))}
      </View>
    </NotchedCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.xl },
  notchButton: { position: 'absolute', top: NOTCH_GAP, right: space.lg },
  // Straddles the card's top edge, like a sale tag on a product card.
  nudge: { top: -NUDGE_HEIGHT / 2, left: space.xl },
  // Tall enough that the big value below starts under the cutout, never beside it.
  headerRow: { minHeight: NOTCH_HEIGHT - space.xl, justifyContent: 'center', marginBottom: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  value: { flexShrink: 1 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  invested: { marginTop: space.xs },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: space.lg },
  stats: { flexDirection: 'row', alignItems: 'stretch' },
  stat: { flex: 1, gap: space.xs },
  statDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: space.lg },
  skeletonStat: { paddingLeft: space.lg + StyleSheet.hairlineWidth },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Nudged down to sit on the first line of text.
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1 },
});
