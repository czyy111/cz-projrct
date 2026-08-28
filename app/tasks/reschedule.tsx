import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { FormField } from '../../src/components/FormField';
import { Screen } from '../../src/components/Screen';
import type { TaskWithGoal } from '../../src/domain/types';
import { reconcileNotifications } from '../../src/notifications/service';
import { getTask, listTasksForDate, rescheduleTask } from '../../src/repositories/tasks';
import { combineLocalDateTime, taskDateKey } from '../../src/utils/dates';

export default function RescheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter();
  const [task, setTask] = useState<TaskWithGoal | null>(null); const [date, setDate] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [reminder, setReminder] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (id) void getTask(id).then((value) => { setTask(value); if (value) { setDate(taskDateKey(value.startAt, value.dueAt) ?? ''); setStart(value.startAt?.slice(11, 16) ?? ''); setEnd(value.dueAt?.slice(11, 16) === '23:59' ? '' : value.dueAt?.slice(11, 16) ?? ''); setReminder(value.reminderAt?.slice(11, 16) ?? ''); } }); }, [id]);
  const submit = async (ignoreConflict = false) => {
    if (!task || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('请按 YYYY-MM-DD 填写日期');
    if (start && end && start > end) return Alert.alert('开始时间不能晚于截止时间');
    if (!ignoreConflict && start) {
      const conflicts = (await listTasksForDate(date)).filter((item) => item.id !== task.id && item.startAt?.slice(11, 16) === start && item.status === 'pending');
      if (conflicts.length) return Alert.alert('发现可能的时间冲突', `与“${conflicts[0].title}”开始时间相同。仍然保存吗？`, [{ text: '返回修改', style: 'cancel' }, { text: '仍然保存', onPress: () => void submit(true) }]);
    }
    setSaving(true);
    try {
      await rescheduleTask(task.id, { startAt: start ? combineLocalDateTime(date, start) : null, dueAt: combineLocalDateTime(date, end || null, !end), reminderAt: reminder ? combineLocalDateTime(date, reminder) : null });
      await reconcileNotifications();
      Alert.alert('当前任务已重新安排', '是否需要查看同一目标的后续任务？其他目标不会被自动修改。', [
        { text: '暂不调整', onPress: () => router.back() },
        { text: '查看后续任务', onPress: () => router.replace({ pathname: '/goals/[id]', params: { id: task.goalId } }) },
      ]);
    }
    catch (error) { Alert.alert('保存失败', error instanceof Error ? error.message : '请重试'); } finally { setSaving(false); }
  };
  return <Screen title="延后或重新安排" subtitle="只修改当前任务，不自动移动其他任务"><View style={styles.fields}><FormField label="新日期" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /><View style={styles.row}><View style={styles.half}><FormField label="开始时间" value={start} onChangeText={setStart} placeholder="HH:mm" /></View><View style={styles.half}><FormField label="截止时间" value={end} onChangeText={setEnd} placeholder="HH:mm" /></View></View><FormField label="新提醒时间（可选）" value={reminder} onChangeText={setReminder} placeholder="HH:mm" /></View><Button title="保存新安排" onPress={() => void submit()} loading={saving} style={styles.button} /></Screen>;
}
const styles = StyleSheet.create({ fields: { gap: 16 }, row: { flexDirection: 'row', gap: 10 }, half: { flex: 1 }, button: { marginTop: 24 } });
