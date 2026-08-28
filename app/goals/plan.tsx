import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ChoicePills } from '../../src/components/ChoicePills';
import { Screen } from '../../src/components/Screen';
import { validatePlanDraft } from '../../src/domain/planValidation';
import type { Goal, PlanDraft, PlanDraftTask } from '../../src/domain/types';
import { hasPreviousPlanDraft, loadPlanDraft, restorePreviousPlanDraft, saveDraft } from '../../src/repositories/drafts';
import { getGoal } from '../../src/repositories/goals';
import { confirmPlan } from '../../src/repositories/plans';
import { reconcileNotifications, requestNotificationPermission } from '../../src/notifications/service';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { createId } from '../../src/utils/id';

export default function PlanReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [plan, setPlan] = useState<PlanDraft | null>(null);
  const [view, setView] = useState<'stage' | 'date'>('stage');
  const [saving, setSaving] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  useFocusEffect(useCallback(() => { if (!id) return; let active = true; void Promise.all([getGoal(id), loadPlanDraft(id), hasPreviousPlanDraft(id)]).then(([g, p, old]) => { if (active) { setGoal(g); setPlan(p); setHasPrevious(old); } }); return () => { active = false; }; }, [id]));
  const issues = useMemo(() => plan ? validatePlanDraft(plan, goal) : [], [plan, goal]);
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  const addTask = async () => {
    if (!plan || !id) return;
    const task: PlanDraftTask = { id: createId('draft_task'), stageId: plan.stages[0]?.id ?? null, title: '', description: '', completionCriteria: '', date: null, startTime: null, endTime: null, estimatedMinutes: null, reminderTime: null, order: plan.tasks.length + 1, dependencyIds: [] };
    await saveDraft(id, 'plan', { ...plan, tasks: [...plan.tasks, task] });
    router.push({ pathname: '/goals/task-edit', params: { id, taskId: task.id } });
  };
  const doConfirm = async () => {
    if (!plan || !id || errors.length) return;
    setSaving(true);
    try {
      await confirmPlan(id, plan);
      const notification = await reconcileNotifications();
      router.replace({ pathname: '/goals/[id]', params: { id } });
      if (notification.permission === 'undetermined' && plan.tasks.some((task) => task.reminderTime)) {
        Alert.alert('是否开启任务通知？', '开启后，手机会在你设置的提醒时间发送一次系统通知。', [{ text: '稍后', style: 'cancel' }, { text: '开启', onPress: () => void requestNotificationPermission() }]);
      }
    }
    catch (error) { Alert.alert('确认失败', error instanceof Error ? error.message : '请稍后重试'); }
    finally { setSaving(false); }
  };
  const confirm = () => warnings.length ? Alert.alert('计划还有普通警告', `共有 ${warnings.length} 项警告，不会阻止确认。是否继续？`, [{ text: '返回检查', style: 'cancel' }, { text: '仍然确认', onPress: () => void doConfirm() }]) : void doConfirm();
  const restore = () => Alert.alert('恢复最近一个旧草稿？', '当前草稿会保留为可恢复版本，两份草稿可以再次切换。', [{ text: '取消', style: 'cancel' }, { text: '恢复', onPress: async () => { if (id && await restorePreviousPlanDraft(id)) { setPlan(await loadPlanDraft(id)); setHasPrevious(true); } } }]);
  const sortedTasks = useMemo(() => [...(plan?.tasks ?? [])].sort((a, b) => view === 'date' ? `${a.date ?? '9999'}${a.startTime ?? ''}`.localeCompare(`${b.date ?? '9999'}${b.startTime ?? ''}`) : a.order - b.order), [plan, view]);

  return (
    <Screen title="审核计划草稿" subtitle="修改内容会同步到两种视图" action={<Button title="新增任务" variant="secondary" onPress={() => void addTask()} style={styles.add} />}>
      <Card style={styles.summary}><Text style={[styles.planTitle, { color: theme.colors.text }]}>{plan?.title ?? '正在读取计划…'}</Text><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>已自动保存 · {errors.length} 项错误 · {warnings.length} 项警告</Text>{plan?.overview ? <Text style={[styles.overview, { color: theme.colors.secondaryText }]}>{plan.overview}</Text> : null}</Card>
      <ChoicePills value={view} onChange={setView} choices={[{ value: 'stage', label: '按阶段' }, { value: 'date', label: '按日期' }]} />
      {issues.length ? <Card style={[styles.issues, { backgroundColor: errors.length ? theme.colors.dangerSoft : theme.colors.warningSoft }]}>{issues.slice(0, 5).map((issue, index) => <Text key={`${issue.code}-${issue.taskId}-${index}`} style={{ color: issue.severity === 'error' ? theme.colors.danger : theme.colors.warning }}>• {issue.message}</Text>)}</Card> : null}
      <View style={styles.tasks}>{sortedTasks.map((task) => <Pressable key={task.id} onPress={() => router.push({ pathname: '/goals/task-edit', params: { id, taskId: task.id } })}><Card><View style={styles.row}><Text style={[styles.taskTitle, { color: task.title ? theme.colors.text : theme.colors.danger }]}>{task.title || '未命名任务'}</Text><Text style={{ color: theme.colors.secondaryText }}>›</Text></View><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>{task.date ?? `顺序 ${task.order}`} {task.startTime ? `· ${task.startTime}${task.endTime ? `–${task.endTime}` : ''}` : ''}{view === 'stage' ? ` · ${plan?.stages.find((stage) => stage.id === task.stageId)?.title ?? '未分阶段'}` : ''}</Text>{issues.filter((issue) => issue.taskId === task.id).map((issue, index) => <Text key={`${issue.code}-${index}`} style={[styles.issueLine, { color: issue.severity === 'error' ? theme.colors.danger : theme.colors.warning }]}>{issue.message}</Text>)}</Card></Pressable>)}</View>
      <View style={styles.actions}><Button title="AI 调整或重新生成" variant="secondary" onPress={() => router.push({ pathname: '/goals/plan-adjust', params: { id } })} /><Button title="恢复最近旧草稿" variant="ghost" onPress={restore} disabled={!hasPrevious} /><Button title="确认计划" onPress={confirm} disabled={errors.length > 0 || !plan} loading={saving} /></View>
    </Screen>
  );
}

const styles = StyleSheet.create({ add: { minHeight: 40, paddingHorizontal: 12 }, summary: { marginBottom: 12 }, planTitle: { fontSize: 18, fontWeight: '600' }, meta: { marginTop: 6, fontSize: 13 }, overview: { marginTop: 8, lineHeight: 20 }, issues: { marginTop: 12, gap: 6 }, tasks: { gap: 10, marginTop: 14 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, taskTitle: { flex: 1, fontSize: 16, fontWeight: '600' }, issueLine: { marginTop: 6, fontSize: 13 }, actions: { gap: 8, marginTop: 22 } });
