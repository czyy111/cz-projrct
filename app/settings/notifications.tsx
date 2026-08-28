import { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FormField } from '../../src/components/FormField';
import { Screen } from '../../src/components/Screen';
import { getNotificationDiagnostics, getNotificationPermissionState, requestNotificationPermission, type NotificationPermissionState } from '../../src/notifications/service';
import { getPreference, setPreference } from '../../src/repositories/preferences';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function NotificationSettingsScreen() {
  const theme = useAppTheme(); const [permission, setPermission] = useState<NotificationPermissionState>('undetermined'); const [defaultEnabled, setDefaultEnabled] = useState(false); const [allDayTime, setAllDayTime] = useState('09:00');
  const [diagnostics, setDiagnostics] = useState({ scheduled: 0, failed: 0 });
  const load = useCallback(() => void Promise.all([getNotificationPermissionState(), getPreference<boolean>('notification.default_enabled'), getPreference<string>('notification.all_day_time'), getNotificationDiagnostics()]).then(([p, enabled, time, state]) => { setPermission(p); setDefaultEnabled(enabled ?? false); setAllDayTime(time ?? '09:00'); setDiagnostics(state); }), []);
  useFocusEffect(load);
  const ask = async () => { const result = await requestNotificationPermission(); setPermission(result); if (result !== 'granted') Alert.alert('通知权限未开启', '任务仍会正常保存，你可以稍后到系统设置中开启通知。'); };
  const toggle = async (value: boolean) => { setDefaultEnabled(value); await setPreference('notification.default_enabled', value); };
  const saveTime = async () => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(allDayTime)) return Alert.alert('请按 HH:mm 填写时间'); await setPreference('notification.all_day_time', allDayTime); Alert.alert('已保存', '只影响之后新建的全天任务。'); };
  return <Screen title="通知设置" subtitle="每个任务最多发送一次有效通知"><Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.text }]}>系统通知权限</Text><Text style={{ color: permission === 'granted' ? theme.colors.success : theme.colors.warning }}>{permission === 'granted' ? '已开启' : permission === 'denied' ? '已拒绝' : '尚未询问'}</Text><Text style={[styles.help, { color: diagnostics.failed ? theme.colors.warning : theme.colors.secondaryText }]}>系统已安排 {diagnostics.scheduled} 条 · 待修复 {diagnostics.failed} 条</Text>{permission === 'undetermined' ? <Button title="开启系统通知" onPress={() => void ask()} /> : permission === 'denied' ? <Button title="前往系统设置" variant="secondary" onPress={() => void Linking.openSettings()} /> : null}</Card><Card style={styles.card}><View style={styles.switchRow}><View><Text style={[styles.heading, { color: theme.colors.text }]}>新任务默认开启提醒</Text><Text style={[styles.help, { color: theme.colors.secondaryText }]}>单个任务仍可单独修改</Text></View><Switch value={defaultEnabled} onValueChange={(value) => void toggle(value)} trackColor={{ true: theme.colors.brand }} /></View><FormField label="全天任务默认提醒时间" value={allDayTime} onChangeText={setAllDayTime} placeholder="HH:mm" /><Button title="保存默认时间" variant="secondary" onPress={() => void saveTime()} /></Card><Card style={styles.card}><Text style={[styles.help, { color: theme.colors.secondaryText }]}>系统中滚动维持最近约 60 条提醒。较远任务会在以后打开应用时进入安排窗口；专注模式等系统设置可能影响实际展示时间。</Text></Card></Screen>;
}
const styles = StyleSheet.create({ card: { marginBottom: 12, gap: 12 }, heading: { fontSize: 16, fontWeight: '600' }, help: { fontSize: 13, lineHeight: 19 }, switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 } });
