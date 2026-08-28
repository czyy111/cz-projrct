import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { generateQuestions } from '../../src/ai/planning';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FormField } from '../../src/components/FormField';
import { Screen } from '../../src/components/Screen';
import type { ApiConfig, Goal, QuestionRound } from '../../src/domain/types';
import { getDefaultApiConfig } from '../../src/repositories/apiConfigs';
import { loadQuestionDraft, saveDraft } from '../../src/repositories/drafts';
import { getGoal } from '../../src/repositories/goals';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function QuestionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [rounds, setRounds] = useState<QuestionRound[]>([]);
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { if (id) void Promise.all([getGoal(id), loadQuestionDraft(id), getDefaultApiConfig()]).then(([g, draft, c]) => { setGoal(g); setRounds(draft?.rounds ?? []); setConfig(c); setHydrated(true); }); }, [id]);
  useEffect(() => {
    if (!hydrated || !id || rounds.length === 0) return;
    const timer = setTimeout(() => void saveDraft(id, 'questions', { rounds }), 900);
    return () => clearTimeout(timer);
  }, [hydrated, id, rounds]);
  const current = rounds[rounds.length - 1];

  const changeAnswer = (questionId: string, answer: string) => {
    const next = rounds.map((round, index) => index !== rounds.length - 1 ? round : { ...round, questions: round.questions.map((question) => question.id === questionId ? { ...question, answer } : question) });
    setRounds(next);
  };
  const goConditions = async () => {
    if (id) await saveDraft(id, 'questions', { rounds });
    router.push({ pathname: '/goals/conditions', params: { id } });
  };
  const continueRound = () => {
    if (!current || !goal || !config) return;
    const missing = current.questions.some((question) => question.required && !question.answer?.trim());
    if (missing) return Alert.alert('还有必答项未填写', '填写后可以继续；也可以选择提前结束并查看缺失风险。');
    if (current.complete || rounds.length >= 3) return void goConditions();
    Alert.alert('确认调用模型', `继续使用：${config.name}\n模型：${config.model}`, [
      { text: '取消', style: 'cancel' }, { text: '确认调用', onPress: () => void requestNext() },
    ]);
  };
  const requestNext = async () => {
    if (!goal || !config || !id) return;
    setLoading(true); controller.current = new AbortController();
    try {
      const nextRound = await generateQuestions(config, goal, rounds, controller.current.signal);
      const next = [...rounds, nextRound]; setRounds(next); await saveDraft(id, 'questions', { rounds: next });
      if (nextRound.complete) router.push({ pathname: '/goals/conditions', params: { id } });
    } catch (error) { Alert.alert('AI 请求没有完成', error instanceof Error ? error.message : '请稍后重试'); }
    finally { setLoading(false); controller.current = null; }
  };
  const endEarly = () => Alert.alert('提前结束追问？', '未回答的信息会在条件确认页作为风险保留，AI 计划可能不够准确。', [{ text: '继续回答', style: 'cancel' }, { text: '提前结束', onPress: () => void goConditions() }]);

  return (
    <Screen title="AI 帮你完善目标" subtitle={`第 ${current?.round ?? 1}/3 轮`}>
      <PressableConfig name={config?.name} model={config?.model} onPress={() => router.push({ pathname: '/settings/api', params: { returnGoalId: id } })} />
      <Card style={styles.goal}><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>当前目标</Text><Text style={[styles.goalText, { color: theme.colors.text }]}>{goal?.description}</Text></Card>
      {rounds.slice(0, -1).map((round) => <Card key={round.round} style={styles.past}><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>第 {round.round} 轮已保存 · {round.questions.length} 个回答</Text></Card>)}
      {current ? <View style={styles.questions}><Text style={[styles.intro, { color: theme.colors.text }]}>{current.introduction}</Text>{current.questions.map((question, index) => <FormField key={question.id} label={`${index + 1}. ${question.prompt}${question.required ? '（必答）' : '（选答）'}`} value={question.answer ?? ''} onChangeText={(value) => changeAnswer(question.id, value)} multiline />)}</View> : null}
      <View style={styles.actions}><Button title={rounds.length >= 3 || current?.complete ? '检查目标条件' : '继续'} onPress={continueRound} loading={loading} /><Button title="提前结束追问" variant="ghost" onPress={endEarly} disabled={loading} />{loading ? <Button title="取消本次请求" variant="secondary" onPress={() => controller.current?.abort()} /> : null}</View>
    </Screen>
  );
}

function PressableConfig({ name, model, onPress }: { name?: string; model?: string; onPress: () => void }) {
  const theme = useAppTheme();
  return <Card style={styles.config}><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>当前 API 配置</Text><Text onPress={onPress} style={[styles.link, { color: theme.colors.brandPressed }]}>{name ?? '未配置'} · {model ?? '点击切换'}</Text></Card>;
}
const styles = StyleSheet.create({ config: { marginBottom: 12 }, goal: { marginBottom: 12 }, past: { marginBottom: 8 }, meta: { fontSize: 13 }, link: { marginTop: 5, fontSize: 15, fontWeight: '600' }, goalText: { marginTop: 5, lineHeight: 21 }, questions: { gap: 16 }, intro: { fontSize: 17, fontWeight: '600', marginVertical: 8 }, actions: { gap: 8, marginTop: 24 } });
