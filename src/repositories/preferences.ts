import { getDatabase, runCriticalWrite } from '../database/client';

export async function getPreference<T>(key: string): Promise<T | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value_json: string }>('SELECT value_json FROM preferences WHERE key = ?', key);
  if (!row) return null;
  try { return JSON.parse(row.value_json) as T; } catch { return null; }
}

export async function setPreference(key: string, value: unknown): Promise<void> {
  await runCriticalWrite(async (tx) => {
    await tx.runAsync(
      `INSERT INTO preferences (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      key, JSON.stringify(value), new Date().toISOString(),
    );
  }, { createBackup: false });
}

export async function deletePreference(key: string): Promise<void> {
  await runCriticalWrite(async (tx) => { await tx.runAsync('DELETE FROM preferences WHERE key = ?', key); }, { createBackup: false });
}
