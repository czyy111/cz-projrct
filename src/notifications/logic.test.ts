import { describe, expect, it } from 'vitest';

import { selectNotificationWindow, staleNotificationTaskIds } from './logic';

describe('notification rolling window', () => {
  it('keeps only future reminders in chronological order', () => {
    const result = selectNotificationWindow([
      { taskId: 'late', reminderAt: '2026-08-27T09:00:00' },
      { taskId: 'b', reminderAt: '2026-08-28T11:00:00' },
      { taskId: 'a', reminderAt: '2026-08-28T10:00:00' },
    ], new Date('2026-08-27T10:00:00'));
    expect(result.map((item) => item.taskId)).toEqual(['a', 'b']);
  });

  it('caps the system window at about sixty reminders', () => {
    const items = Array.from({ length: 70 }, (_, index) => ({ taskId: `${index}`, reminderAt: `2026-09-${(index % 28 + 1).toString().padStart(2, '0')}T10:00:00` }));
    expect(selectNotificationWindow(items, new Date('2026-08-01T00:00:00'))).toHaveLength(60);
  });

  it('replaces changed or missing system notifications', () => {
    const expected = [{ taskId: 'same', reminderAt: '2026-09-01T09:00:00' }, { taskId: 'changed', reminderAt: '2026-09-02T10:00:00' }];
    const links = [{ taskId: 'same', systemIdentifier: 'sys-1', scheduledAt: '2026-09-01T09:00:00' }, { taskId: 'changed', systemIdentifier: 'sys-2', scheduledAt: '2026-09-02T09:00:00' }, { taskId: 'removed', systemIdentifier: 'sys-3', scheduledAt: '2026-09-03T09:00:00' }];
    expect(staleNotificationTaskIds(expected, links, new Set(['sys-1', 'sys-2', 'sys-3']))).toEqual(['changed', 'removed']);
    expect(staleNotificationTaskIds(expected, links.slice(0, 1), new Set())).toEqual(['same']);
  });
});
