import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors, type ColorScheme } from '@/theme/Colors';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'dark';
  const scheme = (colorScheme === 'light' || colorScheme === 'dark') ? colorScheme : 'dark';
  const activeTint = Colors[scheme].accent;
  const inactiveTint = Colors[scheme].muted;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarStyle: { backgroundColor: Colors[scheme].surface, borderTopWidth: 1, borderTopColor: Colors[scheme].border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIconStyle: { marginBottom: 2 },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="library" />
      <Tabs.Screen name="collections" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="about" />
    </Tabs>
  );
}