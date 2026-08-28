import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ChoicePills } from '../../src/components/ChoicePills';
import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';
import type { Goal, TaskWithGoal } from '../../src/domain/types';
import { reconcileNotifications } from '../../src/notifications/service';
import { listDeletedGoals, restoreGoal } from '../../src/repositories/goals';
import { listDeletedTasks, restoreTask } from '../../src/repositories/tasks';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function DeletedScreen() {
  const theme = useAppTheme(); const [scope, setScope] = useState<'goals' | 'tasks'>('goals'); const [goals, setGoals] = useState<Goal[]>([]); const [tasks, setTasks] = useState<TaskWithGoal[]>([]);
  const load = useCallback(() => void Promise.all([listDeletedGoals(), listDeletedTasks()]).then(([g, t]) => { setGoals(g); setTasks(t); }), []); useFocusEffect(load);
  const restoreGoalItem = async (id: string) => { await restoreGoal(id); await reconcileNotifications(); load(); }; const restoreTaskItem = async (id: string) => { await restoreTask(id); await reconcileNotifications(); load(); };
  const empty = scope === 'goals' ? goals.length === 0 : tasks.length === 0;
  return <Screen title="最近删除" subtitle="恢复后会重新检查日期、依赖和提醒"><ChoicePills value={scope} onChange={setScope} choices={[{ value: 'goals', label: '目标' }, { value: 'tasks', label: '任务' }]} />{empty ? <EmptyState icon="删" title="最近删除为空" description="删除的目标和任务会保留在本机，当前不会自动永久清除。" /> : <View style={styles.list}>{scope === 'goals' ? goals.map((goal) => <Card key={goal.id}><Text style={[styles.title, { color: theme.colors.text }]}>{goal.title}</Text><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>目标及其计划、任务和历史记录</Text><Button title="恢复目标" variant="secondary" onPress={() => void restoreGoalItem(goal.id)} style={styles.button} /></Card>) : tasks.map((task) => <Card key={task.id}><Text style={[styles.title, { color: theme.colors.text }]}>{task.title}</Text><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>所属目标：{task.goalTitle}</Text><Button title="恢复任务" variant="secondary" onPress={() => void restoreTaskItem(task.id)} style={styles.button} /></Card>)}</View>}</Screen>;
}
const styles = StyleSheet.create({ list: { gap: 12, marginTop: 16 }, title: { fontSize: 17, fontWeight: '600' }, meta: { marginTop: 6, fontSize: 13 }, button: { marginTop: 12, minHeight: 40 } });
