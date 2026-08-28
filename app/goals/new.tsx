import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { FormField } from '../../src/components/FormField';
import { Screen } from '../../src/components/Screen';
import { createGoalDraft } from '../../src/repositories/goals';
import { deletePreference, getPreference, setPreference } from '../../src/repositories/preferences';
import { useAppTheme } from '../../src/theme/useAppTheme';

const DRAFT_KEY = 'new_goal_description';

export default function NewGoalScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { void getPreference<string>(DRAFT_KEY).then((value) => { if (value) setDescription(value); }); }, []);
  useEffect(() => {
    if (!description.trim()) return;
    setStatus('正在保存…');
    const timer = setTimeout(() => void setPreference(DRAFT_KEY, description).then(() => setStatus('已自动保存')), 900);
    return () => clearTimeout(timer);
  }, [description]);

  const next = async () => {
    if (!description.trim()) return Alert.alert('请先描述目标');
    setSaving(true);
    try {
      const goal = await createGoalDraft(description);
      await deletePreference(DRAFT_KEY);
      router.replace({ pathname: '/goals/method', params: { id: goal.id } });
    } catch (error) { Alert.alert('保存失败', error instanceof Error ? error.message : '请稍后重试'); }
    finally { setSaving(false); }
  };

  return (
    <Screen title="创建目标" subtitle="第 1 步：描述目标">
      <FormField label="你想完成什么？" placeholder="例如：30 天完成一门英语课程" value={description} onChangeText={setDescription} multiline maxLength={1000} />
      <Text style={[styles.status, { color: theme.colors.secondaryText }]}>{status || '内容保存在本机'}</Text>
      <Button title="下一步" onPress={() => void next()} disabled={!description.trim()} loading={saving} style={styles.button} />
    </Screen>
  );
}

const styles = StyleSheet.create({ status: { marginTop: 10, fontSize: 13 }, button: { marginTop: 24 } });
