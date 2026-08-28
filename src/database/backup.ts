import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createSnapshot, filesToDelete, isValidSnapshot, type BackupPayload, type BackupSnapshot } from './backupLogic';
import { BACKUP_TABLES, DATABASE_VERSION } from './schema';

const BACKUP_DIRECTORY_NAME = 'orange-plan-backups';
const BACKUP_FILE_PREFIX = 'backup-';

function backupDirectory() {
  return new Directory(Paths.document, BACKUP_DIRECTORY_NAME);
}

function backupFileName(createdAt: string) {
  return `${BACKUP_FILE_PREFIX}${createdAt.replace(/[:.]/g, '-')}.json`;
}

export async function createLocalBackup(db: SQLiteDatabase): Promise<string> {
  const tables = {} as BackupPayload['tables'];
  for (const table of BACKUP_TABLES) {
    tables[table] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
  }

  const createdAt = new Date().toISOString();
  const snapshot = createSnapshot({
    formatVersion: 1,
    databaseVersion: DATABASE_VERSION,
    createdAt,
    tables,
  });

  const directory = backupDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const finalFile = new File(directory, backupFileName(createdAt));
  const temporaryFile = new File(directory, `${backupFileName(createdAt)}.tmp`);
  temporaryFile.create({ overwrite: true, intermediates: true });
  temporaryFile.write(JSON.stringify(snapshot));
  if (finalFile.exists) finalFile.delete();
  temporaryFile.move(finalFile);
  await rotateBackups(directory);
  return finalFile.uri;
}

async function rotateBackups(directory: Directory): Promise<void> {
  const files = directory
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.name.startsWith(BACKUP_FILE_PREFIX) && entry.name.endsWith('.json'));
  const obsolete = new Set(filesToDelete(files.map((file) => file.name)));
  for (const file of files) {
    if (obsolete.has(file.name)) file.delete();
  }
}

export async function readLatestValidBackup(): Promise<BackupSnapshot | null> {
  const directory = backupDirectory();
  if (!directory.exists) return null;
  const files = directory
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.name.startsWith(BACKUP_FILE_PREFIX) && entry.name.endsWith('.json'))
    .sort((a, b) => b.name.localeCompare(a.name));

  for (const file of files) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (isValidSnapshot(parsed)) return parsed;
    } catch {
      // Try the next rotation copy. A broken copy must not hide older valid data.
    }
  }
  return null;
}

export async function restoreLatestValidBackup(db: SQLiteDatabase): Promise<boolean> {
  const snapshot = await readLatestValidBackup();
  if (!snapshot || snapshot.databaseVersion < 1 || snapshot.databaseVersion > DATABASE_VERSION) return false;

  const allowedColumns = await readAllowedColumns(db);
  validateSnapshotColumns(snapshot, allowedColumns);

  await db.withExclusiveTransactionAsync(async (transaction) => {
    // Parent tasks can appear after their children in a snapshot. Defer the
    // foreign-key check until every table has been restored atomically.
    await transaction.execAsync('PRAGMA defer_foreign_keys = ON');
    for (const table of [...BACKUP_TABLES].reverse()) {
      await transaction.runAsync(`DELETE FROM ${table}`);
    }

    for (const table of BACKUP_TABLES) {
      for (const row of snapshot.tables[table]) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map((column) => normalizeBindValue(row[column]));
        await transaction.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          ...values,
        );
      }
    }
  });
  return true;
}

async function readAllowedColumns(db: SQLiteDatabase): Promise<Record<string, Set<string>>> {
  const result: Record<string, Set<string>> = {};
  for (const table of BACKUP_TABLES) {
    const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    result[table] = new Set(rows.map((row) => row.name));
  }
  return result;
}

function validateSnapshotColumns(snapshot: BackupSnapshot, allowedColumns: Record<string, Set<string>>): void {
  for (const table of BACKUP_TABLES) {
    for (const row of snapshot.tables[table]) {
      for (const column of Object.keys(row)) {
        if (!allowedColumns[table]?.has(column)) {
          throw new Error(`备份包含无法识别的字段：${table}.${column}`);
        }
      }
    }
  }
}

function normalizeBindValue(value: unknown): string | number | null {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  throw new Error('备份包含不支持的数据类型');
}
