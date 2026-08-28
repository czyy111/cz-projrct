export const DATABASE_VERSION = 4;

export const BACKUP_TABLES = [
  'goals',
  'goal_conditions',
  'plans',
  'stages',
  'tasks',
  'task_dependencies',
  'checkins',
  'operation_logs',
  'ai_drafts',
  'api_configs',
  'preferences',
  'notification_links',
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

export const INITIAL_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deadline', 'habit')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'completed', 'terminated')),
  start_date TEXT,
  target_date TEXT,
  habit_cycle TEXT,
  habit_mode TEXT CHECK (habit_mode IS NULL OR habit_mode IN ('consecutive', 'period_count')),
  habit_target_count INTEGER NOT NULL DEFAULT 1,
  habit_period_unit TEXT CHECK (habit_period_unit IS NULL OR habit_period_unit IN ('week', 'month')),
  habit_current_count INTEGER NOT NULL DEFAULT 0,
  habit_best_count INTEGER NOT NULL DEFAULT 0,
  habit_period_key TEXT,
  habit_stage_started_at TEXT,
  habit_stage_achieved_at TEXT,
  habit_celebration_seen_at TEXT,
  completion_celebration_seen_at TEXT,
  completed_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_conditions (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'replaced')),
  raw_ai_output TEXT,
  replaced_by_plan_id TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stages (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  sort_order INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
  stage_id TEXT REFERENCES stages(id) ON DELETE SET NULL,
  parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  completion_criteria TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'skipped')),
  start_at TEXT,
  due_at TEXT,
  reminder_at TEXT,
  reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK (reminder_enabled IN (0, 1)),
  estimated_minutes INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  skipped_at TEXT,
  deleted_at TEXT,
  replaced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  note TEXT,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  content_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_configs (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  interface_type TEXT NOT NULL CHECK (interface_type IN ('chat_completions', 'responses')),
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  secret_ref TEXT NOT NULL UNIQUE,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  last_test_at TEXT,
  last_test_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_links (
  task_id TEXT PRIMARY KEY NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  system_identifier TEXT NOT NULL UNIQUE,
  reminder_version INTEGER NOT NULL DEFAULT 1,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(status, due_at, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_reminder ON tasks(status, reminder_enabled, reminder_at, deleted_at);
CREATE INDEX IF NOT EXISTS idx_plans_goal ON plans(goal_id, status);
CREATE INDEX IF NOT EXISTS idx_stages_goal ON stages(goal_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_logs_entity ON operation_logs(entity_type, entity_id, created_at);
`;

export const MIGRATIONS: Record<number, string> = {
  2: `ALTER TABLE tasks ADD COLUMN completion_criteria TEXT NOT NULL DEFAULT '';`,
  3: `ALTER TABLE tasks ADD COLUMN replaced_at TEXT;`,
  4: `
    ALTER TABLE goals ADD COLUMN habit_mode TEXT CHECK (habit_mode IS NULL OR habit_mode IN ('consecutive', 'period_count'));
    ALTER TABLE goals ADD COLUMN habit_target_count INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE goals ADD COLUMN habit_period_unit TEXT CHECK (habit_period_unit IS NULL OR habit_period_unit IN ('week', 'month'));
    ALTER TABLE goals ADD COLUMN habit_current_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE goals ADD COLUMN habit_best_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE goals ADD COLUMN habit_period_key TEXT;
    ALTER TABLE goals ADD COLUMN habit_stage_started_at TEXT;
    ALTER TABLE goals ADD COLUMN habit_stage_achieved_at TEXT;
    ALTER TABLE goals ADD COLUMN habit_celebration_seen_at TEXT;
    ALTER TABLE goals ADD COLUMN completion_celebration_seen_at TEXT;
  `,
};
