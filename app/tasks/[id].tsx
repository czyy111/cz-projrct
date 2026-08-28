import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import type { TaskWithGoal } from '../../src/domain/types';
import { reconcileNotifications } from '../../src/notifications/service';
import { completeTask, countTasksDependingOn, getTask, listTaskDependencies, reopenTask, skipTask, softDeleteTask } from '../../src/repositories/tasks';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { timeLabel } from '../../src/utils/dates';

export default function TaskDetailScreen() {
  const { id, action } = useLocalSearchParams<{ id: string; action?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [task, setTask] = useState<TaskWithGoal | null>(null);
  const [dependencies, setDependencies] = useState<TaskWithGoal[]>([]);
  const load = useCallback(() => { if (id) void Promise.all([getTask(id), listTaskDependencies(id)]).then(([value, deps]) => { setTask(value); setDependencies(deps); }); }, [id]);
  useFocusEffect(load);
  useEffect(() => { if (task && action === 'delay') router.replace({ pathname: '/tasks/reschedule', params: { id: task.id } }); }, [action, router, task]);
  const operate = async (kind: 'complete' | 'skip' | 'reopen') => {
    if (!task) return;
    const result = kind === 'complete' ? await completeTask(task.id) : null; if (kind === 'skip') await skipTask(task.id); else if (kind === 'reopen') await reopenTask(task.id);
    void reconcileNotifications(); load();
    if (result?.habitStageAchieved && result.goalId) router.push({ pathname: '/celebration', params: { goalId: result.goalId, type: 'habit' } });
  };
  const remove = async () => { if (!task) return; const dependentCount = await countTasksDependingOn(task.id); Alert.alert('删除任务？', `任务会进入最近删除，同时取消提醒。${dependentCount ? `另有 ${dependentCount} 项任务依赖它，删除后这些依赖将失效。` : ''}`, [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: async () => { await softDeleteTask(task.id); void reconcileNotifications(); router.back(); } }]); };
  return (
    <Screen title="任务详情" subtitle={task ? `${statusLabel(task.status)} · ${task.goalTitle}` : '正在读取…'} action={<Button title="编辑" variant="ghost" onPress={() => task && router.push({ pathname: '/tasks/edit', params: { id: task.id } })} style={styles.headerButton} />}>
      {task ? <>
        <Card style={styles.card}><Text style={[styles.title, { color: theme.colors.text }]}>{task.title}</Text><Text onPress={() => router.push({ pathname: '/goals/[id]', params: { id: task.goalId } })} style={[styles.goal, { color: theme.colors.brandPressed }]}>{task.goalTitle}{task.stageTitle ? ` / ${task.stageTitle}` : ''}</Text></Card>
        <Card style={styles.card}><Detail label="时间" value={`${task.startAt?.slice(0, 10) ?? task.dueAt?.slice(0, 10) ?? '未安排日期'} · ${timeLabel(task.startAt, task.dueAt)}`} /><Detail label="提醒" value={task.reminderAt ? task.reminderAt.replace('T', ' ').slice(0, 16) : '未开启'} /><Detail label="预计用时" value={task.estimatedMinutes ? `${task.estimatedMinutes} 分钟` : '未填写'} /></Card>
        <Card style={styles.card}><Detail label="完成标准" value={task.completionCriteria || '未填写'} /><Detail label="任务说明" value={task.description || '未填写'} /></Card>
        {dependencies.length ? <Card style={styles.card}><Text style={[styles.label, { color: theme.colors.secondaryText }]}>前置任务（仅提示）</Text>{dependencies.map((dependency) => <Text key={dependency.id} style={[styles.value, { color: dependency.status === 'completed' ? theme.colors.success : theme.colors.warning }]}>{dependency.status === 'completed' ? '✓' : '○'} {dependency.title} · {dependency.status === 'completed' ? '已完成' : dependency.status === 'skipped' ? '已跳过' : '尚未完成'}</Text>)}</Card> : null}
        <View style={styles.actions}>{task.status === 'pending' ? <><Button title="完成任务" onPress={() => void operate('complete')} /><Button title="延后或重新安排" variant="secondary" onPress={() => router.push({ pathname: '/tasks/reschedule', params: { id: task.id } })} /><Button title="跳过任务" variant="ghost" onPress={() => Alert.alert('跳过任务？', '跳过不计为完成，并会取消通知。', [{ text: '取消', style: 'cancel' }, { text: '跳过', onPress: () => void operate('skip') }])} /></> : <Button title="恢复为待完成" variant="secondary" onPress={() => void operate('reopen')} />}<Button title="删除任务" variant="danger" onPress={remove} /></View>
      </> : null}
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) { const theme = useAppTheme(); return <View style={styles.detail}><Text style={[styles.label, { color: theme.colors.secondaryText }]}>{label}</Text><Text style={[styles.value, { color: theme.colors.text }]}>{value}</Text></View>; }
const statusLabel = (status: TaskWithGoal['status']) => status === 'completed' ? '已完成' : status === 'skipped' ? '已跳过' : '待完成';
const styles = StyleSheet.create({ headerButton: { minHeight: 38, paddingHorizontal: 12 }, card: { marginBottom: 12, gap: 14 }, title: { fontSize: 22, fontWeight: '700' }, goal: { fontSize: 14, fontWeight: '600' }, detail: { gap: 4 }, label: { fontSize: 13 }, value: { fontSize: 16, lineHeight: 22 }, actions: { gap: 9, marginTop: 10 } });
