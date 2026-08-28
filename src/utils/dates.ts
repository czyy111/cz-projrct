export function localDateKey(date = new Date()): string {
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

export function taskDateKey(startAt: string | null, dueAt: string | null): string | null {
  return (startAt ?? dueAt)?.slice(0, 10) ?? null;
}

export function timeLabel(startAt: string | null, dueAt: string | null): string {
  const start = startAt?.slice(11, 16);
  const due = dueAt?.slice(11, 16);
  if (start && due && start !== due) return `${start}–${due}`;
  if (start) return start;
  if (due && due !== '23:59') return `${due} 截止`;
  return '全天';
}

export function combineLocalDateTime(date: string, time: string | null, endOfDay = false): string {
  return `${date}T${time || (endOfDay ? '23:59' : '00:00')}:00`;
}

export function shiftLocalDateTime(value: string | null, nextDate: string, nextTime?: string | null): string | null {
  if (!value && !nextTime) return null;
  const time = nextTime ?? value?.slice(11, 16) ?? '00:00';
  return combineLocalDateTime(nextDate, time, time === '23:59');
}

export function monthGrid(year: number, month: number): Array<{ date: string; day: number; inMonth: boolean }> {
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start); date.setDate(start.getDate() + index);
    return { date: localDateKey(date), day: date.getDate(), inMonth: date.getMonth() === month };
  });
}
