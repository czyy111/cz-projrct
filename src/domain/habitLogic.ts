import type { HabitMode, HabitPeriodUnit, TaskStatus } from './types';

export type HabitTaskSnapshot = { date: string | null; status: TaskStatus };
export type HabitProgress = { current: number; best: number; periodKey: string | null; achieved: boolean };

function periodKey(date: string, unit: HabitPeriodUnit): string {
  if (unit === 'month') return date.slice(0, 7);
  const value = new Date(`${date}T12:00:00`);
  const day = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - day);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const dateOfMonth = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${dateOfMonth}`;
}

export function calculateHabitProgress(
  mode: HabitMode,
  target: number,
  unit: HabitPeriodUnit | null,
  tasks: HabitTaskSnapshot[],
  today: string,
): HabitProgress {
  const dated = tasks.filter((task): task is HabitTaskSnapshot & { date: string } => Boolean(task.date && task.date <= today));
  if (mode === 'period_count') {
    const actualUnit = unit ?? 'week';
    const currentPeriod = periodKey(today, actualUnit);
    const counts = new Map<string, number>();
    for (const task of dated) {
      if (task.status !== 'completed') continue;
      const key = periodKey(task.date, actualUnit);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const current = counts.get(currentPeriod) ?? 0;
    return { current, best: Math.max(0, ...counts.values()), periodKey: currentPeriod, achieved: current >= Math.max(1, target) };
  }

  const days = new Map<string, TaskStatus[]>();
  for (const task of dated) days.set(task.date, [...(days.get(task.date) ?? []), task.status]);
  const outcomes = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, statuses]) => ({
    date,
    completed: statuses.length > 0 && statuses.every((status) => status === 'completed'),
  }));
  let run = 0;
  let best = 0;
  for (const outcome of outcomes) {
    // 今天尚未结束时，未完成任务不提前打断已有连续记录。
    if (outcome.date === today && !outcome.completed) continue;
    run = outcome.completed ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best, periodKey: null, achieved: run >= Math.max(1, target) };
}
