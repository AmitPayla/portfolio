import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { DURATION, EASE_IN, EASE_OUT } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { AppText } from './AppText';

export interface ToastMessage {
  readonly id: number;
  readonly tone: 'success' | 'error' | 'info';
  readonly title: string;
  readonly message?: string;
  readonly action?: { readonly label: string; readonly onPress: () => void };
}

const toastStore = createStore<{ current: ToastMessage | null }>()(() => ({ current: null }));
let nextId = 1;

export function showToast(toast: Omit<ToastMessage, 'id'>): void {
  toastStore.setState({ current: { ...toast, id: nextId++ } });
}

/** One toast at a time, springing up from the bottom; replaced by the next one, gone after 3.2s. */
export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useStore(toastStore, (s) => s.current);

  useEffect(() => {
    if (!toast) return;
    // Toasts with an action (Undo) stay longer so there is time to reach for it.
    const id = setTimeout(() => {
      if (toastStore.getState().current?.id === toast.id) toastStore.setState({ current: null });
    }, toast.action ? 5_000 : 3_200);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  const icon = toast.tone === 'success' ? 'checkmark-circle' : toast.tone === 'error' ? 'alert-circle' : 'information-circle';
  const iconColor = toast.tone === 'success' ? colors.gain : toast.tone === 'error' ? colors.loss : colors.brand;
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 92 }]}>
      <Animated.View
        key={toast.id}
        // Transform-based (translateY + opacity): frame-based slides misplace bottom-anchored views.
        entering={FadeInUp.duration(DURATION.base).easing(EASE_OUT)}
        exiting={FadeOutDown.duration(DURATION.fast).easing(EASE_IN)}
        style={[styles.toast, { backgroundColor: colors.ink }]}
        accessibilityLiveRegion="polite"
        testID="toast"
      >
        <Ionicons name={icon} size={22} color={iconColor} />
        <View style={styles.text}>
          <AppText variant="label" color={colors.onInk} numeric>
            {toast.title}
          </AppText>
          {toast.message ? (
            <AppText variant="caption" color={colors.onInk} style={styles.message} numeric>
              {toast.message}
            </AppText>
          ) : null}
        </View>
        {toast.action ? (
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              toastStore.setState({ current: null });
            }}
            hitSlop={10}
            accessibilityRole="button"
            testID="toast-action"
          >
            <AppText variant="label" weight="extrabold" color={colors.brand}>
              {toast.action.label}
            </AppText>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    alignSelf: 'stretch',
  },
  text: { flex: 1 },
  message: { opacity: 0.75 },
});
