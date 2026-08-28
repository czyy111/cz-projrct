import { describe, expect, it } from 'vitest';

import { localDateKey, monthGrid, shiftLocalDateTime, taskDateKey, timeLabel } from './dates';

describe('local task dates', () => {
  it('keeps local calendar keys without UTC conversion', () => {
    expect(localDateKey(new Date(2026, 7, 27, 23, 50))).toBe('2026-08-27');
  });
  it('uses start date first and formats all-day tasks', () => {
    expect(taskDateKey('2026-08-27T09:00:00', '2026-08-27T10:00:00')).toBe('2026-08-27');
    expect(timeLabel(null, '2026-08-27T23:59:00')).toBe('全天');
  });
  it('moves a datetime while retaining its time', () => {
    expect(shiftLocalDateTime('2026-08-27T09:30:00', '2026-08-29')).toBe('2026-08-29T09:30:00');
  });
  it('builds a six-week Monday-first month grid', () => {
    const grid = monthGrid(2026, 7);
    expect(grid).toHaveLength(42);
    expect(grid[0].date).toBe('2026-07-27');
  });
});
