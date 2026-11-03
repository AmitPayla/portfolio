import { memo, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { DURATION, easeOut } from '../theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  /** How far it shrinks while pressed. Rows use a subtle 0.985, buttons 0.97. */
  readonly scaleTo?: number;
  readonly haptic?: boolean;
}

/**
 * Press feedback that runs on the UI thread: a short ease-out on a shared
 * value (no spring, no overshoot), so it stays smooth while JS handles ticks.
 * The Pressable itself is animated, so layout styles (flex, alignSelf) apply
 * to the element its parent lays out.
 */
export const PressableScale = memo(function PressableScale({
  children,
  style,
  scaleTo = 0.975,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, easeOut(DURATION.press)));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, easeOut(DURATION.release)));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) void Haptics.selectionAsync();
        onPress?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
});
