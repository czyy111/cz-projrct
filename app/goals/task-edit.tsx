import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ChoicePills } from '../../src/components/ChoicePills';
import { FormField } from '../../src/components/FormField';
import { Screen } from '../../src/components/Screen';
import type { PlanDraft, PlanDraftTask } from '../../src/domain/types';
import { validatePlanDraft } from '../../src/domain/planValidation';
import { loadPlanDraft, saveDraft } from '../../src/repositories/drafts';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function DraftTaskEditScreen() {
  const { id, taskId } = useLocalSearchParams<{ id: string; taskId: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [plan, setPlan] = useState<PlanDraft | null>(null);
  const [task, setTask] = useState<PlanDraftTask | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (id) void loadPlanDraft(id).then((value) => { setPlan(value); setTask(value?.tasks.find((item) => item.id === taskId) ?? null); }); }, [id, taskId]);
  const set = <K extends keyof PlanDraftTask>(key: K, value: PlanDraftTask[K]) => setTask((old) => old ? { ...old, [key]: value } : old);
  const save = async () => {
    if (!plan || !task || !id) return;
    const next = { ...plan, tasks: plan.tasks.map((item) => item.id === task.id ? task : item) };
    const error = validatePlanDraft(next).find((issue) => issue.taskId === task.id && issue.severity === 'error');
    if (error) return Alert.alert('暂时不能保存', error.message);
    setSaving(true); try { await saveDraft(id, 'plan', next); router.back(); } catch (cause) { Alert.alert('保存失败', cause instanceof Error ? cause.message : '请重试'); } finally { setSaving(false); }
  };
  const remove = () => Alert.alert('删除草稿任务？', '只会从当前草稿中删除，可以在确认计划前继续调整。', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: async () => { if (plan && id && task) { await saveDraft(id, 'plan', { ...plan, tasks: plan.tasks.filter((item) => item.id !== task.id).map((item) => ({ ...item, dependencyIds: item.dependencyIds.filter((dependency) => dependency !== task.id) })) }); router.back(); } } }]);
  if (!task || !plan) return <Screen title="编辑草稿任务"><Text style={{ color: theme.colors.secondaryText }}>正在读取任务…</Text></Screen>;

  return (
    <Screen title="编辑草稿任务" subtitle="草稿任务不会安排正式通知">
      <View style={styles.fields}>
        <FormField label="任务名称" value={task.title} onChangeText={(value) => set('title', value)} />
        <FormField label="任务说明" value={task.description} onChangeText={(value) => set('description', value)} multiline />
        <FormField label="完成标准" value={task.completionCriteria} onChangeText={(value) => set('completionCriteria', value)} multiline />
        <Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.text }]}>所属阶段</Text><ChoicePills value={task.stageId ?? 'none'} onChange={(value) => set('stageId', value === 'none' ? null : value)} choices={[{ value: 'none', label: '未分阶段' }, ...plan.stages.map((stage) => ({ value: stage.id, label: stage.title }))]} /></Card>
        <FormField label="日期" value={task.date ?? ''} onChangeText={(value) => set('date', value.trim() || null)} placeholder="YYYY-MM-DD" />
        <View style={styles.timeRow}><View style={styles.half}><FormField label="开始时间" value={task.startTime ?? ''} onChangeText={(value) => set('startTime', value.trim() || null)} placeholder="HH:mm" /></View><View style={styles.half}><FormField label="截止时间" value={task.endTime ?? ''} onChangeText={(value) => set('endTime', value.trim() || null)} placeholder="HH:mm" /></View></View>
        <FormField label="预计用时（分钟）" value={task.estimatedMinutes?.toString() ?? ''} onChangeText={(value) => set('estimatedMinutes', value ? Number(value) || null : null)} keyboardType="number-pad" />
        <FormField label="提醒时间（可选）" value={task.reminderTime ?? ''} onChangeText={(value) => set('reminderTime', value.trim() || null)} placeholder="HH:mm" />
        <Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.text }]}>前置任务（只提示，不强制）</Text>{plan.tasks.filter((item) => item.id !== task.id).map((other) => { const selected = task.dependencyIds.includes(other.id); return <Pressable key={other.id} onPress={() => set('dependencyIds', selected ? task.dependencyIds.filter((value) => value !== other.id) : [...task.dependencyIds, other.id])} style={[styles.dependency, { borderColor: selected ? theme.colors.brand : theme.colors.border, backgroundColor: selected ? theme.colors.brandSoft : theme.colors.card }]}><Text style={{ color: theme.colors.text }}>{selected ? '✓ ' : ''}{other.title || '未命名任务'}</Text></Pressable>; })}{plan.tasks.length === 1 ? <Text style={{ color: theme.colors.secondaryText }}>暂无其他任务</Text> : null}</Card>
      </View>
      <View style={styles.actions}><Button title="保存任务" onPress={() => void save()} loading={saving} /><Button title="删除草稿任务" variant="danger" onPress={remove} /></View>
    </Screen>
  );
}

const styles = StyleSheet.create({ fields: { gap: 16 }, timeRow: { flexDirection: 'row', gap: 10 }, half: { flex: 1 }, card: { gap: 10 }, heading: { fontSize: 16, fontWeight: '600' }, dependency: { minHeight: 44, borderWidth: 1, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 12 }, actions: { gap: 9, marginTop: 24 } });
