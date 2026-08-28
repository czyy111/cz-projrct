import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';

type EmptyStateProps = {
  icon: string;
  title: string;
  description: string;
};

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.icon} accessibilityElementsHidden>
        {icon}
      </Text>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.colors.secondaryText }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  icon: { fontSize: 36, marginBottom: 12 },
  title: { fontSize: 18, lineHeight: 26, fontWeight: '600', textAlign: 'center' },
  description: { marginTop: 6, maxWidth: 300, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
