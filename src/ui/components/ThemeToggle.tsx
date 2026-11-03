import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme, useThemeToggle } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { PressableScale } from './PressableScale';

export const THEME_TOGGLE_SIZE = 36;

/**
 * Light/dark switch (watchlist header, portfolio summary card, stock detail
 * header). It passes the exact tap point, so the new theme spreads out as a
 * circle from under the user's finger. The icon shows where a tap takes you:
 * a moon in light mode, a sun in dark mode.
 */
export const ThemeToggle = memo(function ThemeToggle({ size = THEME_TOGGLE_SIZE }: { readonly size?: number }) {
  const { dark, colors } = useTheme();
  const toggle = useThemeToggle();
  return (
    <PressableScale
      onPress={(e) => toggle({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
      haptic
      scaleTo={0.9}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      testID="theme-toggle"
      style={[styles.button, { width: size, height: size, backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Ionicons name={dark ? 'sunny' : 'moon'} size={16} color={colors.text} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
