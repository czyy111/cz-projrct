import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TaskWithGoal } from '../domain/types';
import { timeLabel } from '../utils/dates';
import { useAppTheme } from '../theme/useAppTheme';

export function TaskListItem({ task, onPress, onComplete, showGoal = true }: { task: TaskWithGoal; onPress: () => void; onComplete?: () => void; showGoal?: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
      <Pressable accessibilityLabel={`完成${task.title}`} onPress={onComplete} disabled={!onComplete || task.status !== 'pending'} style={[styles.circle, { borderColor: task.status === 'completed' ? theme.colors.success : theme.colors.brand, backgroundColor: task.status === 'completed' ? theme.colors.success : 'transparent' }]}>
        {task.status === 'completed' ? <Text style={styles.check}>✓</Text> : task.status === 'skipped' ? <Text style={{ color: theme.colors.secondaryText }}>—</Text> : null}
      </Pressable>
      <Pressable onPress={onPress} style={styles.body}>
        <Text style={[styles.title, task.status !== 'pending' && styles.processed, { color: theme.colors.text }]}>{task.title}</Text>
        <Text style={[styles.meta, { color: theme.colors.secondaryText }]}>{timeLabel(task.startAt, task.dueAt)}{showGoal ? ` · ${task.goalTitle}` : ''}</Text>
      </Pressable>
      <Text style={{ color: theme.colors.secondaryText }}>›</Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth }, circle: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, check: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' }, body: { flex: 1, paddingVertical: 10 }, title: { fontSize: 16, fontWeight: '500' }, processed: { textDecorationLine: 'line-through', opacity: 0.65 }, meta: { marginTop: 4, fontSize: 13 } });
