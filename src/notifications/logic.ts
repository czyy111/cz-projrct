export type NotificationCandidate = { taskId: string; reminderAt: string };

export function selectNotificationWindow<T extends NotificationCandidate>(items: T[], now = new Date(), limit = 60): T[] {
  const timestamp = now.getTime();
  return items
    .filter((item) => Number.isFinite(new Date(item.reminderAt).getTime()) && new Date(item.reminderAt).getTime() > timestamp)
    .sort((a, b) => a.reminderAt.localeCompare(b.reminderAt))
    .slice(0, limit);
}

export type NotificationLinkState = { taskId: string; systemIdentifier: string; scheduledAt: string };

export function staleNotificationTaskIds(expected: NotificationCandidate[], links: NotificationLinkState[], systemIdentifiers: Set<string>): string[] {
  const expectedMap = new Map(expected.map((item) => [item.taskId, item]));
  return links.filter((link) => {
    const item = expectedMap.get(link.taskId);
    return !item || item.reminderAt !== link.scheduledAt || !systemIdentifiers.has(link.systemIdentifier);
  }).map((link) => link.taskId);
}
