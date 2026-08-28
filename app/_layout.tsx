import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BootstrapGate } from '../src/components/BootstrapGate';
import { OnboardingGuard } from '../src/components/OnboardingGuard';
import { AppBootstrapProvider } from '../src/providers/AppBootstrapProvider';
import { useAppTheme } from '../src/theme/useAppTheme';
import { NotificationResponseHandler } from '../src/notifications/NotificationResponseHandler';
import { configureNotificationPresentation, reconcileNotifications } from '../src/notifications/service';

configureNotificationPresentation();

export default function RootLayout() {
  const theme = useAppTheme();

  return (
    <SafeAreaProvider>
      <AppBootstrapProvider>
        <BootstrapGate><OnboardingGuard>
          <View style={styles.root}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
            <NotificationResponseHandler />
            <StatusBar style={theme.isDark ? 'light' : 'dark'} />
          </View>
        </OnboardingGuard></BootstrapGate>
      </AppBootstrapProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
