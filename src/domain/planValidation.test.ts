import { describe, expect, it } from 'vitest';

import type { PlanDraft, PlanDraftTask } from './types';
import { validatePlanDraft } from './planValidation';

const task = (values: Partial<PlanDraftTask> = {}): PlanDraftTask => ({
  id: 't1', stageId: null, title: '学习', description: '', completionCriteria: '完成一章', date: '2026-08-28',
  startTime: '09:00', endTime: '10:00', estimatedMinutes: 60, reminderTime: null, order: 1, dependencyIds: [], ...values,
});
const plan = (tasks: PlanDraftTask[]): PlanDraft => ({ title: '计划', overview: '', stages: [], tasks, source: 'manual' });

describe('plan validation', () => {
  it('blocks empty plans and unnamed tasks', () => {
    expect(validatePlanDraft(plan([])).some((issue) => issue.code === 'no_tasks')).toBe(true);
    expect(validatePlanDraft(plan([task({ title: '' })])).some((issue) => issue.code === 'missing_title')).toBe(true);
  });

  it('blocks an end time before the start time', () => {
    expect(validatePlanDraft(plan([task({ startTime: '18:00', endTime: '17:00' })])).some((issue) => issue.code === 'time_order')).toBe(true);
  });

  it('warns about overlapping tasks without blocking them', () => {
    const issues = validatePlanDraft(plan([task(), task({ id: 't2', title: '练习', startTime: '09:30', endTime: '10:30' })]));
    expect(issues).toContainEqual(expect.objectContaining({ severity: 'warning', code: 'time_conflict', taskId: 't2' }));
  });
});
