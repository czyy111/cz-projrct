import { StyleSheet, Text } from 'react-native';

import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function PrivacyScreen() { const theme = useAppTheme(); return <Screen title="数据与隐私" subtitle="你的主要数据优先保存在本机"><Card style={styles.card}><Text style={[styles.title, { color: theme.colors.text }]}>本地数据</Text><Text style={[styles.body, { color: theme.colors.secondaryText }]}>目标、计划、任务和记录保存在手机应用沙盒中的 SQLite 数据库。关键写入后轮换保留最近三份恢复副本。</Text></Card><Card style={styles.card}><Text style={[styles.title, { color: theme.colors.text }]}>API Key</Text><Text style={[styles.body, { color: theme.colors.secondaryText }]}>API Key 单独保存在系统安全存储中，不进入业务数据库、恢复副本或普通日志。</Text></Card><Card style={styles.card}><Text style={[styles.title, { color: theme.colors.text }]}>发送给模型的数据</Text><Text style={[styles.body, { color: theme.colors.secondaryText }]}>只有在你确认调用后，当前目标和制定计划所需的问答才会发送给所选模型服务商。卸载应用或设备损坏可能导致本机数据无法恢复，第一版不提供云同步。</Text></Card></Screen>; }
const styles = StyleSheet.create({ card: { marginBottom: 12 }, title: { fontSize: 17, fontWeight: '600' }, body: { marginTop: 8, fontSize: 14, lineHeight: 22 } });
