import { memo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

/**
 * Grouped list: the rows of a list share one rounded surface with a hairline
 * outline and inset dividers, instead of each row being its own card with a
 * border and shadow. Flat on purpose: repeated shadows on 20+ rows are noise.
 */
const useGroupStyles = makeStyles((t) => ({
  item: {
    marginHorizontal: space.lg,
    backgroundColor: t.colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    overflow: 'hidden',
  },
  first: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  last: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  divider: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
}));

/** Outer style for one row of a group. `height` is fixed (borders included) so getItemLayout stays exact. */
export function useGroupedItemStyle(first: boolean, last: boolean, height: number): StyleProp<ViewStyle> {
  const s = useGroupStyles();
  return [s.item, first && s.first, last && s.last, { height }];
}

/** Inset hairline between rows; omit it on the last row. */
export function GroupDivider() {
  const s = useGroupStyles();
  return <View pointerEvents="none" style={s.divider} />;
}

/** Full-width pressable row: native ripple on Android, a pressed tint on iOS. No scaling. */
export const PressableRow = memo(function PressableRow({
  children,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { readonly children: ReactNode; readonly style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <Pressable
      {...rest}
      android_ripple={{ color: colors.sunken }}
      style={({ pressed }) => [style, pressed && Platform.OS === 'ios' ? { backgroundColor: colors.sunken } : null]}
    >
      {children}
    </Pressable>
  );
});
