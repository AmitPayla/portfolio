import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

const OPEN_SPRING = { damping: 22, stiffness: 240, mass: 0.9 } as const;

export interface BottomSheetProps {
  readonly visible: boolean;
  /** User dismissed it (backdrop, drag, back button). */
  readonly onRequestClose: () => void;
  /** Exit animation finished; safe to unmount content. */
  readonly onClosed?: () => void;
  readonly children: ReactNode;
  readonly testID?: string;
}

/**
 * Overlay bottom sheet drawn in the root view (not a native Modal) so it sits
 * above the tab bar and follows the keyboard frame by frame. Open/close and
 * drag-to-dismiss are springs on the UI thread; a fling or a drag past 30%
 * of the height closes it. Shared values use .get()/.set(), the React
 * Compiler-safe form of `.value`.
 */
export function BottomSheet({ visible, onRequestClose, onClosed, children, testID }: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const keyboard = useAnimatedKeyboard();
  /** 0 until measured; reset on close so the next open measures and springs in again. */
  const sheetHeight = useSharedValue(0);
  const translateY = useSharedValue(screenHeight);

  // Stay mounted while the exit animation runs; mount immediately when opened (render-phase update).
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const finishClose = useCallback(() => {
    sheetHeight.set(0);
    setMounted(false);
    onClosed?.();
  }, [onClosed, sheetHeight]);

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      // Re-opened while still laid out (e.g. mid-close): spring straight back.
      if (sheetHeight.get() > 0) translateY.set(withSpring(0, OPEN_SPRING));
      return;
    }
    translateY.set(
      withTiming(sheetHeight.get() + 40, { duration: 220 }, (finished) => {
        if (finished) scheduleOnRN(finishClose);
      }),
    );
  }, [visible, mounted, finishClose, sheetHeight, translateY]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onRequestClose]);

  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: (e) => {
      // Follow the finger downwards; resist (rubber-band) when pulled up.
      translateY.set(e.translationY > 0 ? e.translationY : e.translationY * 0.15);
    },
    onDeactivate: (e) => {
      if (e.translationY > sheetHeight.get() * 0.3 || e.velocityY > 900) {
        scheduleOnRN(onRequestClose);
      } else {
        translateY.set(withSpring(0, OPEN_SPRING));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() - keyboard.height.get() }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.get(), [0, Math.max(1, sheetHeight.get())], [1, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;
  return (
    <View style={StyleSheet.absoluteFill} testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} accessibilityLabel="Close sheet" />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) },
          sheetStyle,
        ]}
        onLayout={(e) => {
          const height = e.nativeEvent.layout.height;
          const firstMeasure = sheetHeight.get() === 0;
          sheetHeight.set(height);
          if (firstMeasure && visible) {
            translateY.set(height);
            translateY.set(withSpring(0, OPEN_SPRING));
          }
        }}
        accessibilityViewIsModal
      >
        <GestureDetector gesture={pan}>
          <View style={styles.handleZone} accessibilityLabel="Drag down to close">
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl + 6,
    borderTopRightRadius: radius.xl + 6,
    maxHeight: '88%',
  },
  handleZone: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 42, height: 5, borderRadius: 3 },
});
