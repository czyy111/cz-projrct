import type { PlanDraft, QuestionRound } from '../domain/types';
import { getDatabase, runCriticalWrite } from '../database/client';
import { createId } from '../utils/id';

type DraftKind = 'questions' | 'conditions' | 'plan';

export async function saveDraft(goalId: string, kind: DraftKind, value: unknown): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM ai_drafts WHERE goal_id = ? AND kind = ? AND status = 'active'`, goalId, kind);
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    if (existing) {
      await tx.runAsync('UPDATE ai_drafts SET content_json = ?, updated_at = ? WHERE id = ?', JSON.stringify(value), now, existing.id);
    } else {
      await tx.runAsync(
        `INSERT INTO ai_drafts (id, goal_id, kind, content_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)`,
        createId('draft'), goalId, kind, JSON.stringify(value), now, now,
      );
    }
  });
}

export async function loadDraft<T>(goalId: string, kind: DraftKind): Promise<T | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ content_json: string }>(
    `SELECT content_json FROM ai_drafts WHERE goal_id = ? AND kind = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, goalId, kind,
  );
  if (!row) return null;
  try { return JSON.parse(row.content_json) as T; } catch { return null; }
}

export const loadQuestionDraft = (goalId: string) => loadDraft<{ rounds: QuestionRound[] }>(goalId, 'questions');
export const loadPlanDraft = (goalId: string) => loadDraft<PlanDraft>(goalId, 'plan');

export async function replacePlanDraftKeepingPrevious(goalId: string, plan: PlanDraft): Promise<void> {
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    await tx.runAsync(`DELETE FROM ai_drafts WHERE goal_id = ? AND kind = 'plan' AND status = 'previous'`, goalId);
    await tx.runAsync(`UPDATE ai_drafts SET status = 'previous', updated_at = ? WHERE goal_id = ? AND kind = 'plan' AND status = 'active'`, now, goalId);
    await tx.runAsync(
      `INSERT INTO ai_drafts (id, goal_id, kind, content_json, status, created_at, updated_at) VALUES (?, ?, 'plan', ?, 'active', ?, ?)`,
      createId('draft'), goalId, JSON.stringify(plan), now, now,
    );
  });
}

export async function hasPreviousPlanDraft(goalId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string }>(`SELECT id FROM ai_drafts WHERE goal_id = ? AND kind = 'plan' AND status = 'previous'`, goalId);
  return Boolean(row);
}

export async function restorePreviousPlanDraft(goalId: string): Promise<boolean> {
  const db = await getDatabase();
  const previous = await db.getFirstAsync<{ id: string }>(`SELECT id FROM ai_drafts WHERE goal_id = ? AND kind = 'plan' AND status = 'previous'`, goalId);
  if (!previous) return false;
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    await tx.runAsync(`UPDATE ai_drafts SET status = 'swap', updated_at = ? WHERE goal_id = ? AND kind = 'plan' AND status = 'active'`, now, goalId);
    await tx.runAsync(`UPDATE ai_drafts SET status = 'active', updated_at = ? WHERE id = ?`, now, previous.id);
    await tx.runAsync(`UPDATE ai_drafts SET status = 'previous', updated_at = ? WHERE goal_id = ? AND kind = 'plan' AND status = 'swap'`, now, goalId);
  });
  return true;
}
