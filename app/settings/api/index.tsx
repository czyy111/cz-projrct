import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { EmptyState } from '../../../src/components/EmptyState';
import { Screen } from '../../../src/components/Screen';
import type { ApiConfig } from '../../../src/domain/types';
import { deleteApiConfig, listApiConfigs, setDefaultApiConfig } from '../../../src/repositories/apiConfigs';
import { useAppTheme } from '../../../src/theme/useAppTheme';

export default function ApiConfigListScreen() {
  const { returnGoalId, onboarding } = useLocalSearchParams<{ returnGoalId?: string; onboarding?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [items, setItems] = useState<ApiConfig[]>([]);
  const load = useCallback(() => void listApiConfigs().then(setItems), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const remove = (item: ApiConfig) => Alert.alert('删除 API 配置？', '历史计划不会删除，但以后调用需要选择其他配置。', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: async () => { await deleteApiConfig(item.id); load(); } }]);
  const makeDefault = async (id: string) => { await setDefaultApiConfig(id); load(); };
  const editParams = (configId?: string) => ({ pathname: '/settings/api/edit' as const, params: { ...(configId ? { configId } : {}), ...(returnGoalId ? { returnGoalId } : {}), ...(onboarding ? { onboarding } : {}) } });
  return (
    <Screen title="API 配置" subtitle="可保存多套国产及兼容模型配置" action={<Button title="新增" onPress={() => router.push(editParams())} style={styles.add} />}>
      {items.length === 0 ? <EmptyState icon="AI" title="还没有模型配置" description="API Key 只保存在手机安全存储中，不进入业务备份。" /> : <View style={styles.list}>{items.map((item) => <Card key={item.id}><Pressable onPress={() => router.push(editParams(item.id))}><View style={styles.row}><Text style={[styles.title, { color: theme.colors.text }]}>{item.name}</Text>{item.isDefault ? <Text style={[styles.default, { color: theme.colors.brandPressed, backgroundColor: theme.colors.brandSoft }]}>默认</Text> : null}</View><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>{item.model} · {item.provider}</Text><Text style={[styles.meta, { color: item.lastTestStatus === 'success' ? theme.colors.success : theme.colors.secondaryText }]}>{item.lastTestAt ? `${item.lastTestStatus === 'success' ? '最近测试成功' : '最近测试失败'} · ${new Date(item.lastTestAt).toLocaleString('zh-CN')}` : '尚未测试'}</Text></Pressable><View style={styles.actions}>{!item.isDefault ? <Button title="设为默认" variant="secondary" onPress={() => void makeDefault(item.id)} style={styles.small} /> : null}<Button title="删除" variant="ghost" onPress={() => remove(item)} style={styles.small} /></View></Card>)}</View>}
      {returnGoalId && items.length ? <Button title="返回目标规划" onPress={() => router.replace({ pathname: '/goals/method', params: { id: returnGoalId } })} style={styles.return} /> : null}
      {onboarding ? <Button title="返回首次设置" onPress={() => router.replace({ pathname: '/onboarding', params: { step: '2' } })} style={styles.return} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ add: { minHeight: 40, paddingHorizontal: 14 }, list: { gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { fontSize: 17, fontWeight: '600' }, default: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12 }, meta: { marginTop: 7, fontSize: 13 }, actions: { marginTop: 12, flexDirection: 'row', gap: 8 }, small: { minHeight: 38, flex: 1 }, return: { marginTop: 20 } });
