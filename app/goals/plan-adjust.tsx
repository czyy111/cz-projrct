import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { adjustPlan } from '../../src/ai/planning';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ChoicePills } from '../../src/components/ChoicePills';
import { FormField } from '../../src/components/FormField';
import { Screen } from '../../src/components/Screen';
import type { ApiConfig, Goal, PlanDraft } from '../../src/domain/types';
import { getDefaultApiConfig } from '../../src/repositories/apiConfigs';
import { loadPlanDraft, replacePlanDraftKeepingPrevious } from '../../src/repositories/drafts';
import { getGoal } from '../../src/repositories/goals';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function PlanAdjustScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [plan, setPlan] = useState<PlanDraft | null>(null);
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [scope, setScope] = useState('whole');
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { if (id) void Promise.all([getGoal(id), loadPlanDraft(id), getDefaultApiConfig()]).then(([g, p, c]) => { setGoal(g); setPlan(p); setConfig(c); }); }, [id]);
  const submit = () => {
    if (!instruction.trim()) return Alert.alert('请说明希望怎样调整');
    if (!config) return Alert.alert('没有可用 API 配置');
    Alert.alert('确认调用模型', `本次使用：${config.name}\n当前草稿会保留为“最近旧草稿”。`, [{ text: '取消', style: 'cancel' }, { text: '确认调用', onPress: () => void run() }]);
  };
  const run = async () => {
    if (!goal || !plan || !config || !id) return;
    setLoading(true); controller.current = new AbortController();
    try {
      const adjusted = await adjustPlan(config, goal, plan, instruction, scope === 'whole' ? undefined : scope, controller.current.signal);
      await replacePlanDraftKeepingPrevious(id, adjusted);
      router.back();
    } catch (error) { Alert.alert('AI 调整没有完成', error instanceof Error ? error.message : '请稍后重试'); }
    finally { setLoading(false); controller.current = null; }
  };
  return (
    <Screen title="调整计划" subtitle="AI 结果仍是草稿，不会直接覆盖正式任务">
      <Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.text }]}>调整范围</Text><ChoicePills value={scope} onChange={setScope} choices={[{ value: 'whole', label: '整份计划' }, ...(plan?.tasks ?? []).map((task) => ({ value: task.id, label: task.title || '未命名任务' }))]} /></Card>
      <FormField label="希望怎样调整？" value={instruction} onChangeText={setInstruction} multiline placeholder="例如：减少工作日任务量，把较长任务安排到周末" />
      <Card style={styles.card}><Text style={[styles.meta, { color: theme.colors.secondaryText }]}>当前 API 配置</Text><Text style={[styles.config, { color: theme.colors.brandPressed }]}>{config?.name ?? '未配置'} · {config?.model ?? ''}</Text></Card>
      <View style={styles.actions}><Button title="生成调整草稿" onPress={submit} loading={loading} />{loading ? <Button title="取消本次请求" variant="secondary" onPress={() => controller.current?.abort()} /> : null}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { marginBottom: 16, gap: 12 }, heading: { fontSize: 16, fontWeight: '600' }, meta: { fontSize: 13 }, config: { fontSize: 15, fontWeight: '600' }, actions: { gap: 8, marginTop: 20 } });
