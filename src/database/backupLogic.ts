import { BACKUP_TABLES, type BackupTableName } from './schema';

export const MAX_BACKUP_FILES = 3;

export type BackupPayload = {
  formatVersion: 1;
  databaseVersion: number;
  createdAt: string;
  tables: Record<BackupTableName, Record<string, unknown>[]>;
};

export type BackupSnapshot = BackupPayload & { checksum: string };

export function checksumText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createSnapshot(payload: BackupPayload): BackupSnapshot {
  return { ...payload, checksum: checksumText(JSON.stringify(payload)) };
}

export function isValidSnapshot(value: unknown): value is BackupSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<BackupSnapshot>;
  if (
    snapshot.formatVersion !== 1 ||
    typeof snapshot.databaseVersion !== 'number' ||
    typeof snapshot.createdAt !== 'string' ||
    typeof snapshot.checksum !== 'string' ||
    !snapshot.tables ||
    typeof snapshot.tables !== 'object'
  ) {
    return false;
  }
  for (const table of BACKUP_TABLES) {
    const rows = (snapshot.tables as Partial<BackupPayload['tables']>)[table];
    if (!Array.isArray(rows) || rows.some((row) => !isBackupRow(row))) return false;
  }
  const { checksum, ...payload } = snapshot as BackupSnapshot;
  return checksumText(JSON.stringify(payload)) === checksum;
}

function isBackupRow(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(
    (field) => field === null || ['string', 'number', 'boolean'].includes(typeof field),
  );
}

export function filesToDelete(fileNames: string[], maxFiles = MAX_BACKUP_FILES): string[] {
  return [...fileNames].sort((a, b) => b.localeCompare(a)).slice(maxFiles);
}
