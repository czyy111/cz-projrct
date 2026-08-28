import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { getNotificationPermissionState, requestNotificationPermission, type NotificationPermissionState } from '../src/notifications/service';
import { listApiConfigs } from '../src/repositories/apiConfigs';
import { setPreference } from '../src/repositories/preferences';
import { useAppTheme } from '../src/theme/useAppTheme';

export default function OnboardingScreen() {
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [step, setStep] = useState(Math.min(3, Math.max(1, Number(stepParam) || 1)));
  const [apiCount, setApiCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermissionState>('undetermined');
  useEffect(() => { void Promise.all([listApiConfigs(), getNotificationPermissionState()]).then(([configs, state]) => { setApiCount(configs.length); setPermission(state); }); }, [step]);
  const finish = async () => { await setPreference('onboarding.completed', true); router.replace('/(tabs)'); };
  const askNotification = async () => { const state = await requestNotificationPermission(); setPermission(state); if (state !== 'granted') Alert.alert('暂未开启通知', '不影响计划和打卡，之后可在“设置 > 通知设置”中开启。'); };

  return <Screen title="欢迎使用橙橙计划" subtitle={`首次设置 · ${step}/3`} scroll={false}><View style={styles.content}>
    {step === 1 ? <Card style={styles.card}><Text style={[styles.icon, { color: theme.colors.brandPressed }]}>橙</Text><Text style={[styles.heading, { color: theme.colors.text }]}>计划和数据，优先留在你的手机</Text><Text style={[styles.body, { color: theme.colors.secondaryText }]}>目标、计划、任务和打卡记录保存在本地，并自动保留最近 3 份数据快照。卸载应用仍可能删除本地数据，请不要把它当作唯一的永久档案。</Text><Text style={[styles.body, { color: theme.colors.secondaryText }]}>只有你主动使用 AI 生成计划时，目标内容才会发送给你配置的模型服务商。</Text><Button title="我知道了，继续" onPress={() => setStep(2)} /></Card> : null}
    {step === 2 ? <Card style={styles.card}><Text style={[styles.icon, { color: theme.colors.brandPressed }]}>AI</Text><Text style={[styles.heading, { color: theme.colors.text }]}>AI 配置可以稍后再做</Text><Text style={[styles.body, { color: theme.colors.secondaryText }]}>支持 DeepSeek、豆包、通义千问、智谱及兼容接口。API Key 只存放在系统安全存储；模型费用由相应服务商收取。</Text><Text style={[styles.state, { color: apiCount ? theme.colors.success : theme.colors.secondaryText }]}>{apiCount ? `已保存 ${apiCount} 套配置` : '尚未配置，可先手工制定计划'}</Text><Button title={apiCount ? '查看 API 配置' : '现在配置 API'} variant="secondary" onPress={() => router.push({ pathname: '/settings/api', params: { onboarding: '1' } })} /><Button title="继续" onPress={() => setStep(3)} /><Button title="返回上一步" variant="ghost" onPress={() => setStep(1)} /></Card> : null}
    {step === 3 ? <Card style={styles.card}><Text style={[styles.icon, { color: theme.colors.brandPressed }]}>铃</Text><Text style={[styles.heading, { color: theme.colors.text }]}>在任务到期时提醒你</Text><Text style={[styles.body, { color: theme.colors.secondaryText }]}>橙橙计划使用 iPhone 系统通知。每个任务最多安排一次有效提醒，你可以逐项关闭或修改。</Text><Text style={[styles.state, { color: permission === 'granted' ? theme.colors.success : theme.colors.secondaryText }]}>{permission === 'granted' ? '通知已开启' : permission === 'denied' ? '通知被拒绝，可稍后到系统设置开启' : '点击按钮后才会询问系统权限'}</Text>{permission === 'undetermined' ? <Button title="开启系统通知" variant="secondary" onPress={() => void askNotification()} /> : null}<Button title="开始使用" onPress={() => void finish()} /><Button title="返回上一步" variant="ghost" onPress={() => setStep(2)} /></Card> : null}
  </View></Screen>;
}

const styles = StyleSheet.create({ content: { flex: 1, justifyContent: 'center' }, card: { gap: 16 }, icon: { fontSize: 38, fontWeight: '700', textAlign: 'center' }, heading: { fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center' }, body: { fontSize: 15, lineHeight: 23 }, state: { textAlign: 'center', fontSize: 14, fontWeight: '600' } });
