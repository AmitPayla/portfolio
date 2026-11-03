import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { AppText } from './AppText';

/** Soft indigo wash behind tab screens' titles; fades into the page background. */
export function HeaderBackdrop({ height }: { readonly height: number }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={colors.headerGradient}
      locations={[0, 0.55, 1]}
      style={[StyleSheet.absoluteFill, { height }]}
      pointerEvents="none"
    />
  );
}

/**
 * Solid band behind the status bar so a scrolled list never runs under the
 * clock. It uses the header wash's top colour, so at rest it is invisible.
 */
export function StatusBarScrim() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={[styles.scrim, { height: insets.top, backgroundColor: colors.headerGradient[0] }]} />;
}

export function ScreenTitle({
  eyebrow,
  title,
  right,
  onLongPress,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly right?: ReactNode;
  /** Hidden gesture on the title; the tab screens use it for the simulator dev menu. */
  readonly onLongPress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { paddingTop: insets.top + space.md }]}>
      <Pressable style={styles.titles} onLongPress={onLongPress} delayLongPress={450} disabled={!onLongPress} accessible={false}>
        <AppText variant="micro" color={colors.onHeader} style={styles.eyebrow}>
          {eyebrow}
        </AppText>
        <AppText variant="display" color={colors.onHeader} accessibilityRole="header">
          {title}
        </AppText>
      </Pressable>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
  titles: { flexShrink: 1 },
  eyebrow: { opacity: 0.7, marginBottom: 2 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
});
