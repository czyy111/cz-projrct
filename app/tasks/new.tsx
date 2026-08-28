import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ChoicePills } from '../../src/components/ChoicePills';
import { FormField } from '../../src/components/FormField';
import { Screen } from '../../src/components/Screen';
import type { Goal } from '../../src/domain/types';
import { reconcileNotifications } from '../../src/notifications/service';
import { listGoals } from '../../src/repositories/goals';
import { getPreference } from '../../src/repositories/preferences';
import { createTask } from '../../src/repositories/tasks';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { combineLocalDateTime, localDateKey } from '../../src/utils/dates';

export default function NewTaskScreen() {
  const { date: initialDate, goalId: initialGoalId } = useLocalSearchParams<{ date?: string; goalId?: string }>(); const router = useRouter(); const theme = useAppTheme();
  const [goals, setGoals] = useState<Goal[]>([]); const [goalId, setGoalId] = useState(initialGoalId ?? ''); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [criteria, setCriteria] = useState(''); const [date, setDate] = useState(initialDate ?? localDateKey()); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [reminder, setReminder] = useState(''); const [minutes, setMinutes] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { void listGoals().then((items) => { const active = items.filter((goal) => goal.status === 'active'); setGoals(active); if (!goalId && active[0]) setGoalId(active[0].id); }); }, [goalId]);
  useEffect(() => { void Promise.all([getPreference<boolean>('notification.default_enabled'), getPreference<string>('notification.all_day_time')]).then(([enabled, time]) => { if (enabled) setReminder(time ?? '09:00'); }); }, []);
  const save = async () => {
    if (!goalId) return Alert.alert('请先选择所属目标'); if (!title.trim()) return Alert.alert('请填写任务名称'); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('请按 YYYY-MM-DD 填写日期'); if (start && end && start > end) return Alert.alert('开始时间不能晚于截止时间');
    setSaving(true); try { const id = await createTask({ goalId, title, description, completionCriteria: criteria, startAt: start ? combineLocalDateTime(date, start) : null, dueAt: combineLocalDateTime(date, end || null, !end), reminderAt: reminder ? combineLocalDateTime(date, reminder) : null, estimatedMinutes: minutes ? Number(minutes) || null : null }); await reconcileNotifications(); router.replace({ pathname: '/tasks/[id]', params: { id } }); } catch (error) { Alert.alert('创建失败', error instanceof Error ? error.message : '请稍后重试'); } finally { setSaving(false); }
  };
  return <Screen title="新增任务" subtitle="任务必须归属于一个已有目标"><Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.text }]}>所属目标</Text>{goals.length ? <ChoicePills value={goalId} onChange={setGoalId} choices={goals.map((goal) => ({ value: goal.id, label: goal.title }))} /> : <Text style={{ color: theme.colors.secondaryText }}>暂无执行中的目标，请先确认一个计划。</Text>}</Card><View style={styles.fields}><FormField label="任务名称" value={title} onChangeText={setTitle} /><FormField label="说明" value={description} onChangeText={setDescription} multiline /><FormField label="完成标准" value={criteria} onChangeText={setCriteria} multiline /><FormField label="日期" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /><View style={styles.row}><View style={styles.half}><FormField label="开始" value={start} onChangeText={setStart} placeholder="HH:mm" /></View><View style={styles.half}><FormField label="截止" value={end} onChangeText={setEnd} placeholder="HH:mm" /></View></View><FormField label="提醒时间" value={reminder} onChangeText={setReminder} placeholder="HH:mm，可留空" /><FormField label="预计用时（分钟）" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" /></View><Button title="创建任务" onPress={() => void save()} loading={saving} disabled={!goals.length} style={styles.button} /></Screen>;
}
const styles = StyleSheet.create({ card: { gap: 12, marginBottom: 16 }, heading: { fontSize: 16, fontWeight: '600' }, fields: { gap: 16 }, row: { flexDirection: 'row', gap: 10 }, half: { flex: 1 }, button: { marginTop: 24 } });
