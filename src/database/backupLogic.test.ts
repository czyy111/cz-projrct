import { describe, expect, it } from 'vitest';

import { createSnapshot, filesToDelete, isValidSnapshot, type BackupPayload } from './backupLogic';
import { BACKUP_TABLES } from './schema';

function emptyPayload(): BackupPayload {
  const tables = {} as BackupPayload['tables'];
  for (const table of BACKUP_TABLES) tables[table] = [];
  return {
    formatVersion: 1,
    databaseVersion: 1,
    createdAt: '2026-08-27T10:00:00.000Z',
    tables,
  };
}

describe('backup snapshots', () => {
  it('accepts an unchanged snapshot', () => {
    expect(isValidSnapshot(createSnapshot(emptyPayload()))).toBe(true);
  });

  it('rejects modified data', () => {
    const snapshot = createSnapshot(emptyPayload());
    snapshot.databaseVersion = 2;
    expect(isValidSnapshot(snapshot)).toBe(false);
  });

  it('rejects a snapshot with a missing table even when its checksum matches', () => {
    const payload = emptyPayload();
    delete (payload.tables as Partial<BackupPayload['tables']>).tasks;
    expect(isValidSnapshot(createSnapshot(payload))).toBe(false);
  });

  it('rejects unsupported nested values', () => {
    const payload = emptyPayload();
    payload.tables.preferences.push({ key: 'bad', value_json: { nested: true } });
    expect(isValidSnapshot(createSnapshot(payload))).toBe(false);
  });

  it('keeps only the three newest files', () => {
    expect(filesToDelete(['backup-1.json', 'backup-4.json', 'backup-3.json', 'backup-2.json'])).toEqual([
      'backup-1.json',
    ]);
  });
});
