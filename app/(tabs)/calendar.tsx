import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';
import { TaskListItem } from '../../src/components/TaskListItem';
import type { TaskWithGoal } from '../../src/domain/types';
import { reconcileNotifications } from '../../src/notifications/service';
import { completeTask, listTasksForDate, listTasksInDateRange } from '../../src/repositories/tasks';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { localDateKey, monthGrid } from '../../src/utils/dates';

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

export default function CalendarScreen() {
  const router = useRouter(); const theme = useAppTheme(); const now = new Date();
  const [year, setYear] = useState(now.getFullYear()); const [month, setMonth] = useState(now.getMonth()); const [selected, setSelected] = useState(localDateKey(now)); const [tasks, setTasks] = useState<TaskWithGoal[]>([]); const [monthTasks, setMonthTasks] = useState<TaskWithGoal[]>([]);
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const load = useCallback(() => { const from = grid[0].date; const to = grid.at(-1)!.date; void Promise.all([listTasksForDate(selected), listTasksInDateRange(from, to)]).then(([day, all]) => { setTasks(day); setMonthTasks(all); }); }, [grid, selected]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const counts = monthTasks.reduce<Record<string, number>>((result, task) => { const key = (task.startAt ?? task.dueAt)?.slice(0, 10); if (key) result[key] = (result[key] ?? 0) + 1; return result; }, {});
  const moveMonth = (offset: number) => { const date = new Date(year, month + offset, 1); setYear(date.getFullYear()); setMonth(date.getMonth()); setSelected(localDateKey(date)); };
  const goToday = () => { const date = new Date(); setYear(date.getFullYear()); setMonth(date.getMonth()); setSelected(localDateKey(date)); };
  const complete = async (id: string) => { const result = await completeTask(id); void reconcileNotifications(); load(); if (result.habitStageAchieved && result.goalId) router.push({ pathname: '/celebration', params: { goalId: result.goalId, type: 'habit' } }); };
  return (
    <Screen title={`${year}年${month + 1}月`} subtitle="按日期查看和安排任务" action={<Button title="今天" variant="ghost" onPress={goToday} style={styles.small} />}>
      <Card style={styles.calendar}><View style={styles.monthNav}><Pressable onPress={() => moveMonth(-1)}><Text style={[styles.arrow, { color: theme.colors.text }]}>‹</Text></Pressable><Text style={[styles.monthTitle, { color: theme.colors.text }]}>{year}年 {month + 1}月</Text><Pressable onPress={() => moveMonth(1)}><Text style={[styles.arrow, { color: theme.colors.text }]}>›</Text></Pressable></View><View style={styles.week}>{weekdays.map((day) => <Text key={day} style={[styles.weekday, { color: theme.colors.secondaryText }]}>{day}</Text>)}</View><View style={styles.grid}>{grid.map((cell) => { const active = cell.date === selected; return <Pressable key={cell.date} onPress={() => setSelected(cell.date)} style={[styles.day, active && { backgroundColor: theme.colors.brand }]}><Text style={{ color: active ? '#FFFFFF' : cell.inMonth ? theme.colors.text : theme.colors.secondaryText, opacity: cell.inMonth || active ? 1 : 0.5 }}>{cell.day}</Text>{counts[cell.date] ? <Text style={[styles.count, { color: active ? '#FFFFFF' : theme.colors.brandPressed }]}>{counts[cell.date]}</Text> : null}</Pressable>; })}</View></Card>
      <View style={styles.dayHeader}><View><Text style={[styles.dayTitle, { color: theme.colors.text }]}>{selected}</Text><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>{tasks.length} 项任务</Text></View><Button title="新增" variant="secondary" onPress={() => router.push({ pathname: '/tasks/new', params: { date: selected } })} style={styles.small} /></View>
      {tasks.length ? <Card style={styles.taskCard}>{tasks.map((task) => <TaskListItem key={task.id} task={task} onComplete={task.status === 'pending' ? () => void complete(task.id) : undefined} onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: task.id } })} />)}</Card> : <EmptyState icon="日" title="这一天没有任务" description="可以新增任务并选择所属目标。" />}
    </Screen>
  );
}

const styles = StyleSheet.create({ small: { minHeight: 38, paddingHorizontal: 12 }, calendar: { paddingHorizontal: 8 }, monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 8 }, arrow: { fontSize: 32, paddingHorizontal: 10 }, monthTitle: { fontSize: 17, fontWeight: '600' }, week: { flexDirection: 'row' }, weekday: { width: '14.285%', textAlign: 'center', fontSize: 12, paddingVertical: 7 }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, day: { width: '14.285%', height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, count: { fontSize: 10, fontWeight: '700', marginTop: 1 }, dayHeader: { marginTop: 18, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, dayTitle: { fontSize: 18, fontWeight: '700' }, meta: { marginTop: 2, fontSize: 13 }, taskCard: { paddingVertical: 2 } });
