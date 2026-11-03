import { Platform, type ViewStyle } from 'react-native';

/**
 * Design tokens: "Indigo Ledger".
 *
 * Drawn from how established investing apps use colour (Zerodha Kite, Groww,
 * Robinhood, Revolut): a calm, cool-neutral and mostly flat base; ONE brand
 * colour (indigo) used only for actions, selection and focus; and green/red
 * reserved strictly for money moving up or down, so a colour on screen always
 * means one thing. Gains and losses also carry an arrow or sign, never colour
 * alone, and every text colour below meets WCAG AA (4.5:1) on its surface.
 */

export interface ThemeColors {
  readonly bg: string;
  readonly surface: string;
  readonly surfaceAlt: string;
  readonly sunken: string;
  readonly border: string;
  readonly hairline: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textFaint: string;
  /** Actions, selection, focus. Never used for P&L. */
  readonly brand: string;
  readonly brandSoft: string;
  readonly onBrand: string;
  readonly ink: string;
  readonly onInk: string;
  readonly gain: string;
  readonly gainSoft: string;
  readonly loss: string;
  readonly lossSoft: string;
  /** Text/icons on solid gain/loss fills (white in light mode, near-black on dark mode's brighter fills). */
  readonly onGain: string;
  readonly onLoss: string;
  readonly warn: string;
  readonly warnSoft: string;
  /** Price-flash tints (same hue at 0 and ~20% alpha so the fade never goes grey). */
  readonly flashUp: string;
  readonly flashUpClear: string;
  readonly flashDown: string;
  readonly flashDownClear: string;
  /** Soft indigo wash behind tab-screen titles. */
  readonly headerGradient: readonly [string, string, string];
  readonly onHeader: string;
  readonly scrim: string;
  readonly skeleton: string;
  readonly skeletonHighlight: string;
  readonly shadow: string;
  /** Avatar tiles: [background, foreground] pairs, picked per symbol. */
  readonly avatars: readonly (readonly [string, string])[];
  /** The deep-indigo summary card (a gradient, like a premium card) in both themes. */
  readonly hero: {
    readonly gradient: readonly [string, string, string];
    readonly border: string;
    readonly text: string;
    readonly muted: string;
    readonly divider: string;
    readonly gain: string;
    readonly loss: string;
    readonly gainSoft: string;
    readonly lossSoft: string;
    readonly accent: string;
    readonly glow: string;
  };
}

export interface Theme {
  readonly dark: boolean;
  readonly colors: ThemeColors;
}

const light: ThemeColors = {
  bg: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#FAFBFD',
  sunken: '#EEF0F5',
  border: '#E3E6EE',
  hairline: '#EDEFF4',
  text: '#0F1222',
  textMuted: '#5B6275',
  textFaint: '#6E7587',
  brand: '#4F46E5',
  brandSoft: '#EEF0FF',
  onBrand: '#FFFFFF',
  ink: '#0F1222',
  onInk: '#FFFFFF',
  gain: '#0B7A4B',
  gainSoft: '#E5F4EC',
  loss: '#D92D20',
  lossSoft: '#FDECEA',
  onGain: '#FFFFFF',
  onLoss: '#FFFFFF',
  warn: '#B54708',
  warnSoft: '#FFF3E4',
  flashUp: 'rgba(11,122,75,0.16)',
  flashUpClear: 'rgba(11,122,75,0)',
  flashDown: 'rgba(217,45,32,0.16)',
  flashDownClear: 'rgba(217,45,32,0)',
  headerGradient: ['#E7E9FF', '#F0F1FC', '#F5F6FA'],
  onHeader: '#0F1222',
  scrim: 'rgba(10,12,24,0.5)',
  skeleton: '#E9EBF2',
  skeletonHighlight: 'rgba(255,255,255,0.8)',
  shadow: '#1B2140',
  avatars: [
    ['#EEF0FF', '#4338CA'],
    ['#E5F4EC', '#0B6B42'],
    ['#FDF1E6', '#A4470B'],
    ['#FCE8F0', '#B4235F'],
    ['#E4F3F7', '#0E6F87'],
    ['#F1ECFD', '#6D28D9'],
    ['#ECEFF4', '#334155'],
  ],
  hero: {
    gradient: ['#1E1B4B', '#312E81', '#4F46E5'],
    border: 'transparent',
    text: '#FFFFFF',
    muted: 'rgba(226,229,255,0.74)',
    divider: 'rgba(255,255,255,0.14)',
    gain: '#6EE7B7',
    loss: '#FCA5A5',
    gainSoft: 'rgba(110,231,183,0.16)',
    lossSoft: 'rgba(252,165,165,0.18)',
    accent: '#C7D2FE',
    glow: 'rgba(255,255,255,0.07)',
  },
};

const dark: ThemeColors = {
  bg: '#0A0C12',
  surface: '#12151D',
  surfaceAlt: '#161A24',
  sunken: '#1B202B',
  border: '#242A37',
  hairline: '#1C212C',
  text: '#EEF0F6',
  textMuted: '#9BA3B6',
  textFaint: '#7B8396',
  brand: '#818CF8',
  brandSoft: 'rgba(129,140,248,0.16)',
  onBrand: '#0B0D1F',
  ink: '#EEF0F6',
  onInk: '#0A0C12',
  gain: '#34D399',
  gainSoft: 'rgba(52,211,153,0.14)',
  loss: '#F87171',
  lossSoft: 'rgba(248,113,113,0.14)',
  onGain: '#04210F',
  onLoss: '#2B0707',
  warn: '#FBBF24',
  warnSoft: 'rgba(251,191,36,0.14)',
  flashUp: 'rgba(52,211,153,0.22)',
  flashUpClear: 'rgba(52,211,153,0)',
  flashDown: 'rgba(248,113,113,0.22)',
  flashDownClear: 'rgba(248,113,113,0)',
  headerGradient: ['#171A3A', '#0F1120', '#0A0C12'],
  onHeader: '#EEF0F6',
  scrim: 'rgba(0,0,0,0.62)',
  skeleton: '#1B202B',
  skeletonHighlight: 'rgba(255,255,255,0.06)',
  shadow: '#000000',
  avatars: [
    ['#232659', '#A5B4FC'],
    ['#123526', '#6EE7B7'],
    ['#3A2614', '#FDBA74'],
    ['#3A1627', '#F9A8D4'],
    ['#11303A', '#67E8F9'],
    ['#2A1C4A', '#C4B5FD'],
    ['#1F2633', '#CBD5E1'],
  ],
  hero: {
    gradient: ['#171A3F', '#22256A', '#3730A3'],
    border: '#2B2F63',
    text: '#F5F6FF',
    muted: 'rgba(214,218,255,0.7)',
    divider: 'rgba(255,255,255,0.12)',
    gain: '#6EE7B7',
    loss: '#FCA5A5',
    gainSoft: 'rgba(110,231,183,0.14)',
    lossSoft: 'rgba(252,165,165,0.16)',
    accent: '#C7D2FE',
    glow: 'rgba(255,255,255,0.05)',
  },
};

export const lightTheme: Theme = { dark: false, colors: light };
export const darkTheme: Theme = { dark: true, colors: dark };

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export type FontWeight = keyof typeof fonts;

/** A very soft, navy-tinted lift. Mostly flat, as in Revolut/Kite; none in dark mode. */
export function cardShadow(theme: Theme, level: 1 | 2 = 1): ViewStyle {
  if (theme.dark) return {};
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: theme.colors.shadow,
      shadowOpacity: level === 1 ? 0.05 : 0.1,
      shadowRadius: level === 1 ? 8 : 16,
      shadowOffset: { width: 0, height: level === 1 ? 3 : 8 },
    },
    default: { elevation: level === 1 ? 1 : 4, shadowColor: theme.colors.shadow },
  });
}
