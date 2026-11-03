import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { formatCount, formatMoney, formatShares, formatSignedMoney, trendOf } from '@/domain/format';
import { mulQty } from '@/domain/money';
import {
  applyBuy,
  applySell,
  MAX_ORDER_QTY,
  validateOrderQuantity,
  type OrderFill,
  type OrderSide,
} from '@/domain/orders';
import { averagePricePaise } from '@/domain/portfolio';
import { companyName } from '@/domain/symbols';
import { placeMarketOrder } from '@/services/trading';
import { useHolding, useLoadState, useLtp, useStream } from '@/state/hooks';
import { closeSheet } from '@/features/sheets/sheetStore';
import { AppText } from '@/ui/components/AppText';
import { isPricesPaused } from '@/ui/components/FeedStatus';
import { Button, SuccessBurst, SymbolAvatar } from '@/ui/components/primitives';
import { PressableScale } from '@/ui/components/PressableScale';
import { PriceFlash } from '@/ui/components/PriceFlash';
import { showToast } from '@/ui/components/Toast';
import { DURATION, easeInOut } from '@/ui/theme/motion';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts, radius, space } from '@/ui/theme/tokens';


/** Buy / Sell segmented control with a sliding, colour-shifting thumb. */
const SideToggle = memo(function SideToggle({ side, onChange }: { readonly side: OrderSide; readonly onChange: (s: OrderSide) => void }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(side === 'buy' ? 0 : 1);
  useEffect(() => {
    progress.set(withTiming(side === 'buy' ? 0 : 1, easeInOut(DURATION.base)));
  }, [side, progress]);
  const { gain, loss } = colors;
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * (width / 2) }],
    backgroundColor: interpolateColor(progress.get(), [0, 1], [gain, loss]),
  }));
  return (
    <View style={[styles.toggle, { backgroundColor: colors.sunken }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)} role="radiogroup">
      {width > 0 ? <Animated.View style={[styles.thumb, { width: width / 2 }, thumbStyle]} /> : null}
      {(['buy', 'sell'] as const).map((value) => (
        <Pressable
          key={value}
          style={styles.toggleOption}
          onPress={() => {
            if (value !== side) void Haptics.selectionAsync();
            onChange(value);
          }}
          role="radio"
          accessibilityState={{ checked: side === value }}
          testID={`side-${value}`}
        >
          <AppText variant="heading" color={side === value ? (value === 'buy' ? colors.onGain : colors.onLoss) : colors.textMuted}>
            {value === 'buy' ? 'Buy' : 'Sell'}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
});

function Stepper({ icon, onPress, label, disabled }: { readonly icon: 'add' | 'remove'; readonly onPress: () => void; readonly label: string; readonly disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic
      scaleTo={0.88}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.stepper, { backgroundColor: colors.sunken, opacity: disabled ? 0.4 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </PressableScale>
  );
}

function QuickChip({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} haptic scaleTo={0.92} style={[styles.quick, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <AppText variant="caption" weight="bold" numeric>
        {label}
      </AppText>
    </PressableScale>
  );
}

function Row({ label, value, tone, testID }: { readonly label: string; readonly value: string; readonly tone?: 'gain' | 'loss' | 'default'; readonly testID?: string }) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant="body" tone="muted">
        {label}
      </AppText>
      <AppText variant="heading" numeric tone={tone ?? 'default'} testID={testID}>
        {value}
      </AppText>
    </View>
  );
}

function FilledView({ fill, onDone }: { readonly fill: OrderFill; readonly onDone: () => void }) {
  const { colors } = useTheme();
  const verb = fill.side === 'buy' ? 'Bought' : 'Sold';
  const realizedTrend = trendOf(fill.realizedPnlPaise);
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.filled} testID="trade-filled">
      <SuccessBurst
        color={fill.side === 'buy' ? colors.gain : colors.loss}
        iconColor={fill.side === 'buy' ? colors.onGain : colors.onLoss}
      />
      <AppText variant="title" style={styles.center}>
        Order filled
      </AppText>
      <AppText variant="body" tone="muted" numeric style={styles.center}>
        {verb} {formatShares(fill.qty)} of {fill.symbol} at {formatMoney(fill.pricePaise)}
      </AppText>
      <AppText variant="heading" numeric style={styles.center}>
        {formatMoney(fill.valuePaise)}
      </AppText>
      {fill.realizedPnlPaise != null ? (
        <AppText variant="label" numeric tone={realizedTrend === 'up' ? 'gain' : realizedTrend === 'down' ? 'loss' : 'muted'}>
          Realized P&L {formatSignedMoney(fill.realizedPnlPaise)}
        </AppText>
      ) : null}
      <Button label="Done" tone="ink" onPress={onDone} style={styles.doneButton} />
    </Animated.View>
  );
}

/**
 * Local market order ticket. Everything shown is derived live from the store
 * and the domain functions; the fill itself re-reads the price on confirm.
 */
export function TradeSheet({ symbol, initialSide }: { readonly symbol: string; readonly initialSide: OrderSide }) {
  const { colors } = useTheme();
  const [side, setSide] = useState<OrderSide>(initialSide);
  const [input, setInput] = useState('1');
  const [touched, setTouched] = useState(false);
  const [fill, setFill] = useState<OrderFill | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holding = useHolding(symbol);
  const ltp = useLtp(symbol);
  const stream = useStream();
  const { status: loadStatus } = useLoadState();
  const held = holding?.qty ?? 0;
  const paused = isPricesPaused(stream.status, loadStatus === 'ready');

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const validation = useMemo(() => validateOrderQuantity(input, side, held), [input, side, held]);
  const qty = validation.ok ? validation.qty : null;
  const estimate = qty != null && ltp != null ? mulQty(ltp, qty) : null;
  const preview = useMemo(() => {
    if (qty == null || ltp == null) return null;
    if (side === 'buy') return { kind: 'buy' as const, newAvg: averagePricePaise(applyBuy(holding, symbol, qty, ltp)) };
    if (holding && qty <= holding.qty) return { kind: 'sell' as const, realized: applySell(holding, qty, ltp).realizedPnlPaise };
    return null;
  }, [qty, ltp, side, holding, symbol]);

  const current = Number.isSafeInteger(Number(input)) ? Number(input) : 0;
  const maxQty = side === 'sell' ? held : MAX_ORDER_QTY;
  const setQty = (n: number) => {
    setTouched(true);
    setSubmitError(null);
    setInput(String(Math.max(0, Math.min(maxQty, n))));
  };

  const confirm = () => {
    if (qty == null) {
      setTouched(true);
      return;
    }
    const result = placeMarketOrder(side, symbol, qty);
    if (!result.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSubmitError(result.message);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFill(result.fill);
    showToast({
      tone: 'success',
      title: `${side === 'buy' ? 'Bought' : 'Sold'} ${formatShares(result.fill.qty)} of ${symbol}`,
      message: `Filled at ${formatMoney(result.fill.pricePaise)} · ${formatMoney(result.fill.valuePaise)}`,
    });
    closeTimer.current = setTimeout(closeSheet, 1_800);
  };

  if (fill) return <FilledView fill={fill} onDone={closeSheet} />;

  const sideColor = side === 'buy' ? colors.gain : colors.loss;
  const errorText = submitError ?? (touched && !validation.ok ? validation.message : null);
  const helper =
    side === 'sell'
      ? held > 0
        ? `You hold ${formatShares(held)}`
        : "You don't hold this stock"
      : holding
        ? `You hold ${formatShares(held)} · avg ${formatMoney(averagePricePaise(holding))}`
        : 'Whole shares only';

  return (
    <View style={styles.body} testID="trade-sheet">
      <View style={styles.titleRow}>
        <SymbolAvatar symbol={symbol} size={44} />
        <View style={styles.titleText}>
          <AppText variant="title">
            {side === 'buy' ? 'Buy' : 'Sell'} {symbol}
          </AppText>
          <AppText variant="caption" tone="muted">
            {companyName(symbol)}
          </AppText>
        </View>
      </View>

      <SideToggle
        side={side}
        onChange={(s) => {
          setSide(s);
          setSubmitError(null);
        }}
      />

      <View style={[styles.priceBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <View>
          <AppText variant="caption" tone="muted">
            Market price
          </AppText>
          <AppText variant="caption" tone="faint">
            Fills at the last price on confirm
          </AppText>
        </View>
        <PriceFlash value={ltp}>
          <AppText variant="heading" numeric testID="trade-ltp">
            {formatMoney(ltp)}
          </AppText>
        </PriceFlash>
      </View>

      <View style={styles.qtyBlock}>
        <AppText variant="label" tone="muted">
          Quantity
        </AppText>
        <View style={styles.qtyRow}>
          <Stepper icon="remove" label="Decrease quantity" onPress={() => setQty(current - 1)} disabled={current <= 1} />
          <TextInput
            value={input}
            onChangeText={(text) => {
              setTouched(true);
              setSubmitError(null);
              setInput(text);
            }}
            keyboardType="number-pad"
            maxLength={7}
            selectTextOnFocus
            style={[styles.qtyInput, { color: colors.text, borderColor: errorText ? colors.loss : colors.border, backgroundColor: colors.surface }]}
            selectionColor={colors.brand}
            accessibilityLabel="Quantity"
            testID="trade-qty-input"
          />
          <Stepper icon="add" label="Increase quantity" onPress={() => setQty(current + 1)} disabled={current >= maxQty} />
        </View>
        <View style={styles.quickRow}>
          <QuickChip label="+1" onPress={() => setQty(current + 1)} />
          <QuickChip label="+5" onPress={() => setQty(current + 5)} />
          <QuickChip label="+10" onPress={() => setQty(current + 10)} />
          {side === 'sell' && held > 0 ? <QuickChip label={`All ${formatCount(held)}`} onPress={() => setQty(held)} /> : null}
        </View>
        <Animated.View layout={LinearTransition.duration(160)}>
          {errorText ? (
            <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={styles.errorRow} key="error">
              <Ionicons name="alert-circle" size={15} color={colors.loss} />
              <AppText variant="caption" tone="loss" testID="trade-error">
                {errorText}
              </AppText>
            </Animated.View>
          ) : (
            <AppText variant="caption" tone="muted" key="helper">
              {helper}
            </AppText>
          )}
        </Animated.View>
      </View>

      <View style={[styles.summary, { borderColor: colors.hairline }]}>
        <Row label="Estimated value" value={formatMoney(estimate)} testID="trade-estimate" />
        {preview?.kind === 'buy' ? <Row label="New avg. price" value={formatMoney(preview.newAvg)} testID="trade-new-avg" /> : null}
        {preview?.kind === 'sell' ? (
          <Row
            label="Est. realized P&L"
            value={formatSignedMoney(preview.realized)}
            tone={trendOf(preview.realized) === 'down' ? 'loss' : trendOf(preview.realized) === 'up' ? 'gain' : 'default'}
          />
        ) : null}
      </View>

      {paused ? (
        <View style={[styles.warning, { backgroundColor: colors.warnSoft }]}>
          <Ionicons name="pause-circle" size={16} color={colors.warn} />
          <AppText variant="caption" color={colors.warn} style={styles.flex}>
            Prices are paused. The order fills at the last known price.
          </AppText>
        </View>
      ) : null}

      <Button
        label={qty != null ? `${side === 'buy' ? 'Buy' : 'Sell'} ${formatShares(qty)} · ${formatMoney(estimate)}` : side === 'buy' ? 'Buy' : 'Sell'}
        tone={side}
        onPress={confirm}
        disabled={qty == null || ltp == null}
        style={{ backgroundColor: sideColor, borderColor: sideColor }}
        accessibilityLabel={`Confirm ${side}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingTop: space.xs, gap: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleText: { flex: 1 },
  toggle: { flexDirection: 'row', borderRadius: radius.lg, padding: 4, height: 50 },
  thumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radius.md },
  toggleOption: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  qtyBlock: { gap: space.sm },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepper: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  qtyInput: {
    flex: 1,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    textAlign: 'center',
    fontFamily: fonts.extrabold,
    fontSize: 22,
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  quickRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  quick: { paddingHorizontal: space.md, height: 30, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summary: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md, gap: space.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  warning: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  flex: { flex: 1 },
  filled: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm },
  center: { textAlign: 'center' },
  doneButton: { alignSelf: 'stretch', marginTop: space.lg },
});
