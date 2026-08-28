import type { Goal, GoalStage, GoalType, HabitMode, HabitPeriodUnit, OperationLog } from '../domain/types';
import { getDatabase, runCriticalWrite } from '../database/client';
import { createId } from '../utils/id';

type GoalRow = {
  id: string; type: GoalType; title: string; description: string; status: Goal['status'];
  start_date: string | null; target_date: string | null; habit_cycle: string | null; completed_at: string | null; deleted_at: string | null; created_at: string; updated_at: string;
  habit_mode: HabitMode | null; habit_target_count: number; habit_period_unit: HabitPeriodUnit | null; habit_current_count: number; habit_best_count: number; habit_period_key: string | null; habit_stage_started_at: string | null; habit_stage_achieved_at: string | null; habit_celebration_seen_at: string | null; completion_celebration_seen_at: string | null;
};

function mapGoal(row: GoalRow): Goal {
  return { id: row.id, type: row.type, title: row.title, description: row.description, status: row.status, startDate: row.start_date, targetDate: row.target_date, habitCycle: row.habit_cycle, habitMode: row.habit_mode, habitTargetCount: row.habit_target_count, habitPeriodUnit: row.habit_period_unit, habitCurrentCount: row.habit_current_count, habitBestCount: row.habit_best_count, habitPeriodKey: row.habit_period_key, habitStageStartedAt: row.habit_stage_started_at, habitStageAchievedAt: row.habit_stage_achieved_at, habitCelebrationSeenAt: row.habit_celebration_seen_at, completionCelebrationSeenAt: row.completion_celebration_seen_at, completedAt: row.completed_at, deletedAt: row.deleted_at, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function createGoalDraft(description: string): Promise<Goal> {
  const id = createId('goal');
  const now = new Date().toISOString();
  const title = description.trim().split(/\r?\n/)[0].slice(0, 40);
  await runCriticalWrite(async (tx) => {
    await tx.runAsync(
      `INSERT INTO goals (id, type, title, description, status, created_at, updated_at) VALUES (?, 'deadline', ?, ?, 'draft', ?, ?)`,
      id, title, description.trim(), now, now,
    );
  });
  return (await getGoal(id))!;
}

export async function updateGoalBasics(id: string, values: { type: GoalType; title?: string; startDate?: string | null; targetDate?: string | null; habitCycle?: string | null; habitMode?: HabitMode | null; habitTargetCount?: number; habitPeriodUnit?: HabitPeriodUnit | null }): Promise<void> {
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    await tx.runAsync(
      `UPDATE goals SET type = ?, title = COALESCE(?, title), start_date = ?, target_date = ?, habit_cycle = ?, habit_mode = ?, habit_target_count = ?, habit_period_unit = ?, updated_at = ? WHERE id = ?`,
      values.type, values.title ?? null, values.startDate ?? null, values.targetDate ?? null, values.habitCycle ?? null, values.type === 'habit' ? values.habitMode ?? 'consecutive' : null, Math.max(1, values.habitTargetCount ?? 1), values.type === 'habit' ? values.habitPeriodUnit ?? null : null, now, id,
    );
  });
}

export async function updateGoalDescription(id: string, description: string): Promise<void> {
  const title = description.trim().split(/\r?\n/)[0].slice(0, 40);
  await runCriticalWrite(async (tx) => {
    await tx.runAsync('UPDATE goals SET title = ?, description = ?, updated_at = ? WHERE id = ?', title, description.trim(), new Date().toISOString(), id);
  });
}

export async function getGoalTaskSummary(id: string): Promise<{ total: number; completed: number }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number; completed: number }>(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed FROM tasks WHERE goal_id = ? AND deleted_at IS NULL AND replaced_at IS NULL`, id,
  );
  return { total: row?.total ?? 0, completed: row?.completed ?? 0 };
}

export async function replaceGoalConditions(goalId: string, conditions: string[]): Promise<void> {
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    await tx.runAsync('DELETE FROM goal_conditions WHERE goal_id = ?', goalId);
    for (let index = 0; index < conditions.length; index += 1) {
      await tx.runAsync(
        'INSERT INTO goal_conditions (id, goal_id, content, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        createId('condition'), goalId, conditions[index], index, now, now,
      );
    }
  });
}

export async function getGoal(id: string): Promise<Goal | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<GoalRow>('SELECT * FROM goals WHERE id = ? AND deleted_at IS NULL', id);
  return row ? mapGoal(row) : null;
}

export async function listGoals(): Promise<Goal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<GoalRow>('SELECT * FROM goals WHERE deleted_at IS NULL ORDER BY updated_at DESC');
  return rows.map(mapGoal);
}

export async function setGoalStatus(id: string, status: Goal['status']): Promise<void> {
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    const previous = await tx.getFirstAsync<{ status: Goal['status'] }>('SELECT status FROM goals WHERE id = ? AND deleted_at IS NULL', id);
    if (!previous || previous.status === status) return;
    await tx.runAsync('UPDATE goals SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?', status, status === 'completed' ? now : null, now, id);
    await tx.runAsync(`INSERT INTO operation_logs (id, entity_type, entity_id, action, metadata_json, created_at) VALUES (?, 'goal', ?, ?, ?, ?)`, createId('log'), id, status, JSON.stringify({ previousStatus: previous.status }), now);
  });
}

export async function markCelebrationSeen(id: string, type: 'habit' | 'goal'): Promise<void> {
  const column = type === 'habit' ? 'habit_celebration_seen_at' : 'completion_celebration_seen_at';
  await runCriticalWrite(async (tx) => { await tx.runAsync(`UPDATE goals SET ${column} = ?, updated_at = ? WHERE id = ?`, new Date().toISOString(), new Date().toISOString(), id); }, { createBackup: false });
}

export async function continueHabitStage(id: string): Promise<void> {
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    await tx.runAsync(`UPDATE goals SET habit_current_count = 0, habit_stage_started_at = ?, habit_stage_achieved_at = NULL, habit_celebration_seen_at = NULL, updated_at = ? WHERE id = ? AND type = 'habit'`, now, now, id);
    await tx.runAsync(`INSERT INTO operation_logs (id, entity_type, entity_id, action, created_at) VALUES (?, 'goal', ?, 'habit_stage_continued', ?)`, createId('log'), id, now);
  });
}

export async function softDeleteGoal(id: string): Promise<void> {
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => { await tx.runAsync('UPDATE goals SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id); await tx.runAsync(`INSERT INTO operation_logs (id, entity_type, entity_id, action, created_at) VALUES (?, 'goal', ?, 'deleted', ?)`, createId('log'), id, now); });
}

export async function restoreGoal(id: string): Promise<void> {
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => { await tx.runAsync('UPDATE goals SET deleted_at = NULL, updated_at = ? WHERE id = ?', now, id); await tx.runAsync(`INSERT INTO operation_logs (id, entity_type, entity_id, action, created_at) VALUES (?, 'goal', ?, 'restored', ?)`, createId('log'), id, now); });
}

export async function listDeletedGoals(): Promise<Goal[]> {
  const db = await getDatabase(); const rows = await db.getAllAsync<GoalRow>('SELECT * FROM goals WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'); return rows.map(mapGoal);
}

export async function listGoalStages(goalId: string): Promise<GoalStage[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; title: string; description: string; sort_order: number; start_date: string | null; end_date: string | null }>(`SELECT s.* FROM stages s JOIN plans p ON p.id = s.plan_id WHERE s.goal_id = ? AND p.status = 'confirmed' ORDER BY s.sort_order`, goalId);
  return rows.map((row) => ({ id: row.id, title: row.title, description: row.description, order: row.sort_order, startDate: row.start_date, endDate: row.end_date }));
}

export async function listGoalLogs(goalId: string): Promise<OperationLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; entity_type: string; entity_id: string; action: string; metadata_json: string | null; created_at: string }>(`SELECT * FROM operation_logs WHERE (entity_type = 'goal' AND entity_id = ?) OR (entity_type = 'task' AND entity_id IN (SELECT id FROM tasks WHERE goal_id = ?)) ORDER BY created_at DESC`, goalId, goalId);
  return rows.map((row) => { let metadata: Record<string, unknown> | null = null; try { metadata = row.metadata_json ? JSON.parse(row.metadata_json) as Record<string, unknown> : null; } catch { metadata = null; } return { id: row.id, entityType: row.entity_type, entityId: row.entity_id, action: row.action, metadata, createdAt: row.created_at }; });
}
