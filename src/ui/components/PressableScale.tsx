import { memo, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 } as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  /** How far it shrinks while pressed. Rows use a subtle 0.98, buttons 0.96. */
  readonly scaleTo?: number;
  readonly haptic?: boolean;
}

/**
 * Press feedback that runs on the UI thread: the spring is driven by a shared
 * value, so it stays smooth even while the JS thread is busy with ticks.
 * The Pressable itself is animated, so layout styles (flex, alignSelf) apply
 * to the element its parent lays out.
 */
export const PressableScale = memo(function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
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
