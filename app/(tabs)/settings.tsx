import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useBootstrapState } from '../../src/providers/AppBootstrapProvider';
import { useAppTheme } from '../../src/theme/useAppTheme';

const settingItems = [
  { title: '大模型 API 配置', path: '/settings/api' as const },
  { title: '通知设置', path: '/settings/notifications' as const },
  { title: '最近删除', path: '/settings/deleted' as const },
  { title: '数据与隐私', path: '/settings/privacy' as const },
  { title: '应用说明', path: '/settings/about' as const },
];

export default function SettingsScreen() {
  const theme = useAppTheme();
  const bootstrap = useBootstrapState();
  const router = useRouter();

  return (
    <Screen title="设置" subtitle="管理模型、提醒和本地数据">
      <Card style={styles.statusCard}>
        <Text style={[styles.statusTitle, { color: theme.colors.text }]}>本地数据</Text>
        <Text style={[styles.statusText, { color: bootstrap.status === 'ready' ? theme.colors.success : theme.colors.warning }]}>
          {bootstrap.message}
        </Text>
      </Card>
      <Card>
        {settingItems.map((item, index) => (
          <Pressable
            key={item.title}
            disabled={!item.path}
            onPress={() => item.path && router.push(item.path)}
            style={[
              styles.row,
              index < settingItems.length - 1 && { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Text style={[styles.itemText, { color: theme.colors.text }]}>{item.title}</Text>
            <Text style={[styles.chevron, { color: theme.colors.secondaryText }]}>›</Text>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusCard: { marginBottom: 16 },
  statusTitle: { fontSize: 16, fontWeight: '600' },
  statusText: { marginTop: 6, fontSize: 14 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemText: { fontSize: 16 },
  chevron: { fontSize: 24 },
});
