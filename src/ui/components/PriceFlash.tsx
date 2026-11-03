import { memo, useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

export interface PriceFlashProps {
  /** The value to watch. Any change triggers a flash coloured by direction. */
  readonly value: number | null;
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Flashes its background green/red when `value` moves. The JS thread only
 * kicks the animation off (two shared-value writes); the fade itself runs on
 * the UI thread, so it costs nothing per frame on JS while ticks pour in.
 */
export const PriceFlash = memo(function PriceFlash({ value, children, style }: PriceFlashProps) {
  const { colors } = useTheme();
  const previous = useRef(value);
  const progress = useSharedValue(0);
  const direction = useSharedValue(1);

  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (before == null || value == null || before === value) return;
    direction.value = value > before ? 1 : -1;
    progress.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 650 }));
  }, [value, direction, progress]);

  const { flashUp, flashUpClear, flashDown, flashDownClear } = colors;
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor:
      direction.value > 0
        ? interpolateColor(progress.value, [0, 1], [flashUpClear, flashUp])
        : interpolateColor(progress.value, [0, 1], [flashDownClear, flashDown]),
  }));

  return <Animated.View style={[{ borderRadius: 6, paddingHorizontal: 4, marginHorizontal: -4 }, style, animatedStyle]}>{children}</Animated.View>;
});
