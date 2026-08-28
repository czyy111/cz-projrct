import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { generateQuestions } from '../../src/ai/planning';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import type { Goal } from '../../src/domain/types';
import { getDefaultApiConfig } from '../../src/repositories/apiConfigs';
import { saveDraft } from '../../src/repositories/drafts';
import { getGoal } from '../../src/repositories/goals';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function GoalMethodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { if (id) void getGoal(id).then(setGoal); }, [id]);

  const chooseAi = async () => {
    const config = await getDefaultApiConfig();
    if (!config) {
      Alert.alert('还没有 API 配置', '你可以先配置模型，或改用手工规划。', [
        { text: '取消', style: 'cancel' },
        { text: '配置 API', onPress: () => router.push({ pathname: '/settings/api', params: { returnGoalId: id } }) },
      ]);
      return;
    }
    Alert.alert('确认调用模型', `本次使用：${config.name}\n模型：${config.model}\n目标内容将发送给该模型服务商。`, [
      { text: '取消', style: 'cancel' },
      { text: '确认调用', onPress: () => void runQuestions(config) },
    ]);
  };
  const runQuestions = async (config: NonNullable<Awaited<ReturnType<typeof getDefaultApiConfig>>>) => {
    if (!goal) return;
    setLoading(true);
    controller.current = new AbortController();
    try {
      const round = await generateQuestions(config, goal, [], controller.current.signal);
      await saveDraft(goal.id, 'questions', { rounds: [round] });
      router.push({ pathname: round.complete ? '/goals/conditions' : '/goals/questions', params: { id: goal.id } });
    } catch (error) { Alert.alert('AI 请求没有完成', error instanceof Error ? error.message : '请稍后重试'); }
    finally { setLoading(false); controller.current = null; }
  };

  return (
    <Screen title="选择规划方式" subtitle="第 2 步：你拥有最终决定权">
      <Card style={styles.summary}><Text style={[styles.summaryTitle, { color: theme.colors.text }]}>目标描述</Text><Text style={[styles.description, { color: theme.colors.secondaryText }]}>{goal?.description ?? '正在读取…'}</Text></Card>
      <View style={styles.options}>
        <Card><Text style={[styles.title, { color: theme.colors.text }]}>使用 AI 规划</Text><Text style={[styles.text, { color: theme.colors.secondaryText }]}>AI 会建议目标类型、提出必要问题，并生成可审核的计划草稿。</Text><Button title="AI 帮我规划" onPress={() => void chooseAi()} loading={loading} /></Card>
        <Card><Text style={[styles.title, { color: theme.colors.text }]}>手工规划</Text><Text style={[styles.text, { color: theme.colors.secondaryText }]}>不调用模型，自己填写目标条件和初始任务。</Text><Button title="我自己规划" variant="secondary" onPress={() => router.push({ pathname: '/goals/manual', params: { id } })} disabled={loading} /></Card>
      </View>
      {loading ? <Button title="取消本次请求" variant="ghost" onPress={() => controller.current?.abort()} style={styles.cancel} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ summary: { marginBottom: 16 }, summaryTitle: { fontSize: 14, fontWeight: '600' }, description: { marginTop: 7, lineHeight: 21 }, options: { gap: 12 }, title: { fontSize: 18, fontWeight: '600' }, text: { marginVertical: 8, lineHeight: 21 }, cancel: { marginTop: 10 } });
