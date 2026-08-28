import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ChoicePills } from '../../src/components/ChoicePills';
import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';
import type { Goal, TaskWithGoal } from '../../src/domain/types';
import { getGoalTaskSummary, listGoals } from '../../src/repositories/goals';
import { listGoalTasks } from '../../src/repositories/tasks';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { timeLabel } from '../../src/utils/dates';

type GoalCard = { goal: Goal; total: number; completed: number; next: TaskWithGoal | null };

export default function GoalsScreen() {
  const router = useRouter(); const theme = useAppTheme(); const [scope, setScope] = useState<'current' | 'history'>('current'); const [items, setItems] = useState<GoalCard[]>([]); const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => { let active = true; void listGoals().then(async (goals) => { const cards = await Promise.all(goals.map(async (goal) => { const [summary, tasks] = await Promise.all([getGoalTaskSummary(goal.id), listGoalTasks(goal.id, 'pending')]); return { goal, ...summary, next: tasks[0] ?? null }; })); if (active) { setItems(cards); setLoading(false); } }); return () => { active = false; }; }, []));
  const visible = items.filter(({ goal }) => scope === 'current' ? ['active', 'paused', 'draft'].includes(goal.status) : ['completed', 'terminated'].includes(goal.status));
  const ordered = [...visible].sort((a, b) => statusOrder(a.goal.status) - statusOrder(b.goal.status));
  return (
    <Screen title="目标" subtitle="管理期限目标和长期习惯" action={<Button title="新建" onPress={() => router.push('/goals/new')} style={styles.newButton} />}>
      <ChoicePills value={scope} onChange={setScope} choices={[{ value: 'current', label: '当前目标' }, { value: 'history', label: '历史目标' }]} />
      {!loading && ordered.length === 0 ? <EmptyState icon="橙" title={scope === 'current' ? '从一个目标开始' : '暂无历史目标'} description={scope === 'current' ? '先描述目标，再选择 AI 规划或手工规划。' : '已完成和已终止的目标会显示在这里。'} /> : <View style={styles.list}>{ordered.map(({ goal, total, completed, next }) => { const progress = total ? Math.round(completed / total * 100) : 0; return <Pressable key={goal.id} onPress={() => router.push({ pathname: '/goals/[id]', params: { id: goal.id } })}><Card><View style={styles.row}><Text style={[styles.title, { color: theme.colors.text }]}>{goal.title || '未命名目标'}</Text><Text style={{ color: theme.colors.secondaryText }}>›</Text></View><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>{goal.type === 'habit' ? '长期习惯' : '期限型目标'} · {statusLabel(goal.status)}</Text><View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}><View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.colors.brand }]} /></View><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>{completed}/{total} · {progress}%</Text>{next ? <Text style={[styles.next, { color: theme.colors.text }]}>下一项：{timeLabel(next.startAt, next.dueAt)} {next.title}</Text> : null}</Card></Pressable>; })}</View>}
    </Screen>
  );
}
const statusLabel = (status: Goal['status']) => ({ draft: '草稿', active: '执行中', paused: '已暂停', completed: '已完成', terminated: '已终止' })[status];
const statusOrder = (status: Goal['status']) => ({ active: 0, draft: 1, paused: 2, completed: 3, terminated: 4 })[status];
const styles = StyleSheet.create({ newButton: { minHeight: 40, paddingHorizontal: 15 }, list: { gap: 12, marginTop: 16 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, title: { flex: 1, fontSize: 17, fontWeight: '600' }, meta: { marginTop: 7, fontSize: 13 }, progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 12 }, progressFill: { height: 6, borderRadius: 3 }, next: { marginTop: 9, fontSize: 14 } });
