import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { testModelConnectionUsingKey } from '../../../src/ai/client';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { ChoicePills } from '../../../src/components/ChoicePills';
import { FormField } from '../../../src/components/FormField';
import { Screen } from '../../../src/components/Screen';
import type { ApiConfig, ApiInterfaceType } from '../../../src/domain/types';
import { getApiConfig, readApiKey, saveApiConfig, saveConnectionTest, setDefaultApiConfig } from '../../../src/repositories/apiConfigs';
import { useAppTheme } from '../../../src/theme/useAppTheme';

const presets = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', interfaceType: 'chat_completions' as const },
  doubao: { label: '豆包/火山方舟', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', interfaceType: 'chat_completions' as const },
  qwen: { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', interfaceType: 'chat_completions' as const },
  glm: { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', interfaceType: 'chat_completions' as const },
  generic: { label: '通用兼容接口', baseUrl: '', interfaceType: 'chat_completions' as const },
};
type Provider = keyof typeof presets;

export default function ApiConfigEditScreen() {
  const { configId, returnGoalId, onboarding } = useLocalSearchParams<{ configId?: string; returnGoalId?: string; onboarding?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [existing, setExisting] = useState<ApiConfig | null>(null);
  const [provider, setProvider] = useState<Provider>('deepseek');
  const [name, setName] = useState('DeepSeek');
  const [baseUrl, setBaseUrl] = useState(presets.deepseek.baseUrl);
  const [interfaceType, setInterfaceType] = useState<ApiInterfaceType>('chat_completions');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  useEffect(() => { if (configId) void getApiConfig(configId).then((value) => { if (!value) return; setExisting(value); setName(value.name); setProvider((Object.keys(presets).find((key) => presets[key as Provider].label === value.provider) as Provider | undefined) ?? 'generic'); setBaseUrl(value.baseUrl); setInterfaceType(value.interfaceType); setModel(value.model); }); }, [configId]);
  const valid = useMemo(() => name.trim() && baseUrl.trim() && model.trim() && (existing || apiKey.trim()), [name, baseUrl, model, apiKey, existing]);
  const chooseProvider = (value: Provider) => { setProvider(value); const preset = presets[value]; setName(preset.label); setBaseUrl(preset.baseUrl); setInterfaceType(preset.interfaceType); setTestResult(null); };
  const formConfig = (): ApiConfig => ({ id: existing?.id ?? 'unsaved', name: name.trim(), provider: presets[provider].label, interfaceType, baseUrl: baseUrl.trim().replace(/\/$/, ''), model: model.trim(), secretRef: existing?.secretRef ?? 'unsaved', isDefault: existing?.isDefault ?? false, lastTestAt: null, lastTestStatus: null });
  const test = async () => {
    if (!valid) return Alert.alert('请先填写必要字段');
    setTesting(true); setTestResult(null);
    try {
      const key = apiKey.trim() || (existing ? await readApiKey(existing) : null);
      if (!key) throw new Error('请重新填写 API Key');
      await testModelConnectionUsingKey(formConfig(), key);
      setTestResult('连接成功'); if (existing) await saveConnectionTest(existing.id, 'success');
    } catch (error) { setTestResult(error instanceof Error ? error.message : '连接失败'); if (existing) await saveConnectionTest(existing.id, 'failed'); }
    finally { setTesting(false); }
  };
  const save = async (makeDefault = false) => {
    if (!valid) return Alert.alert('请填写配置名称、API 地址、模型名称和 API Key');
    setSaving(true);
    try {
      const id = await saveApiConfig({ id: existing?.id, name, provider: presets[provider].label, interfaceType, baseUrl, model, apiKey: apiKey || undefined });
      if (makeDefault) await setDefaultApiConfig(id);
      if (returnGoalId) router.replace({ pathname: '/goals/method', params: { id: returnGoalId } }); else if (onboarding) router.replace({ pathname: '/onboarding', params: { step: '2' } }); else router.back();
    } catch (error) { Alert.alert('保存失败', error instanceof Error ? error.message : '请稍后重试'); }
    finally { setSaving(false); }
  };
  return (
    <Screen title={existing ? '编辑 API 配置' : '新增 API 配置'} subtitle="测试连接不会自动保存或设为默认">
      <View style={styles.fields}>
        <Card style={styles.card}><Text style={[styles.heading, { color: theme.colors.text }]}>服务商</Text><ChoicePills value={provider} onChange={chooseProvider} choices={(Object.keys(presets) as Provider[]).map((value) => ({ value, label: presets[value].label }))} /></Card>
        <FormField label="配置名称" value={name} onChangeText={setName} />
        <ChoicePills value={interfaceType} onChange={setInterfaceType} choices={[{ value: 'chat_completions', label: 'Chat Completions' }, { value: 'responses', label: 'Responses API' }]} />
        <FormField label="API 地址" value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" autoCorrect={false} placeholder="https://…/v1" />
        <FormField label="模型名称或接入点 ID" value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} placeholder={provider === 'doubao' ? '填写火山方舟接入点 ID' : '填写服务商提供的模型名称'} />
        <FormField label={existing ? 'API Key（留空表示不修改）' : 'API Key'} value={apiKey} onChangeText={setApiKey} secureTextEntry={!showKey} autoCapitalize="none" autoCorrect={false} />
        <View style={styles.switchRow}><Text style={{ color: theme.colors.text }}>临时显示 API Key</Text><Switch value={showKey} onValueChange={setShowKey} trackColor={{ true: theme.colors.brand }} /></View>
      </View>
      <Button title="测试连接" variant="secondary" onPress={() => void test()} loading={testing} style={styles.test} />
      {testResult ? <Text style={[styles.result, { color: testResult === '连接成功' ? theme.colors.success : theme.colors.danger }]}>{testResult}</Text> : null}
      <View style={styles.actions}><Button title="保存配置" onPress={() => void save(false)} loading={saving} /><Button title="保存并设为默认" variant="secondary" onPress={() => void save(true)} disabled={saving} /></View>
    </Screen>
  );
}

const styles = StyleSheet.create({ fields: { gap: 16 }, card: { gap: 12 }, heading: { fontSize: 16, fontWeight: '600' }, switchRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, test: { marginTop: 20 }, result: { marginTop: 10, textAlign: 'center', fontSize: 14 }, actions: { gap: 9, marginTop: 20 } });
