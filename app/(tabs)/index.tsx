import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';
import { TaskListItem } from '../../src/components/TaskListItem';
import type { TaskWithGoal } from '../../src/domain/types';
import { groupOverdueByGoal } from '../../src/domain/taskLogic';
import { reconcileNotifications } from '../../src/notifications/service';
import { completeTask, listTodayAndOverdue, reopenTask } from '../../src/repositories/tasks';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function TodayScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [today, setToday] = useState<TaskWithGoal[]>([]);
  const [overdue, setOverdue] = useState<TaskWithGoal[]>([]);
  const [undo, setUndo] = useState<TaskWithGoal | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(() => void listTodayAndOverdue().then((value) => { setToday(value.today); setOverdue(value.overdue); }), []);
  useFocusEffect(useCallback(() => { load(); return () => { if (undoTimer.current) clearTimeout(undoTimer.current); }; }, [load]));
  const complete = async (task: TaskWithGoal) => {
    const result = await completeTask(task.id); void reconcileNotifications(); setUndo(task); load();
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
    if (result.habitStageAchieved && result.goalId) router.push({ pathname: '/celebration', params: { goalId: result.goalId, type: 'habit' } });
  };
  const undoComplete = async () => { if (!undo) return; await reopenTask(undo.id); setUndo(null); load(); void reconcileNotifications(); };
  const overdueGroups = groupOverdueByGoal(overdue);

  return (
    <Screen title="今日" subtitle={new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}>
      {overdue.length > 0 ? <View style={styles.section}><Text style={[styles.sectionTitle, { color: theme.colors.danger }]}>逾期任务</Text>{Object.entries(overdueGroups).map(([goalTitle, tasks]) => <Card key={goalTitle} style={styles.card}><Text style={[styles.groupTitle, { color: theme.colors.text }]}>{goalTitle}</Text>{tasks.map((task) => <TaskListItem key={task.id} task={task} showGoal={false} onComplete={() => void complete(task)} onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: task.id } })} />)}</Card>)}</View> : null}
      <View style={styles.section}><Text style={[styles.sectionTitle, { color: theme.colors.text }]}>今天的任务</Text>{today.length ? <Card style={styles.card}>{today.map((task) => <TaskListItem key={task.id} task={task} onComplete={() => void complete(task)} onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: task.id } })} />)}</Card> : <EmptyState icon="✓" title="今天还没有任务" description="创建目标并确认计划后，今天的任务会出现在这里。" />}</View>
      {undo ? <Pressable onPress={() => void undoComplete()} style={[styles.undo, { backgroundColor: theme.colors.text }]}><Text style={{ color: theme.colors.background }}>“{undo.title}”已完成</Text><Text style={{ color: theme.colors.brand, fontWeight: '700' }}>撤销</Text></Pressable> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { marginBottom: 22, gap: 10 }, sectionTitle: { fontSize: 19, fontWeight: '700' }, card: { paddingVertical: 2 }, groupTitle: { paddingTop: 13, paddingBottom: 4, fontSize: 15, fontWeight: '700' }, undo: { marginTop: 8, minHeight: 48, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 } });
