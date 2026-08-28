import * as SecureStore from 'expo-secure-store';

import { getDatabase, runCriticalWrite } from '../database/client';
import type { ApiConfig, ApiInterfaceType } from '../domain/types';
import { createId } from '../utils/id';

type ApiConfigRow = {
  id: string; name: string; provider: string; interface_type: ApiInterfaceType; base_url: string;
  model: string; secret_ref: string; is_default: number; last_test_at: string | null; last_test_status: string | null;
};

function mapConfig(row: ApiConfigRow): ApiConfig {
  return { id: row.id, name: row.name, provider: row.provider, interfaceType: row.interface_type, baseUrl: row.base_url, model: row.model, secretRef: row.secret_ref, isDefault: row.is_default === 1, lastTestAt: row.last_test_at, lastTestStatus: row.last_test_status };
}

export async function listApiConfigs(): Promise<ApiConfig[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ApiConfigRow>('SELECT * FROM api_configs ORDER BY is_default DESC, updated_at DESC');
  return rows.map(mapConfig);
}

export async function getApiConfig(id: string): Promise<ApiConfig | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ApiConfigRow>('SELECT * FROM api_configs WHERE id = ?', id);
  return row ? mapConfig(row) : null;
}

export async function getDefaultApiConfig(): Promise<ApiConfig | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ApiConfigRow>('SELECT * FROM api_configs ORDER BY is_default DESC, updated_at DESC LIMIT 1');
  return row ? mapConfig(row) : null;
}

export async function readApiKey(config: ApiConfig): Promise<string | null> {
  return SecureStore.getItemAsync(config.secretRef);
}

export async function saveApiConfig(values: {
  id?: string; name: string; provider: string; interfaceType: ApiInterfaceType; baseUrl: string; model: string; apiKey?: string;
}): Promise<string> {
  const existing = values.id ? await getApiConfig(values.id) : null;
  const id = existing?.id ?? createId('api');
  const secretRef = existing?.secretRef ?? `orange-plan.api-key.${id}`;
  if (!existing && !values.apiKey?.trim()) throw new Error('请填写 API Key');
  if (values.apiKey?.trim()) await SecureStore.setItemAsync(secretRef, values.apiKey.trim());
  const now = new Date().toISOString();
  await runCriticalWrite(async (tx) => {
    if (existing) {
      await tx.runAsync(
        `UPDATE api_configs SET name = ?, provider = ?, interface_type = ?, base_url = ?, model = ?, updated_at = ? WHERE id = ?`,
        values.name.trim(), values.provider, values.interfaceType, values.baseUrl.trim().replace(/\/$/, ''), values.model.trim(), now, id,
      );
    } else {
      const count = await tx.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM api_configs');
      await tx.runAsync(
        `INSERT INTO api_configs (id, name, provider, interface_type, base_url, model, secret_ref, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, values.name.trim(), values.provider, values.interfaceType, values.baseUrl.trim().replace(/\/$/, ''), values.model.trim(), secretRef, count?.count === 0 ? 1 : 0, now, now,
      );
    }
  });
  return id;
}

export async function setDefaultApiConfig(id: string): Promise<void> {
  await runCriticalWrite(async (tx) => {
    await tx.runAsync('UPDATE api_configs SET is_default = 0');
    await tx.runAsync('UPDATE api_configs SET is_default = 1, updated_at = ? WHERE id = ?', new Date().toISOString(), id);
  });
}

export async function saveConnectionTest(id: string, status: string): Promise<void> {
  await runCriticalWrite(async (tx) => {
    await tx.runAsync('UPDATE api_configs SET last_test_at = ?, last_test_status = ?, updated_at = ? WHERE id = ?', new Date().toISOString(), status, new Date().toISOString(), id);
  }, { createBackup: false });
}

export async function deleteApiConfig(id: string): Promise<void> {
  const config = await getApiConfig(id);
  if (!config) return;
  await runCriticalWrite(async (tx) => {
    await tx.runAsync('DELETE FROM api_configs WHERE id = ?', id);
    if (config.isDefault) {
      await tx.runAsync(`UPDATE api_configs SET is_default = 1, updated_at = ? WHERE id = (SELECT id FROM api_configs ORDER BY updated_at DESC LIMIT 1)`, new Date().toISOString());
    }
  });
  await SecureStore.deleteItemAsync(config.secretRef);
}
