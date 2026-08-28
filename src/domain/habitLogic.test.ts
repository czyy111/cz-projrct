import { describe, expect, it } from 'vitest';

import { calculateHabitProgress } from './habitLogic';

describe('calculateHabitProgress', () => {
  it('连续模式在漏做后重新累计，并保留历史最佳', () => {
    const result = calculateHabitProgress('consecutive', 2, null, [
      { date: '2026-08-20', status: 'completed' },
      { date: '2026-08-21', status: 'completed' },
      { date: '2026-08-22', status: 'skipped' },
      { date: '2026-08-23', status: 'completed' },
    ], '2026-08-23');
    expect(result).toMatchObject({ current: 1, best: 2, achieved: false });
  });

  it('同一天有任务未完成时不算完成该执行日', () => {
    const result = calculateHabitProgress('consecutive', 1, null, [
      { date: '2026-08-26', status: 'completed' },
      { date: '2026-08-26', status: 'pending' },
    ], '2026-08-27');
    expect(result.current).toBe(0);
  });

  it('周期计数只累计当前周期，超额也保留实际次数', () => {
    const result = calculateHabitProgress('period_count', 2, 'week', [
      { date: '2026-08-24', status: 'completed' },
      { date: '2026-08-25', status: 'completed' },
      { date: '2026-08-26', status: 'completed' },
      { date: '2026-08-16', status: 'completed' },
    ], '2026-08-27');
    expect(result).toMatchObject({ current: 3, best: 3, periodKey: '2026-08-24', achieved: true });
  });
});
