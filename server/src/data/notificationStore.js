import { randomUUID } from 'node:crypto';

// In-memory notifications, newest first per user. Resets when the server restarts.
const notificationsByUser = new Map();

export function addNotification(input) {
  const item = {
    id: `ntf_${randomUUID()}`,
    read: false,
    createdAt: new Date().toISOString(),
    ...input,
  };
  notificationsByUser.set(input.userId, [item, ...(notificationsByUser.get(input.userId) || [])]);
  return { ...item };
}

export function listNotificationsForUser(userId) {
  return (notificationsByUser.get(userId) || []).map(item => ({ ...item }));
}

export function findNotification(userId, notificationId) {
  const item = (notificationsByUser.get(userId) || []).find(entry => entry.id === notificationId);
  return item ? { ...item } : null;
}

export function updateNotification(userId, notificationId, changes) {
  const items = notificationsByUser.get(userId) || [];
  const index = items.findIndex(item => item.id === notificationId);
  if (index === -1) return null;
  const updated = { ...items[index], ...changes, id: items[index].id, userId };
  items[index] = updated;
  notificationsByUser.set(userId, items);
  return { ...updated };
}

export function markAllNotificationsRead(userId) {
  const items = (notificationsByUser.get(userId) || []).map(item => ({ ...item, read: true }));
  notificationsByUser.set(userId, items);
  return items.map(item => ({ ...item }));
}

export function hasNotificationEvent(userId, entryId, event) {
  return (notificationsByUser.get(userId) || []).some(item => item.entryId === entryId && item.event === event);
}

export function resetNotifications() {
  notificationsByUser.clear();
}
