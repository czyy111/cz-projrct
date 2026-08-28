import type { Goal, PlanDraft, PlanDraftTask } from './types';

export type PlanIssue = { severity: 'error' | 'warning'; code: string; message: string; taskId?: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validatePlanDraft(plan: PlanDraft, goal?: Goal | null): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const taskIds = new Set(plan.tasks.map((task) => task.id));
  if (plan.tasks.length === 0) issues.push({ severity: 'error', code: 'no_tasks', message: '计划至少需要一个任务' });
  for (const task of plan.tasks) {
    if (!task.title.trim()) issues.push(error(task, 'missing_title', '任务名称不能为空'));
    if (!task.date && !(task.order > 0)) issues.push(error(task, 'missing_schedule', '任务需要日期或可执行顺序'));
    if (task.date && !isValidDate(task.date)) issues.push(error(task, 'invalid_date', '任务日期格式应为 YYYY-MM-DD'));
    if (task.startTime && !TIME_PATTERN.test(task.startTime)) issues.push(error(task, 'invalid_start_time', '开始时间格式应为 HH:mm'));
    if (task.endTime && !TIME_PATTERN.test(task.endTime)) issues.push(error(task, 'invalid_end_time', '截止时间格式应为 HH:mm'));
    if (task.startTime && task.endTime && task.startTime > task.endTime) issues.push(error(task, 'time_order', '开始时间不能晚于截止时间'));
    if (goal?.targetDate && task.date && task.date > goal.targetDate) issues.push(warning(task, 'after_goal_deadline', '任务日期超过目标截止日期'));
    if (!task.estimatedMinutes) issues.push(warning(task, 'missing_estimate', '尚未填写预计用时'));
    if (task.reminderTime && !task.date) issues.push(error(task, 'reminder_without_date', '设置提醒前需要填写任务日期'));
    if (task.dependencyIds.includes(task.id)) issues.push(error(task, 'self_dependency', '任务不能依赖自己'));
    if (task.dependencyIds.some((id) => !taskIds.has(id))) issues.push(warning(task, 'missing_dependency', '部分前置任务已不存在'));
  }
  issues.push(...findTimeConflicts(plan.tasks));
  return issues;
}

function findTimeConflicts(tasks: PlanDraftTask[]): PlanIssue[] {
  const scheduled = tasks.filter((task) => task.date && task.startTime).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const issues: PlanIssue[] = [];
  for (let index = 0; index < scheduled.length; index += 1) {
    const current = scheduled[index];
    for (let otherIndex = index + 1; otherIndex < scheduled.length; otherIndex += 1) {
      const other = scheduled[otherIndex];
      if (other.date !== current.date) break;
      const currentEnd = current.endTime ?? current.startTime!;
      const otherEnd = other.endTime ?? other.startTime!;
      if (current.startTime === other.startTime || (current.startTime! < otherEnd && other.startTime! < currentEnd)) {
        issues.push(warning(other, 'time_conflict', `与“${current.title || '未命名任务'}”时间可能冲突`));
      }
    }
  }
  return issues;
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && localDate(parsed) === value;
}

const localDate = (date: Date) => `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
const error = (task: PlanDraftTask, code: string, message: string): PlanIssue => ({ severity: 'error', code, message, taskId: task.id });
const warning = (task: PlanDraftTask, code: string, message: string): PlanIssue => ({ severity: 'warning', code, message, taskId: task.id });
