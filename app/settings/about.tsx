import { StyleSheet, Text } from 'react-native';

import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function AboutScreen() { const theme = useAppTheme(); return <Screen title="应用说明" subtitle="橙橙计划 v0.1.0"><Card><Text style={[styles.title, { color: theme.colors.text }]}>把目标变成可以执行的计划</Text><Text style={[styles.body, { color: theme.colors.secondaryText }]}>AI 生成内容仅作为计划建议，必须由你审核确认。橙橙计划不能保证目标一定完成，也不能替代医疗、法律、投资等专业意见。</Text><Text style={[styles.body, { color: theme.colors.secondaryText }]}>第一版供个人本地使用，不包含账号、云同步、付费和社交功能。</Text></Card></Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 18, fontWeight: '600' }, body: { marginTop: 12, fontSize: 14, lineHeight: 22 } });
