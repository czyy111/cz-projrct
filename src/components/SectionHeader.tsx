import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';

export function SectionHeader({ title, count }: { title: string; count?: number }) {
  const theme = useAppTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {typeof count === 'number' ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.brandSoft }]}>
          <Text style={[styles.badgeText, { color: theme.colors.brandPressed }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  badge: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 13, fontWeight: '600' },
});
