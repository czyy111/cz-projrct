import type { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useBootstrapState } from '../providers/AppBootstrapProvider';
import { useAppTheme } from '../theme/useAppTheme';

export function BootstrapGate({ children }: PropsWithChildren) {
  const state = useBootstrapState();
  const theme = useAppTheme();

  if (state.status === 'ready') return children;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {state.status === 'loading' ? <ActivityIndicator color={theme.colors.brand} size="large" /> : <Text style={styles.icon}>!</Text>}
      <Text style={[styles.message, { color: state.status === 'error' ? theme.colors.danger : theme.colors.text }]}>
        {state.message}
      </Text>
      {state.status === 'error' ? (
        <Text style={[styles.help, { color: theme.colors.secondaryText }]}>应用没有清空任何数据，请重新打开后再试。</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  icon: { fontSize: 28, fontWeight: '700' },
  message: { marginTop: 14, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  help: { marginTop: 8, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
