import { describe, expect, it } from 'vitest';

import type { TaskWithGoal } from './types';
import { groupOverdueByGoal, partitionTodayAndOverdue } from './taskLogic';

function task(id: string, goalTitle: string, startAt: string | null, dueAt: string): TaskWithGoal {
  return { id, goalId: goalTitle, planId: 'p', stageId: null, title: id, description: '', completionCriteria: '', status: 'pending', startAt, dueAt, reminderAt: null, reminderEnabled: false, estimatedMinutes: null, completedAt: null, skippedAt: null, deletedAt: null, replacedAt: null, createdAt: '', updatedAt: '', goalTitle, goalStatus: 'active', stageTitle: null };
}

describe('today and overdue tasks', () => {
  const items = [task('old-a', '学习', null, '2026-08-26T23:59:00'), task('all-day', '运动', null, '2026-08-27T23:59:00'), task('timed', '学习', '2026-08-27T09:00:00', '2026-08-27T10:00:00')];
  it('separates earlier dates from today and puts all-day tasks last', () => {
    const result = partitionTodayAndOverdue(items, '2026-08-27');
    expect(result.overdue.map((item) => item.id)).toEqual(['old-a']);
    expect(result.today.map((item) => item.id)).toEqual(['timed', 'all-day']);
  });
  it('groups overdue tasks by their owning goal', () => {
    expect(Object.keys(groupOverdueByGoal([...items, task('old-b', '学习', null, '2026-08-25T23:59:00')]))).toEqual(['学习', '运动']);
  });
});
