import { getDatabase, runCriticalWrite } from '../database/client';
import type { GoalStatus, HabitMode, HabitPeriodUnit, TaskStatus, TaskWithGoal } from '../domain/types';
import { calculateHabitProgress } from '../domain/habitLogic';
import { partitionTodayAndOverdue } from '../domain/taskLogic';
import { localDateKey } from '../utils/dates';
import { createId } from '../utils/id';

type TaskRow = {
  id: string; goal_id: string; plan_id: string | null; stage_id: string | null; title: string; description: string;
  completion_criteria: string; status: TaskStatus; start_at: string | null; due_at: string | null; reminder_at: string | null;
  reminder_enabled: number; estimated_minutes: number | null; completed_at: string | null; skipped_at: string | null;
  deleted_at: string | null; created_at: string; updated_at: string; goal_title: string; goal_status: GoalStatus; stage_title: string | null;
  replaced_at: string | null;
};

const SELECT_WITH_GOAL = `SELECT t.*, g.title AS goal_title, g.status AS goal_status, s.title AS stage_title
  FROM tasks t JOIN goals g ON g.id = t.goal_id LEFT JOIN stages s ON s.id = t.stage_id`;

function mapTask(row: TaskRow): TaskWithGoal {
  return { id: row.id, goalId: row.goal_id, planId: row.plan_id, stageId: row.stage_id, title: row.title, description: row.description, completionCriteria: row.completion_criteria, status: row.status, startAt: row.start_at, dueAt: row.due_at, reminderAt: row.reminder_at, reminderEnabled: row.reminder_enabled === 1, estimatedMinutes: row.estimated_minutes, completedAt: row.completed_at, skippedAt: row.skipped_at, deletedAt: row.deleted_at, replacedAt: row.replaced_at, createdAt: row.created_at, updatedAt: row.updated_at, goalTitle: row.goal_title, goalStatus: row.goal_status, stageTitle: row.stage_title };
}

export async function getTask(id: string, includeDeleted = false): Promise<TaskWithGoal | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TaskRow>(`${SELECT_WITH_GOAL} WHERE t.id = ? ${includeDeleted ? '' : 'AND t.deleted_at IS NULL AND t.replaced_at IS NULL AND g.deleted_at IS NULL'}`, id);
  return row ? mapTask(row) : null;
}

export async function listGoalTasks(goalId: string, status?: TaskStatus): Promise<TaskWithGoal[]> {
  const db = await getDatabase();
  const args = status ? [goalId, status] : [goalId];
  const rows = await db.getAllAsync<TaskRow>(`${SELECT_WITH_GOAL} WHERE t.goal_id = ? AND t.deleted_at IS NULL AND t.replaced_at IS NULL AND g.deleted_at IS NULL ${status ? 'AND t.status = ?' : ''} ORDER BY COALESCE(t.start_at, t.due_at), t.sort_order`, ...args);
  return rows.map(mapTask);
}

export async function listTasksForDate(date: string): Promise<TaskWithGoal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TaskRow>(`${SELECT_WITH_GOAL} WHERE t.deleted_at IS NULL AND t.replaced_at IS NULL AND g.deleted_at IS NULL AND (substr(t.start_at, 1, 10) = ? OR (t.start_at IS NULL AND substr(t.due_at, 1, 10) = ?)) ORDER BY CASE WHEN t.start_at IS NULL THEN 1 ELSE 0 END, t.start_at, t.sort_order`, date, date);
  return rows.map(mapTask);
}

export async function listTasksInDateRange(from: string, to: string): Promise<TaskWithGoal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TaskRow>(`${SELECT_WITH_GOAL} WHERE t.deleted_at IS NULL AND t.replaced_at IS NULL AND g.deleted_at IS NULL AND COALESCE(substr(t.start_at, 1, 10), substr(t.due_at, 1, 10)) BETWEEN ? AND ?`, from, to);
  return rows.map(mapTask);
}

export async function listTodayAndOverdue(now = new Date()): Promise<{ today: TaskWithGoal[]; overdue: TaskWithGoal[] }> {
  const date = localDateKey(now);
  const db = await getDatabase();
  const rows = await db.getAllAsync<TaskRow>(`${SELECT_WITH_GOAL} WHERE t.status = 'pending' AND t.deleted_at IS NULL AND t.replaced_at IS NULL AND g.deleted_at IS NULL AND g.status = 'active' AND COALESCE(substr(t.start_at, 1, 10), substr(t.due_at, 1, 10)) <= ? ORDER BY COALESCE(t.start_at, t.due_at), t.sort_order`, date);
  return partitionTodayAndOverdue(rows.map(mapTask), date);
}

export async function createTask(values: { goalId: string; title: string; description?: string; completionCriteria?: string; startAt?: string | null; dueAt?: string | null; reminderAt?: string | null; estimatedMinutes?: number | null }): Promise<string> {
  const id = createId('task'); const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    const plan = await tx.getFirstAsync<{ id: string }>(`SELECT id FROM plans WHERE goal_id = ? AND status = 'confirmed' ORDER BY version DESC LIMIT 1`, values.goalId);
    if (!plan) throw new Error('该目标还没有已确认计划');
    await tx.runAsync(`INSERT INTO tasks (id, goal_id, plan_id, title, description, completion_criteria, status, start_at, due_at, reminder_at, reminder_enabled, estimated_minutes, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 9999, ?, ?)`, id, values.goalId, plan.id, values.title.trim(), values.description ?? '', values.completionCriteria ?? '', values.startAt ?? null, values.dueAt ?? null, values.reminderAt ?? null, values.reminderAt ? 1 : 0, values.estimatedMinutes ?? null, now, now);
    await insertLog(tx, id, 'created', { goalId: values.goalId }, now);
  });
  return id;
}

export type TaskCompletionResult = { habitStageAchieved: boolean; goalId: string | null };

export async function completeTask(id: string): Promise<TaskCompletionResult> { await changeTaskStatus(id, 'completed'); return refreshHabitProgressForTask(id); }
export async function skipTask(id: string): Promise<void> { await changeTaskStatus(id, 'skipped'); await refreshHabitProgressForTask(id); }
export async function reopenTask(id: string): Promise<void> { await changeTaskStatus(id, 'pending'); await refreshHabitProgressForTask(id); }

async function changeTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    const current = await tx.getFirstAsync<{ status: TaskStatus }>('SELECT status FROM tasks WHERE id = ? AND deleted_at IS NULL', id);
    if (!current || current.status === status) return;
    await tx.runAsync(`UPDATE tasks SET status = ?, completed_at = ?, skipped_at = ?, updated_at = ? WHERE id = ?`, status, status === 'completed' ? now : null, status === 'skipped' ? now : null, now, id);
    await tx.runAsync('INSERT INTO checkins (id, task_id, action, occurred_at) VALUES (?, ?, ?, ?)', createId('checkin'), id, status === 'pending' ? 'reopened' : status, now);
    await insertLog(tx, id, status === 'pending' ? 'reopened' : status, { previousStatus: current.status }, now);
  });
}

async function refreshHabitProgressForTask(taskId: string): Promise<TaskCompletionResult> {
  const db = await getDatabase();
  const goal = await db.getFirstAsync<{ id: string; type: string; habit_mode: HabitMode | null; habit_target_count: number; habit_period_unit: HabitPeriodUnit | null; habit_best_count: number; habit_stage_started_at: string | null; habit_stage_achieved_at: string | null }>(
    `SELECT g.id, g.type, g.habit_mode, g.habit_target_count, g.habit_period_unit, g.habit_best_count, g.habit_stage_started_at, g.habit_stage_achieved_at FROM goals g JOIN tasks t ON t.goal_id = g.id WHERE t.id = ?`, taskId,
  );
  if (!goal || goal.type !== 'habit' || !goal.habit_mode) return { habitStageAchieved: false, goalId: goal?.id ?? null };
  const rows = await db.getAllAsync<{ date: string | null; status: TaskStatus; completed_at: string | null }>(
    `SELECT COALESCE(substr(start_at, 1, 10), substr(due_at, 1, 10)) AS date, status, completed_at FROM tasks WHERE goal_id = ? AND deleted_at IS NULL AND replaced_at IS NULL`, goal.id,
  );
  const scoped = goal.habit_stage_started_at
    ? rows.filter((row) => row.status !== 'completed' || Boolean(row.completed_at && row.completed_at >= goal.habit_stage_started_at!))
    : rows;
  const progress = calculateHabitProgress(goal.habit_mode, goal.habit_target_count, goal.habit_period_unit, scoped, localDateKey());
  const newlyAchieved = progress.achieved && !goal.habit_stage_achieved_at;
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    await tx.runAsync(`UPDATE goals SET habit_current_count = ?, habit_best_count = ?, habit_period_key = ?, habit_stage_achieved_at = CASE WHEN ? = 1 THEN ? ELSE habit_stage_achieved_at END, updated_at = ? WHERE id = ?`, progress.current, Math.max(goal.habit_best_count, progress.best), progress.periodKey, newlyAchieved ? 1 : 0, now, now, goal.id);
    if (newlyAchieved) await tx.runAsync(`INSERT INTO operation_logs (id, entity_type, entity_id, action, metadata_json, created_at) VALUES (?, 'goal', ?, 'habit_stage_achieved', ?, ?)`, createId('log'), goal.id, JSON.stringify({ count: progress.current, target: goal.habit_target_count }), now);
  });
  return { habitStageAchieved: newlyAchieved, goalId: goal.id };
}

export async function updateTask(id: string, values: { title: string; description: string; completionCriteria: string; startAt: string | null; dueAt: string | null; reminderAt: string | null; estimatedMinutes: number | null; dependencyIds: string[] }): Promise<void> {
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    await tx.runAsync(`UPDATE tasks SET title = ?, description = ?, completion_criteria = ?, start_at = ?, due_at = ?, reminder_at = ?, reminder_enabled = ?, estimated_minutes = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, values.title.trim(), values.description, values.completionCriteria, values.startAt, values.dueAt, values.reminderAt, values.reminderAt ? 1 : 0, values.estimatedMinutes, now, id);
    await tx.runAsync('DELETE FROM task_dependencies WHERE task_id = ?', id);
    for (const dependencyId of values.dependencyIds) if (dependencyId !== id) await tx.runAsync('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)', id, dependencyId);
    await insertLog(tx, id, 'edited', null, now);
  });
}

export async function rescheduleTask(id: string, values: { startAt: string | null; dueAt: string | null; reminderAt: string | null }): Promise<void> {
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    const old = await tx.getFirstAsync<{ start_at: string | null; due_at: string | null; reminder_at: string | null }>('SELECT start_at, due_at, reminder_at FROM tasks WHERE id = ?', id);
    await tx.runAsync(`UPDATE tasks SET start_at = ?, due_at = ?, reminder_at = ?, reminder_enabled = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, values.startAt, values.dueAt, values.reminderAt, values.reminderAt ? 1 : 0, now, id);
    await insertLog(tx, id, 'rescheduled', { from: old, to: values }, now);
  });
}

export async function softDeleteTask(id: string): Promise<void> { const now = new Date().toISOString(); await runCriticalWrite(async (tx) => { await tx.runAsync('UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id); await insertLog(tx, id, 'deleted', null, now); }); }
export async function restoreTask(id: string): Promise<void> { const now = new Date().toISOString(); await runCriticalWrite(async (tx) => { await tx.runAsync('UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ?', now, id); await insertLog(tx, id, 'restored', null, now); }); }

export async function listDeletedTasks(): Promise<TaskWithGoal[]> { const db = await getDatabase(); const rows = await db.getAllAsync<TaskRow>(`${SELECT_WITH_GOAL} WHERE t.deleted_at IS NOT NULL AND g.deleted_at IS NULL ORDER BY t.deleted_at DESC`); return rows.map(mapTask); }

export async function listTaskDependencyIds(id: string): Promise<string[]> { const db = await getDatabase(); const rows = await db.getAllAsync<{ depends_on_task_id: string }>('SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?', id); return rows.map((row) => row.depends_on_task_id); }

export async function listTaskDependencies(id: string): Promise<TaskWithGoal[]> {
  const db = await getDatabase(); const rows = await db.getAllAsync<TaskRow>(`${SELECT_WITH_GOAL} WHERE t.id IN (SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?)`, id); return rows.map(mapTask);
}

export async function countTasksDependingOn(id: string): Promise<number> {
  const db = await getDatabase(); const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM task_dependencies d JOIN tasks t ON t.id = d.task_id WHERE d.depends_on_task_id = ? AND t.deleted_at IS NULL AND t.replaced_at IS NULL`, id); return row?.count ?? 0;
}

async function insertLog(tx: Awaited<ReturnType<typeof getDatabase>>, taskId: string, action: string, metadata: unknown, now: string) {
  await tx.runAsync(`INSERT INTO operation_logs (id, entity_type, entity_id, action, metadata_json, created_at) VALUES (?, 'task', ?, ?, ?, ?)`, createId('log'), taskId, action, metadata ? JSON.stringify(metadata) : null, now);
}
