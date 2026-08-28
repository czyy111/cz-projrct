import { getDatabase, runCriticalWrite } from '../database/client';
import type { PlanDraft } from '../domain/types';
import { validatePlanDraft } from '../domain/planValidation';
import { createId } from '../utils/id';
import { getGoal } from './goals';
import { saveDraft } from './drafts';

export async function confirmPlan(goalId: string, draft: PlanDraft): Promise<string> {
  const goal = await getGoal(goalId);
  if (!goal) throw new Error('目标不存在或已删除');
  const errors = validatePlanDraft(draft, goal).filter((issue) => issue.severity === 'error');
  if (errors.length > 0) throw new Error(errors[0].message);
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string; version: number }>(`SELECT id, version FROM plans WHERE goal_id = ? AND status = 'confirmed' ORDER BY version DESC LIMIT 1`, goalId);
  const activeDraft = await db.getFirstAsync<{ id: string }>(`SELECT id FROM ai_drafts WHERE goal_id = ? AND kind = 'plan' AND status = 'active'`, goalId);
  if (existing && !activeDraft) return existing.id;

  const planId = createId('plan');
  const now = new Date().toISOString();
  const stageIds = new Map(draft.stages.map((stage) => [stage.id, createId('stage')]));
  const taskIds = new Map(draft.tasks.map((task) => [task.id, createId('task')]));
  await runCriticalWrite(async (tx) => {
    if (existing) {
      await tx.runAsync(`UPDATE plans SET status = 'replaced', replaced_by_plan_id = ?, updated_at = ? WHERE id = ?`, planId, now, existing.id);
      await tx.runAsync(`UPDATE tasks SET replaced_at = ?, updated_at = ? WHERE plan_id = ? AND status = 'pending' AND deleted_at IS NULL`, now, now, existing.id);
    }
    await tx.runAsync(
      `INSERT INTO plans (id, goal_id, version, status, raw_ai_output, confirmed_at, created_at, updated_at) VALUES (?, ?, ?, 'confirmed', ?, ?, ?, ?)`,
      planId, goalId, (existing?.version ?? 0) + 1, JSON.stringify(draft), now, now, now,
    );
    for (const stage of draft.stages) {
      await tx.runAsync(
        `INSERT INTO stages (id, goal_id, plan_id, title, description, sort_order, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        stageIds.get(stage.id)!, goalId, planId, stage.title, stage.description, stage.order, stage.startDate, stage.endDate, now, now,
      );
    }
    for (const task of draft.tasks) {
      const startAt = combineDateTime(task.date, task.startTime);
      const dueAt = combineDateTime(task.date, task.endTime ?? task.startTime, !task.startTime && !task.endTime);
      const reminderAt = combineDateTime(task.date, task.reminderTime);
      await tx.runAsync(
        `INSERT INTO tasks (id, goal_id, plan_id, stage_id, title, description, completion_criteria, status, start_at, due_at, reminder_at, reminder_enabled, estimated_minutes, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
        taskIds.get(task.id)!, goalId, planId, task.stageId ? stageIds.get(task.stageId) ?? null : null, task.title.trim(), task.description, task.completionCriteria, startAt, dueAt, reminderAt, reminderAt ? 1 : 0, task.estimatedMinutes, task.order, now, now,
      );
    }
    for (const task of draft.tasks) {
      for (const dependencyId of task.dependencyIds) {
        const mappedDependency = taskIds.get(dependencyId);
        if (mappedDependency) await tx.runAsync('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)', taskIds.get(task.id)!, mappedDependency);
      }
    }
    await tx.runAsync(`UPDATE ai_drafts SET status = 'confirmed', updated_at = ? WHERE goal_id = ? AND kind = 'plan' AND status = 'active'`, now, goalId);
    await tx.runAsync(`UPDATE goals SET status = 'active', updated_at = ? WHERE id = ?`, now, goalId);
    await tx.runAsync(
      `INSERT INTO operation_logs (id, entity_type, entity_id, action, metadata_json, created_at) VALUES (?, 'goal', ?, ?, ?, ?)`,
      createId('log'), goalId, existing ? 'plan_replaced' : 'plan_confirmed', JSON.stringify({ planId, previousPlanId: existing?.id, taskCount: draft.tasks.length }), now,
    );
  });
  return planId;
}

export async function startReplanDraft(goalId: string): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string; raw_ai_output: string | null }>(`SELECT id, raw_ai_output FROM plans WHERE goal_id = ? AND status = 'confirmed' ORDER BY version DESC LIMIT 1`, goalId);
  if (!row) throw new Error('当前目标没有可调整的正式计划');
  let old: Partial<PlanDraft> = {};
  try { old = row.raw_ai_output ? JSON.parse(row.raw_ai_output) as PlanDraft : {}; } catch { old = {}; }
  const stageRows = await db.getAllAsync<{ id: string; title: string; description: string; sort_order: number; start_date: string | null; end_date: string | null }>('SELECT * FROM stages WHERE plan_id = ? ORDER BY sort_order', row.id);
  const taskRows = await db.getAllAsync<{ id: string; stage_id: string | null; title: string; description: string; completion_criteria: string; start_at: string | null; due_at: string | null; reminder_at: string | null; estimated_minutes: number | null; sort_order: number }>(`SELECT * FROM tasks WHERE plan_id = ? AND status = 'pending' AND deleted_at IS NULL AND replaced_at IS NULL ORDER BY sort_order`, row.id);
  const dependencyRows = await db.getAllAsync<{ task_id: string; depends_on_task_id: string }>(`SELECT d.* FROM task_dependencies d JOIN tasks t ON t.id = d.task_id WHERE t.plan_id = ? AND t.status = 'pending' AND t.replaced_at IS NULL`, row.id);
  const pendingIds = new Set(taskRows.map((task) => task.id));
  const draft: PlanDraft = {
    title: old.title ?? '调整后的计划', overview: old.overview ?? '', source: old.source ?? 'manual',
    stages: stageRows.map((stage) => ({ id: stage.id, title: stage.title, description: stage.description, order: stage.sort_order, startDate: stage.start_date, endDate: stage.end_date })),
    tasks: taskRows.map((task) => ({ id: task.id, stageId: task.stage_id, title: task.title, description: task.description, completionCriteria: task.completion_criteria, date: (task.start_at ?? task.due_at)?.slice(0, 10) ?? null, startTime: task.start_at?.slice(11, 16) ?? null, endTime: task.due_at?.slice(11, 16) === '23:59' ? null : task.due_at?.slice(11, 16) ?? null, estimatedMinutes: task.estimated_minutes, reminderTime: task.reminder_at?.slice(11, 16) ?? null, order: task.sort_order, dependencyIds: dependencyRows.filter((dependency) => dependency.task_id === task.id && pendingIds.has(dependency.depends_on_task_id)).map((dependency) => dependency.depends_on_task_id) })),
  };
  await saveDraft(goalId, 'plan', draft);
}

function combineDateTime(date: string | null, time: string | null, endOfDay = false): string | null {
  if (!date) return null;
  if (time) return `${date}T${time}:00`;
  return endOfDay ? `${date}T23:59:00` : null;
}
