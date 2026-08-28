import type { TaskWithGoal } from './types';
import { taskDateKey } from '../utils/dates';

export function partitionTodayAndOverdue(tasks: TaskWithGoal[], date: string): { today: TaskWithGoal[]; overdue: TaskWithGoal[] } {
  return {
    overdue: tasks.filter((task) => (taskDateKey(task.startAt, task.dueAt) ?? date) < date),
    today: tasks.filter((task) => taskDateKey(task.startAt, task.dueAt) === date).sort((a, b) => taskSortKey(a).localeCompare(taskSortKey(b))),
  };
}

export function groupOverdueByGoal(tasks: TaskWithGoal[]): Record<string, TaskWithGoal[]> {
  return tasks.reduce<Record<string, TaskWithGoal[]>>((groups, task) => { (groups[task.goalTitle] ??= []).push(task); return groups; }, {});
}

const taskSortKey = (task: TaskWithGoal) => task.startAt ? `0-${task.startAt}` : `1-${task.dueAt ?? ''}`;
