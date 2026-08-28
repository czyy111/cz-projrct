import * as Notifications from 'expo-notifications';

import { getDatabase, runCriticalWrite } from '../database/client';
import { selectNotificationWindow, staleNotificationTaskIds } from './logic';

const CATEGORY = 'orange-plan-task';

type ExpectedReminder = { taskId: string; taskTitle: string; goalTitle: string; reminderAt: string };
type LinkRow = { task_id: string; system_identifier: string; scheduled_at: string };

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';

export function configureNotificationPresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) return 'granted';
  return permission.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.granted) { await reconcileNotifications(); return 'granted'; }
  return permission.canAskAgain ? 'undetermined' : 'denied';
}

export async function reconcileNotifications(): Promise<{ scheduled: number; permission: NotificationPermissionState }> {
  const permission = await getNotificationPermissionState();
  if (permission !== 'granted') return { scheduled: 0, permission };
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: 'complete', buttonTitle: '完成', options: { opensAppToForeground: true } },
    { identifier: 'delay', buttonTitle: '延后', options: { opensAppToForeground: true } },
  ]);
  const db = await getDatabase();
  const candidates = await db.getAllAsync<ExpectedReminder>(`SELECT t.id AS taskId, t.title AS taskTitle, g.title AS goalTitle, t.reminder_at AS reminderAt
    FROM tasks t JOIN goals g ON g.id = t.goal_id
    WHERE t.status = 'pending' AND t.deleted_at IS NULL AND t.replaced_at IS NULL AND g.deleted_at IS NULL AND g.status = 'active'
      AND t.reminder_enabled = 1 AND t.reminder_at IS NOT NULL`);
  const expected = selectNotificationWindow(candidates);
  const links = await db.getAllAsync<LinkRow>('SELECT task_id, system_identifier, scheduled_at FROM notification_links');
  const system = await Notifications.getAllScheduledNotificationsAsync();
  const systemIds = new Set(system.map((item) => item.identifier));
  const linkStates = links.map((link) => ({ taskId: link.task_id, systemIdentifier: link.system_identifier, scheduledAt: link.scheduled_at }));
  const deleteLinks = staleNotificationTaskIds(expected, linkStates, systemIds);

  for (const link of links) {
    if (deleteLinks.includes(link.task_id)) {
      if (systemIds.has(link.system_identifier)) await Notifications.cancelScheduledNotificationAsync(link.system_identifier);
    }
  }
  if (deleteLinks.length) await runCriticalWrite(async (tx) => { for (const taskId of deleteLinks) await tx.runAsync('DELETE FROM notification_links WHERE task_id = ?', taskId); }, { createBackup: false });

  const currentLinks = new Map(links.filter((link) => !deleteLinks.includes(link.task_id)).map((link) => [link.task_id, link]));
  let scheduled = 0;
  for (const item of expected) {
    if (currentLinks.has(item.taskId)) continue;
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: { title: '橙橙计划提醒', body: `${item.taskTitle} · ${item.goalTitle}`, data: { source: 'orange-plan', taskId: item.taskId }, categoryIdentifier: CATEGORY, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.reminderAt) },
      });
      await runCriticalWrite(async (tx) => {
        await tx.runAsync(`INSERT INTO notification_links (task_id, system_identifier, reminder_version, scheduled_at, status, updated_at) VALUES (?, ?, 1, ?, 'scheduled', ?) ON CONFLICT(task_id) DO UPDATE SET system_identifier = excluded.system_identifier, scheduled_at = excluded.scheduled_at, status = excluded.status, updated_at = excluded.updated_at`, item.taskId, identifier, item.reminderAt, new Date().toISOString());
      }, { createBackup: false });
      scheduled += 1;
    } catch {
      await runCriticalWrite(async (tx) => {
        await tx.runAsync(`INSERT INTO notification_links (task_id, system_identifier, reminder_version, scheduled_at, status, updated_at) VALUES (?, ?, 1, ?, 'failed', ?) ON CONFLICT(task_id) DO UPDATE SET system_identifier = excluded.system_identifier, scheduled_at = excluded.scheduled_at, status = 'failed', updated_at = excluded.updated_at`, item.taskId, `failed-${item.taskId}-${Date.now()}`, item.reminderAt, new Date().toISOString());
      }, { createBackup: false });
      // The task remains saved. A later app launch or permission change retries reconciliation.
    }
  }
  return { scheduled, permission };
}

export async function getNotificationDiagnostics(): Promise<{ scheduled: number; failed: number }> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ status: string; count: number }>('SELECT status, COUNT(*) AS count FROM notification_links GROUP BY status');
  return { scheduled: rows.find((row) => row.status === 'scheduled')?.count ?? 0, failed: rows.find((row) => row.status === 'failed')?.count ?? 0 };
}
