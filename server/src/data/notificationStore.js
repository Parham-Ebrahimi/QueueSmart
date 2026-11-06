import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.js';

// Notices live in the notifications table. status is "sent" until the user views it.
const notificationColumns = `notification_id AS id, user_id AS userId, message, created_at AS createdAt, status,
  title, type, event, entry_id AS entryId, service_id AS serviceId, service_name AS serviceName, position`;

function toNotification(row) {
  return row ? { ...row, read: row.status === 'viewed' } : null;
}

export function addNotification(input) {
  const item = {
    type: 'queue',
    ...input,
    id: `ntf_${randomUUID()}`,
    createdAt: new Date().toISOString(),
    status: input.read || input.status === 'viewed' ? 'viewed' : 'sent',
  };
  getDatabase().prepare(`INSERT INTO notifications (
      notification_id, user_id, message, created_at, status, title, type, event, entry_id, service_id, service_name, position
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      item.id,
      item.userId,
      item.message,
      item.createdAt,
      item.status === 'viewed' ? 'viewed' : 'sent',
      item.title,
      item.type || 'queue',
      item.event,
      item.entryId ?? null,
      item.serviceId ?? null,
      item.serviceName ?? null,
      item.position ?? null,
    );
  return toNotification(findRow(item.userId, item.id));
}

function findRow(userId, notificationId) {
  return getDatabase().prepare(`SELECT ${notificationColumns} FROM notifications WHERE user_id = ? AND notification_id = ?`)
    .get(userId, notificationId) || null;
}

export function listNotificationsForUser(userId) {
  return getDatabase()
    .prepare(`SELECT ${notificationColumns} FROM notifications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC`)
    .all(userId)
    .map(toNotification);
}

export function findNotification(userId, notificationId) {
  return toNotification(findRow(userId, notificationId));
}

export function updateNotification(userId, notificationId, changes) {
  if (!findRow(userId, notificationId)) return null;
  if (changes.read === true || changes.status === 'viewed') {
    getDatabase().prepare("UPDATE notifications SET status = 'viewed' WHERE user_id = ? AND notification_id = ?")
      .run(userId, notificationId);
  }
  return toNotification(findRow(userId, notificationId));
}

export function markAllNotificationsRead(userId) {
  getDatabase().prepare("UPDATE notifications SET status = 'viewed' WHERE user_id = ?").run(userId);
  return listNotificationsForUser(userId);
}

export function hasNotificationEvent(userId, entryId, event) {
  return Boolean(
    getDatabase().prepare('SELECT 1 FROM notifications WHERE user_id = ? AND entry_id = ? AND event = ? LIMIT 1')
      .get(userId, entryId, event),
  );
}

export function resetNotifications() {
  getDatabase().exec('DELETE FROM notifications');
}
