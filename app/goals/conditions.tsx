import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { generatePlan } from '../../src/ai/planning';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ChoicePills } from '../../src/components/ChoicePills';
import { FormField } from '../../src/components/FormField';
import { Screen } from '../../src/components/Screen';
import type { ApiConfig, Goal, GoalType, HabitMode, HabitPeriodUnit, QuestionRound } from '../../src/domain/types';
import { getDefaultApiConfig } from '../../src/repositories/apiConfigs';
import { loadDraft, loadQuestionDraft, saveDraft } from '../../src/repositories/drafts';
import { getGoal, replaceGoalConditions, updateGoalBasics } from '../../src/repositories/goals';
import { useAppTheme } from '../../src/theme/useAppTheme';

type AssumptionState = { text: string; decision: 'accept' | 'modify' | 'reject' | null; modified: string };
type SavedConditions = { mode: 'ai'; type: GoalType; targetDate: string; habitCycle: string; habitMode?: HabitMode; habitTarget?: string; habitPeriodUnit?: HabitPeriodUnit; completion: string; assumptions: AssumptionState[] };

export default function ConditionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [rounds, setRounds] = useState<QuestionRound[]>([]);
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [type, setType] = useState<GoalType>('deadline');
  const [targetDate, setTargetDate] = useState('');
  const [habitCycle, setHabitCycle] = useState('每天');
  const [habitMode, setHabitMode] = useState<HabitMode>('consecutive');
  const [habitTarget, setHabitTarget] = useState('7');
  const [habitPeriodUnit, setHabitPeriodUnit] = useState<HabitPeriodUnit>('week');
  const [completion, setCompletion] = useState('');
  const [assumptions, setAssumptions] = useState<AssumptionState[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!id) return;
    void Promise.all([getGoal(id), loadQuestionDraft(id), getDefaultApiConfig(), loadDraft<SavedConditions>(id, 'conditions')]).then(([g, draft, c, saved]) => {
      setGoal(g); setRounds(draft?.rounds ?? []); setConfig(c);
      const last = draft?.rounds.at(-1); if (last) setType(last.goalTypeSuggestion);
      const values = (draft?.rounds ?? []).flatMap((round) => round.assumptions);
      setAssumptions(values.map((text) => ({ text, decision: null, modified: text })));
      if (saved?.mode === 'ai') { setType(saved.type); setTargetDate(saved.targetDate); setHabitCycle(saved.habitCycle); setHabitMode(saved.habitMode ?? 'consecutive'); setHabitTarget(saved.habitTarget ?? '7'); setHabitPeriodUnit(saved.habitPeriodUnit ?? 'week'); setCompletion(saved.completion); setAssumptions(saved.assumptions); }
      setHydrated(true);
    });
  }, [id]);
  useEffect(() => {
    if (!hydrated || !id) return;
    const timer = setTimeout(() => void saveDraft(id, 'conditions', { mode: 'ai', type, targetDate, habitCycle, habitMode, habitTarget, habitPeriodUnit, completion, assumptions } satisfies SavedConditions), 900);
    return () => clearTimeout(timer);
  }, [hydrated, id, type, targetDate, habitCycle, habitMode, habitTarget, habitPeriodUnit, completion, assumptions]);

  const requestPlan = () => {
    if (!goal || !config) return Alert.alert('缺少 API 配置', '请先在设置中配置可用模型。');
    if (type === 'deadline' && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim())) return Alert.alert('请按 YYYY-MM-DD 填写目标日期');
    if (assumptions.some((item) => !item.decision)) return Alert.alert('请逐项处理 AI 假设', '每项都需要接受、修改或不采用。');
    Alert.alert('确认生成计划', `本次使用：${config.name}\n模型：${config.model}\n生成可能产生模型服务费用。`, [
      { text: '取消', style: 'cancel' }, { text: '确认生成', onPress: () => void runPlan() },
    ]);
  };
  const runPlan = async () => {
    if (!goal || !config || !id) return;
    setLoading(true); controller.current = new AbortController();
    try {
      await updateGoalBasics(id, { type, targetDate: type === 'deadline' ? targetDate.trim() : null, habitCycle: type === 'habit' ? habitCycle.trim() : null, habitMode: type === 'habit' ? habitMode : null, habitTargetCount: Number.parseInt(habitTarget, 10) || 1, habitPeriodUnit: type === 'habit' && habitMode === 'period_count' ? habitPeriodUnit : null });
      const answerConditions = rounds.flatMap((round) => round.questions.filter((q) => q.answer?.trim()).map((q) => `${q.prompt}：${q.answer}`));
      const assumptionConditions = assumptions.filter((item) => item.decision !== 'reject').map((item) => item.decision === 'modify' ? item.modified : item.text);
      await replaceGoalConditions(id, [...answerConditions, completion.trim() ? `完成标准：${completion.trim()}` : '', ...assumptionConditions].filter(Boolean));
      const plan = await generatePlan(config, { ...goal, type, targetDate: type === 'deadline' ? targetDate.trim() : null }, rounds, type, controller.current.signal);
      await saveDraft(id, 'plan', plan);
      router.replace({ pathname: '/goals/plan', params: { id } });
    } catch (error) { Alert.alert('计划生成没有完成', error instanceof Error ? error.message : '请稍后重试'); }
    finally { setLoading(false); controller.current = null; }
  };

  return (
    <Screen title="确认目标条件" subtitle="确认后才会调用模型生成计划">
      <Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.text }]}>目标与类型</Text><Text style={[styles.body, { color: theme.colors.secondaryText }]}>{goal?.description}</Text><ChoicePills value={type} onChange={setType} choices={[{ value: 'deadline', label: '期限型目标' }, { value: 'habit', label: '长期习惯' }]} /></Card>
      <Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.text }]}>时间安排</Text>{type === 'deadline' ? <FormField label="目标日期" value={targetDate} onChangeText={setTargetDate} placeholder="YYYY-MM-DD" /> : <><FormField label="习惯周期" value={habitCycle} onChangeText={setHabitCycle} placeholder="例如：每天、每周三次" /><ChoicePills value={habitMode} onChange={setHabitMode} choices={[{ value: 'consecutive', label: '连续执行日' }, { value: 'period_count', label: '周期次数' }]} /><FormField label={habitMode === 'consecutive' ? '阶段目标（连续天数）' : '阶段目标（完成次数）'} value={habitTarget} onChangeText={setHabitTarget} keyboardType="number-pad" />{habitMode === 'period_count' ? <ChoicePills value={habitPeriodUnit} onChange={setHabitPeriodUnit} choices={[{ value: 'week', label: '每周' }, { value: 'month', label: '每月' }]} /> : null}</>}</Card>
      <Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.text }]}>完成标准</Text><FormField label="怎样算目标达成？" value={completion} onChangeText={setCompletion} multiline placeholder="可补充你对完成结果的要求" /></Card>
      <Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.text }]}>已回答条件</Text>{rounds.flatMap((round) => round.questions).map((question) => <Text key={`${question.id}-${question.prompt}`} style={[styles.condition, { color: theme.colors.secondaryText }]}>• {question.prompt}：{question.answer || '未回答'}</Text>)}</Card>
      {assumptions.length > 0 ? <Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.warning }]}>待确认的 AI 假设</Text>{assumptions.map((item, index) => <View key={`${item.text}-${index}`} style={styles.assumption}><Text style={[styles.body, { color: theme.colors.text }]}>{item.text}</Text><ChoicePills value={item.decision ?? 'pending'} onChange={(decision) => setAssumptions((old) => old.map((entry, i) => i === index ? { ...entry, decision: decision === 'pending' ? null : decision } : entry))} choices={[{ value: 'accept', label: '接受' }, { value: 'modify', label: '修改' }, { value: 'reject', label: '不采用' }]} />{item.decision === 'modify' ? <FormField label="修改为" value={item.modified} onChangeText={(modified) => setAssumptions((old) => old.map((entry, i) => i === index ? { ...entry, modified } : entry))} /> : null}</View>)}</Card> : null}
      <Card style={styles.card}><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>本次 API 配置</Text><Text onPress={() => router.push({ pathname: '/settings/api', params: { returnGoalId: id } })} style={[styles.link, { color: theme.colors.brandPressed }]}>{config?.name ?? '未配置'} · {config?.model ?? '点击配置或切换'}</Text></Card>
      <View style={styles.actions}><Button title="确认并生成计划" onPress={requestPlan} loading={loading} /><Button title="返回追问" variant="ghost" onPress={() => router.back()} disabled={loading} />{loading ? <Button title="取消本次请求" variant="secondary" onPress={() => controller.current?.abort()} /> : null}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { marginBottom: 12, gap: 12 }, heading: { fontSize: 17, fontWeight: '600' }, body: { lineHeight: 21 }, condition: { lineHeight: 21 }, assumption: { gap: 10, paddingTop: 8 }, meta: { fontSize: 13 }, link: { fontSize: 15, fontWeight: '600' }, actions: { gap: 8, marginTop: 10 } });
