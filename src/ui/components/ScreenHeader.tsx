import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
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

export function ScreenTitle({
  eyebrow,
  title,
  right,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { paddingTop: insets.top + space.md }]}>
      <View style={styles.titles}>
        <AppText variant="micro" color={colors.onHeader} style={styles.eyebrow}>
          {eyebrow}
        </AppText>
        <AppText variant="display" color={colors.onHeader} accessibilityRole="header">
          {title}
        </AppText>
      </View>
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
});
