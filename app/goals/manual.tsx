import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ChoicePills } from '../../src/components/ChoicePills';
import { FormField } from '../../src/components/FormField';
import { Screen } from '../../src/components/Screen';
import type { GoalType, HabitMode, HabitPeriodUnit, PlanDraft } from '../../src/domain/types';
import { loadDraft, saveDraft } from '../../src/repositories/drafts';
import { updateGoalBasics } from '../../src/repositories/goals';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { createId } from '../../src/utils/id';

export default function ManualGoalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [type, setType] = useState<GoalType>('deadline');
  const [targetDate, setTargetDate] = useState('');
  const [habitCycle, setHabitCycle] = useState('每天');
  const [habitMode, setHabitMode] = useState<HabitMode>('consecutive');
  const [habitTarget, setHabitTarget] = useState('7');
  const [habitPeriodUnit, setHabitPeriodUnit] = useState<HabitPeriodUnit>('week');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [criteria, setCriteria] = useState('');
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!id) return;
    void loadDraft<{ mode: 'manual'; type: GoalType; targetDate: string; habitCycle: string; habitMode?: HabitMode; habitTarget?: string; habitPeriodUnit?: HabitPeriodUnit; taskTitle: string; taskDate: string; criteria: string }>(id, 'conditions').then((draft) => {
      if (draft?.mode === 'manual') { setType(draft.type); setTargetDate(draft.targetDate); setHabitCycle(draft.habitCycle); setHabitMode(draft.habitMode ?? 'consecutive'); setHabitTarget(draft.habitTarget ?? '7'); setHabitPeriodUnit(draft.habitPeriodUnit ?? 'week'); setTaskTitle(draft.taskTitle); setTaskDate(draft.taskDate); setCriteria(draft.criteria); }
      setHydrated(true);
    });
  }, [id]);
  useEffect(() => {
    if (!hydrated || !id) return;
    const timer = setTimeout(() => void saveDraft(id, 'conditions', { mode: 'manual', type, targetDate, habitCycle, habitMode, habitTarget, habitPeriodUnit, taskTitle, taskDate, criteria }), 900);
    return () => clearTimeout(timer);
  }, [hydrated, id, type, targetDate, habitCycle, habitMode, habitTarget, habitPeriodUnit, taskTitle, taskDate, criteria]);

  const submit = async () => {
    if (!id || !taskTitle.trim()) return Alert.alert('请至少填写一个初始任务');
    if (type === 'deadline' && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim())) return Alert.alert('请按 YYYY-MM-DD 填写目标日期');
    setSaving(true);
    try {
      await updateGoalBasics(id, { type, targetDate: type === 'deadline' ? targetDate.trim() : null, habitCycle: type === 'habit' ? habitCycle.trim() : null, habitMode: type === 'habit' ? habitMode : null, habitTargetCount: Number.parseInt(habitTarget, 10) || 1, habitPeriodUnit: type === 'habit' && habitMode === 'period_count' ? habitPeriodUnit : null });
      const stageId = createId('draft_stage');
      const plan: PlanDraft = {
        title: '手工计划', overview: '', source: 'manual',
        stages: [{ id: stageId, title: '第一阶段', description: '', order: 1, startDate: null, endDate: type === 'deadline' ? targetDate.trim() : null }],
        tasks: [{ id: createId('draft_task'), stageId, title: taskTitle.trim(), description: '', completionCriteria: criteria.trim(), date: taskDate.trim() || null, startTime: null, endTime: null, estimatedMinutes: null, reminderTime: null, order: 1, dependencyIds: [] }],
      };
      await saveDraft(id, 'plan', plan);
      router.replace({ pathname: '/goals/plan', params: { id } });
    } catch (error) { Alert.alert('保存失败', error instanceof Error ? error.message : '请稍后重试'); }
    finally { setSaving(false); }
  };

  return (
    <Screen title="手工规划" subtitle="先建立目标条件和第一个任务，之后可继续增删">
      <Card style={styles.card}><Text style={[styles.section, { color: theme.colors.text }]}>目标类型</Text><ChoicePills value={type} onChange={setType} choices={[{ value: 'deadline', label: '期限型目标' }, { value: 'habit', label: '长期习惯' }]} /></Card>
      <View style={styles.fields}>
        {type === 'deadline' ? <FormField label="目标日期" placeholder="YYYY-MM-DD" value={targetDate} onChangeText={setTargetDate} hint="例如：2026-09-30" /> : <><FormField label="习惯周期说明" value={habitCycle} onChangeText={setHabitCycle} placeholder="例如：每天、每周三次" /><ChoicePills value={habitMode} onChange={setHabitMode} choices={[{ value: 'consecutive', label: '连续执行日' }, { value: 'period_count', label: '周期次数' }]} /><FormField label={habitMode === 'consecutive' ? '阶段目标（连续天数）' : '阶段目标（完成次数）'} value={habitTarget} onChangeText={setHabitTarget} keyboardType="number-pad" />{habitMode === 'period_count' ? <ChoicePills value={habitPeriodUnit} onChange={setHabitPeriodUnit} choices={[{ value: 'week', label: '每周' }, { value: 'month', label: '每月' }]} /> : null}</>}
        <FormField label="第一个任务" value={taskTitle} onChangeText={setTaskTitle} placeholder="例如：完成第一课" />
        <FormField label="任务日期（可选）" value={taskDate} onChangeText={setTaskDate} placeholder="YYYY-MM-DD" />
        <FormField label="完成标准（可选）" value={criteria} onChangeText={setCriteria} placeholder="怎样才算完成？" multiline />
      </View>
      <Button title="进入计划审核" onPress={() => void submit()} loading={saving} style={styles.submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { marginBottom: 18 }, section: { fontSize: 16, fontWeight: '600', marginBottom: 12 }, fields: { gap: 16 }, submit: { marginTop: 24 } });
