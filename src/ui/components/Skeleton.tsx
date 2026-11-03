import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

/** Shimmering placeholder block. The sweep is a UI-thread loop. */
export const Skeleton = memo(function Skeleton({
  width = '100%',
  height = 14,
  style,
  rounded = radius.sm,
}: {
  readonly width?: DimensionValue;
  readonly height?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly rounded?: number;
}) {
  const { colors } = useTheme();
  const sweep = useSharedValue(-1);
  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [sweep]);
  const shimmer = useAnimatedStyle(() => ({ transform: [{ translateX: `${sweep.value * 100}%` }] }));
  return (
    <View style={[{ width, height, borderRadius: rounded, backgroundColor: colors.skeleton, overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, shimmer]}>
        <LinearGradient
          colors={['transparent', colors.skeletonHighlight, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
});
