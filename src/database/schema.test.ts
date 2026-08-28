import { describe, expect, it } from 'vitest';

import { BACKUP_TABLES, DATABASE_VERSION, INITIAL_SCHEMA_SQL, MIGRATIONS } from './schema';

describe('database schema', () => {
  it('contains every table included in local recovery snapshots', () => {
    for (const table of BACKUP_TABLES) expect(INITIAL_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
  });

  it('has a migration for every version after v1', () => {
    for (let version = 2; version <= DATABASE_VERSION; version += 1) expect(MIGRATIONS[version]).toBeTruthy();
  });

  it('stores task completion criteria in fresh and upgraded databases', () => {
    expect(INITIAL_SCHEMA_SQL).toContain('completion_criteria TEXT');
    expect(MIGRATIONS[2]).toContain('completion_criteria');
  });

  it('marks pending tasks replaced by a newer confirmed plan', () => {
    expect(INITIAL_SCHEMA_SQL).toContain('replaced_at TEXT');
    expect(MIGRATIONS[3]).toContain('replaced_at');
  });

  it('migrates habit progress without replacing existing goal rows', () => {
    expect(INITIAL_SCHEMA_SQL).toContain('habit_mode TEXT');
    expect(INITIAL_SCHEMA_SQL).toContain('habit_best_count INTEGER');
    expect(MIGRATIONS[4]).toContain('ALTER TABLE goals ADD COLUMN habit_mode');
    expect(MIGRATIONS[4]).not.toMatch(/DROP TABLE|DELETE FROM goals/);
  });
});
