import { Tabs } from 'expo-router';
import { TabBar } from '@/ui/components/TabBar';
import { useTheme } from '@/ui/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // A hidden tab stops re-rendering on ticks; it catches up when shown again.
        freezeOnBlur: true,
        animation: 'shift',
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Portfolio' }} />
      <Tabs.Screen name="watchlist" options={{ title: 'Watchlist' }} />
    </Tabs>
  );
}
