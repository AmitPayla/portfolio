import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { trendOf } from '@/domain/format';
import { makeStyles, useTheme } from '../theme/ThemeProvider';
import { cardShadow, radius, space } from '../theme/tokens';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type IconName = ComponentProps<typeof Ionicons>['name'];

// ── Card ─────────────────────────────────────────────────────────────────

export function Card({ children, style }: { readonly children: ReactNode; readonly style?: StyleProp<ViewStyle> }) {
  const styles = useCardStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

const useCardStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...cardShadow(t),
  },
}));

// ── ChangePill: the coloured P&L / day-change tag ───────────────────────

export const ChangePill = memo(function ChangePill({
  label,
  sign,
  size = 'md',
}: {
  readonly label: string;
  /** Number whose sign picks the colour (null = neutral). */
  readonly sign: number | null;
  readonly size?: 'sm' | 'md';
}) {
  const { colors } = useTheme();
  const trend = trendOf(sign);
  const bg = trend === 'up' ? colors.gainSoft : trend === 'down' ? colors.lossSoft : colors.sunken;
  const fg = trend === 'up' ? colors.gain : trend === 'down' ? colors.loss : colors.textMuted;
  const arrow = trend === 'up' ? 'caret-up' : trend === 'down' ? 'caret-down' : null;
  return (
    <View style={[pillStyles.pill, size === 'sm' && pillStyles.pillSm, { backgroundColor: bg }]}>
      {arrow ? <Ionicons name={arrow} size={size === 'sm' ? 9 : 10} color={fg} /> : null}
      <AppText variant={size === 'sm' ? 'caption' : 'label'} numeric color={fg}>
        {label}
      </AppText>
    </View>
  );
});

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillSm: { paddingHorizontal: 6, paddingVertical: 1 },
});

// ── SymbolAvatar: muted tinted tile with initials (no logos needed) ─────

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export const SymbolAvatar = memo(function SymbolAvatar({ symbol, size = 42 }: { readonly symbol: string; readonly size?: number }) {
  const { colors } = useTheme();
  const [bg, fg] = colors.avatars[hash(symbol) % colors.avatars.length] ?? ['#EEE', '#333'];
  return (
    <View style={[avatarStyles.tile, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg }]}>
      <AppText variant="label" weight="extrabold" color={fg} style={{ fontSize: size * 0.34, lineHeight: size * 0.42 }}>
        {symbol.slice(0, 2)}
      </AppText>
    </View>
  );
});

const avatarStyles = StyleSheet.create({ tile: { alignItems: 'center', justifyContent: 'center' } });

// ── Chip: animated selectable pill ───────────────────────────────────────

export const Chip = memo(function Chip({
  label,
  selected,
  onPress,
  icon,
  accessibilityLabel,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly icon?: IconName;
  readonly accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(selected ? 1 : 0, { duration: 180 }));
  }, [selected, progress]);
  const { surface, brand, border, text, onBrand } = colors;
  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [surface, brand]),
    borderColor: interpolateColor(progress.get(), [0, 1], [border, brand]),
  }));
  return (
    <PressableScale
      onPress={onPress}
      haptic
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Animated.View style={[chipStyles.chip, boxStyle]}>
        {icon ? <Ionicons name={icon} size={13} color={selected ? onBrand : text} /> : null}
        <AppText variant="label" color={selected ? onBrand : text}>
          {label}
        </AppText>
      </Animated.View>
    </PressableScale>
  );
});

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});

// ── Button ───────────────────────────────────────────────────────────────

export type ButtonTone = 'brand' | 'ink' | 'buy' | 'sell' | 'ghost';

export const Button = memo(function Button({
  label,
  onPress,
  tone = 'ink',
  icon,
  disabled,
  loading,
  style,
  accessibilityLabel,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: ButtonTone;
  readonly icon?: IconName;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const palette: Record<ButtonTone, { bg: string; fg: string; border?: string }> = {
    brand: { bg: colors.brand, fg: colors.onBrand },
    ink: { bg: colors.ink, fg: colors.onInk },
    buy: { bg: colors.gain, fg: colors.onGain },
    sell: { bg: colors.loss, fg: colors.onLoss },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.border },
  };
  const p = palette[tone];
  const inactive = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      haptic
      scaleTo={0.96}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        buttonStyles.button,
        { backgroundColor: p.bg, borderColor: p.border ?? p.bg, opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={p.fg} /> : null}
      {!loading && icon ? <Ionicons name={icon} size={17} color={p.fg} /> : null}
      <AppText variant="heading" color={p.fg} numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  );
});

const buttonStyles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});

// ── IconButton ───────────────────────────────────────────────────────────

export const IconButton = memo(function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color,
  background,
  size = 40,
}: {
  readonly icon: IconName;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly color?: string;
  readonly background?: string;
  readonly size?: number;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic
      scaleTo={0.9}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background ?? colors.surface,
      }}
    >
      <Ionicons name={icon} size={size * 0.5} color={color ?? colors.text} />
    </PressableScale>
  );
});

// ── Pop-in check used by success states ─────────────────────────────────

export function SuccessBurst({ color, iconColor }: { readonly color: string; readonly iconColor: string }) {
  const scale = useSharedValue(0.3);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 180 });
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: Math.min(1, scale.value * 1.5) }));
  return (
    <Animated.View style={[{ width: 72, height: 72, borderRadius: 36, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name="checkmark" size={40} color={iconColor} />
    </Animated.View>
  );
}
