import * as SQLite from 'expo-sqlite';

import { createLocalBackup, restoreLatestValidBackup } from './backup';
import { DATABASE_VERSION, INITIAL_SCHEMA_SQL, MIGRATIONS } from './schema';

const DATABASE_NAME = 'orange-plan.db';
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) databasePromise = openAndMigrateDatabase();
  return databasePromise;
}

async function openAndMigrateDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(`数据库版本 ${currentVersion} 高于应用支持版本 ${DATABASE_VERSION}`);
  }

  if (currentVersion === 0) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(INITIAL_SCHEMA_SQL);
      await transaction.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    });
  } else if (currentVersion < DATABASE_VERSION) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      for (let version = currentVersion + 1; version <= DATABASE_VERSION; version += 1) {
        const migration = MIGRATIONS[version];
        if (!migration) throw new Error(`缺少数据库版本 ${version} 的迁移脚本`);
        await transaction.execAsync(migration);
        await transaction.execAsync(`PRAGMA user_version = ${version}`);
      }
    });
  }

  return db;
}

export async function runCriticalWrite(
  task: (transaction: SQLite.SQLiteDatabase) => Promise<void>,
  options: { createBackup?: boolean } = {},
): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(task);
  if (options.createBackup !== false) await createLocalBackup(db);
}

export async function checkDatabaseHealth(): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<Record<string, string>>('PRAGMA quick_check');
  return Object.values(result ?? {}).some((value) => value === 'ok');
}

export async function ensureDatabaseReady(): Promise<{ recoveredFromBackup: boolean }> {
  const db = await getDatabase();
  if (await checkDatabaseHealth()) return { recoveredFromBackup: false };

  const restored = await restoreLatestValidBackup(db);
  if (!restored || !(await checkDatabaseHealth())) {
    throw new Error('本地数据库完整性检查未通过，且没有可用的恢复备份');
  }
  return { recoveredFromBackup: true };
}
