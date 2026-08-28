import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useAppTheme } from '../../src/theme/useAppTheme';

const icons: Record<string, string> = {
  index: '✓',
  calendar: '日',
  goals: '橙',
  settings: '⚙',
};

export default function TabLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brandPressed,
        tabBarInactiveTintColor: theme.colors.secondaryText,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          height: 84,
          paddingTop: 8,
          paddingBottom: 20,
        },
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons[route.name] ?? '•'}</Text>,
      })}
    >
      <Tabs.Screen name="index" options={{ title: '今日' }} />
      <Tabs.Screen name="calendar" options={{ title: '日历' }} />
      <Tabs.Screen name="goals" options={{ title: '目标' }} />
      <Tabs.Screen name="settings" options={{ title: '设置' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 20, lineHeight: 24, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '500' },
});
