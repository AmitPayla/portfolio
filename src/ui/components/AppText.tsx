import { memo, type ReactNode } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, type FontWeight } from '../theme/tokens';

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'micro';
export type TextTone = 'default' | 'muted' | 'faint' | 'gain' | 'loss' | 'warn' | 'onBrand' | 'onInk';

const variants: Record<TextVariant, { size: number; line: number; weight: FontWeight; tracking?: number }> = {
  display: { size: 30, line: 36, weight: 'extrabold', tracking: -0.6 },
  title: { size: 22, line: 28, weight: 'extrabold', tracking: -0.3 },
  heading: { size: 16.5, line: 22, weight: 'bold', tracking: -0.1 },
  body: { size: 14.5, line: 20, weight: 'semibold' },
  label: { size: 13, line: 18, weight: 'bold' },
  caption: { size: 12, line: 16, weight: 'semibold' },
  micro: { size: 10.5, line: 13, weight: 'extrabold', tracking: 0.6 },
};

const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

/**
 * Manrope ships a `liga` ligature that draws "--" as one long dash, but a
 * missing value must read as a literal "--". `fontVariant: no-common-ligatures`
 * is dropped by the New Architecture's text layer, so we put a zero-width
 * non-joiner between the hyphens instead: invisible, and it blocks the ligature.
 */
const DOUBLE_HYPHEN = /--/g;
function keepHyphensApart(node: ReactNode): ReactNode {
  if (typeof node === 'string') return node.includes('--') ? node.replace(DOUBLE_HYPHEN, '-\u200C-') : node;
  // Only plain-text arrays: re-mapping arrays that contain elements would need keys.
  if (Array.isArray(node) && node.every((n) => typeof n === 'string' || typeof n === 'number')) {
    return node.map(keepHyphensApart);
  }
  return node;
}

export interface AppTextProps extends TextProps {
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
  readonly weight?: FontWeight;
  /** Tabular figures: digits keep the same width, so live numbers don't jiggle. */
  readonly numeric?: boolean;
  readonly color?: string;
}

/** The only Text in the app: applies Manrope, the type scale and theme colours. */
export const AppText = memo(function AppText({
  variant = 'body',
  tone = 'default',
  weight,
  numeric,
  color,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  const v = variants[variant];
  const toneColor: Record<TextTone, string> = {
    default: colors.text,
    muted: colors.textMuted,
    faint: colors.textFaint,
    gain: colors.gain,
    loss: colors.loss,
    warn: colors.warn,
    onBrand: colors.onBrand,
    onInk: colors.onInk,
  };
  const base: TextStyle = {
    fontFamily: fonts[weight ?? v.weight],
    fontSize: v.size,
    lineHeight: v.line,
    letterSpacing: v.tracking,
    color: color ?? toneColor[tone],
    fontVariant: numeric ? TABULAR : undefined,
    textTransform: variant === 'micro' ? 'uppercase' : undefined,
  };
  return (
    <Text allowFontScaling maxFontSizeMultiplier={1.3} {...rest} style={[base, style]}>
      {keepHyphensApart(children)}
    </Text>
  );
});
