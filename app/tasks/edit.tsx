import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FormField } from '../../src/components/FormField';
import { Screen } from '../../src/components/Screen';
import type { TaskWithGoal } from '../../src/domain/types';
import { reconcileNotifications } from '../../src/notifications/service';
import { getTask, listGoalTasks, listTaskDependencyIds, updateTask } from '../../src/repositories/tasks';
import { combineLocalDateTime, taskDateKey } from '../../src/utils/dates';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function TaskEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter(); const theme = useAppTheme();
  const [task, setTask] = useState<TaskWithGoal | null>(null); const [others, setOthers] = useState<TaskWithGoal[]>([]); const [dependencies, setDependencies] = useState<string[]>([]);
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [criteria, setCriteria] = useState(''); const [date, setDate] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [reminder, setReminder] = useState(''); const [minutes, setMinutes] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!id) return; void getTask(id).then(async (value) => { setTask(value); if (!value) return; setTitle(value.title); setDescription(value.description); setCriteria(value.completionCriteria); setDate(taskDateKey(value.startAt, value.dueAt) ?? ''); setStart(value.startAt?.slice(11, 16) ?? ''); setEnd(value.dueAt?.slice(11, 16) === '23:59' ? '' : value.dueAt?.slice(11, 16) ?? ''); setReminder(value.reminderAt?.slice(11, 16) ?? ''); setMinutes(value.estimatedMinutes?.toString() ?? ''); setOthers((await listGoalTasks(value.goalId)).filter((item) => item.id !== value.id)); setDependencies(await listTaskDependencyIds(value.id)); }); }, [id]);
  const save = async () => {
    if (!task || !title.trim()) return Alert.alert('任务名称不能为空'); if (!date) return Alert.alert('任务需要日期'); if (start && end && start > end) return Alert.alert('开始时间不能晚于截止时间');
    setSaving(true); try { await updateTask(task.id, { title, description, completionCriteria: criteria, startAt: start ? combineLocalDateTime(date, start) : null, dueAt: combineLocalDateTime(date, end || null, !end), reminderAt: reminder ? combineLocalDateTime(date, reminder) : null, estimatedMinutes: minutes ? Number(minutes) || null : null, dependencyIds: dependencies }); await reconcileNotifications(); router.back(); } catch (error) { Alert.alert('保存失败', error instanceof Error ? error.message : '请重试'); } finally { setSaving(false); }
  };
  return <Screen title="编辑任务" subtitle={task?.goalTitle}><View style={styles.fields}><FormField label="任务名称" value={title} onChangeText={setTitle} /><FormField label="任务说明" value={description} onChangeText={setDescription} multiline /><FormField label="完成标准" value={criteria} onChangeText={setCriteria} multiline /><FormField label="日期" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /><View style={styles.row}><View style={styles.half}><FormField label="开始" value={start} onChangeText={setStart} placeholder="HH:mm" /></View><View style={styles.half}><FormField label="截止" value={end} onChangeText={setEnd} placeholder="HH:mm" /></View></View><FormField label="提醒时间" value={reminder} onChangeText={setReminder} placeholder="HH:mm，可留空" /><FormField label="预计用时（分钟）" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" /><Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.text }]}>前置任务（仅提示）</Text>{others.map((other) => { const selected = dependencies.includes(other.id); return <Pressable key={other.id} onPress={() => setDependencies(selected ? dependencies.filter((value) => value !== other.id) : [...dependencies, other.id])} style={[styles.dependency, { borderColor: selected ? theme.colors.brand : theme.colors.border, backgroundColor: selected ? theme.colors.brandSoft : theme.colors.card }]}><Text style={{ color: theme.colors.text }}>{selected ? '✓ ' : ''}{other.title}</Text></Pressable>; })}</Card></View><Button title="保存修改" onPress={() => void save()} loading={saving} style={styles.button} /></Screen>;
}
const styles = StyleSheet.create({ fields: { gap: 16 }, row: { flexDirection: 'row', gap: 10 }, half: { flex: 1 }, card: { gap: 9 }, heading: { fontSize: 16, fontWeight: '600' }, dependency: { minHeight: 44, borderWidth: 1, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 12 }, button: { marginTop: 24 } });
