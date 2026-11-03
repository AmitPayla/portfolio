import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { DURATION, easeInOut } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { AppText } from './AppText';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { active: IconName; idle: IconName; label: string }> = {
  index: { active: 'pie-chart', idle: 'pie-chart-outline', label: 'Portfolio' },
  watchlist: { active: 'star', idle: 'star-outline', label: 'Watchlist' },
};

/** Tab bar with a soft indigo pill that glides between tabs. */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const tabWidth = width / Math.max(1, state.routes.length);
  const x = useSharedValue(0);

  useEffect(() => {
    x.set(withTiming(state.index * tabWidth, easeInOut(DURATION.base)));
  }, [state.index, tabWidth, x]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, space.sm) }]}
    >
      <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} role="tablist">
        {width > 0 ? (
          <Animated.View style={[styles.pillTrack, { width: tabWidth }, pillStyle]} pointerEvents="none">
            <View style={[styles.pill, { backgroundColor: colors.brandSoft }]} />
          </Animated.View>
        ) : null}
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const meta = ICONS[route.name] ?? { active: 'ellipse', idle: 'ellipse-outline', label: route.name };
          const options = descriptors[route.key]?.options;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              void Haptics.selectionAsync();
              navigateToTab(route.key);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              role="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options?.title ?? meta.label}
              testID={`tab-${route.name}`}
            >
              <Ionicons name={focused ? meta.active : meta.idle} size={21} color={focused ? colors.brand : colors.textFaint} />
              <AppText variant="caption" weight={focused ? 'extrabold' : 'semibold'} color={focused ? colors.brand : colors.textFaint}>
                {meta.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  row: { flexDirection: 'row', marginHorizontal: space.xl },
  tab: { flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  pillTrack: { position: 'absolute', top: 0, bottom: 0, left: 0, paddingHorizontal: space.sm },
  pill: { flex: 1, borderRadius: radius.lg },
});
