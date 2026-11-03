import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { AppText } from './AppText';
import { Button } from './primitives';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Shared layout for empty and error states: icon bubble, title, message, optional action. */
export function StateView({
  icon,
  tone = 'neutral',
  title,
  message,
  actionLabel,
  onAction,
  actionIcon,
  testID,
}: {
  readonly icon: IconName;
  readonly tone?: 'neutral' | 'error' | 'brand';
  readonly title: string;
  readonly message?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly actionIcon?: IconName;
  readonly testID?: string;
}) {
  const { colors } = useTheme();
  const bubble = tone === 'error' ? colors.lossSoft : tone === 'brand' ? colors.brandSoft : colors.sunken;
  const iconColor = tone === 'error' ? colors.loss : tone === 'brand' ? colors.brand : colors.textMuted;
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.wrap} testID={testID}>
      <View style={[styles.bubble, { backgroundColor: bubble }]}>
        <Ionicons name={icon} size={30} color={iconColor} />
      </View>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" tone="muted" style={[styles.center, styles.message]}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} tone={tone === 'error' ? 'ink' : 'brand'} icon={actionIcon} style={styles.action} />
      ) : null}
    </Animated.View>
  );
}

/** Error state with the standard retry action. */
export function ErrorState({ message, onRetry, title = "Couldn't load prices" }: { readonly message: string; readonly onRetry: () => void; readonly title?: string }) {
  return (
    <StateView
      icon="cloud-offline-outline"
      tone="error"
      title={title}
      message={message}
      actionLabel="Try again"
      actionIcon="refresh"
      onAction={onRetry}
      testID="error-state"
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: space.xxxl, paddingVertical: space.xxxl, gap: space.sm },
  bubble: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  center: { textAlign: 'center' },
  message: { maxWidth: 300 },
  action: { marginTop: space.md, alignSelf: 'stretch' },
});
