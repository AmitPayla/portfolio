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
        // Hidden tabs are frozen by <FreezeWhenHidden> in each route file: this
        // version's JS tabs ignore `freezeOnBlur`.
        animation: 'shift',
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Portfolio' }} />
      <Tabs.Screen name="watchlist" options={{ title: 'Watchlist' }} />
    </Tabs>
  );
}
