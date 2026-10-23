import { getUserNotifications, markAllNotificationsRead as markAllNotificationsReadApi, markNotificationRead as markNotificationReadApi } from './api.js';
import { createId, createListStore } from './store.js';

const maxNotifications = 40;

// Local notices are for admin workspace actions that stay on this browser
// (creating a service, opening a queue). Queue join / approaching-front /
// served notices come from GET /api/users/:userId/notifications.
const localStore = createListStore('queuesmart-notifications', 'queuesmart-notifications-updated', () => []);
const remoteStore = createListStore('queuesmart-server-notifications', 'queuesmart-server-notifications-updated', () => []);

function isServerNotice(item) {
  return typeof item?.id === 'string' && item.id.startsWith('ntf_');
}

function mergeNotices(session, localItems, remoteItems) {
  const audience = session?.role;
  const local = localItems.filter(item => item.audience === audience || item.audience === 'all');
  const remote = session?.id ? remoteItems : [];
  const seen = new Set();
  const merged = [];
  for (const item of [...remote, ...local]) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function syncNotifications(session) {
  if (!session?.id || !session.token) return [];
  const notifications = await getUserNotifications(session.id, session.token);
  // Keep an optimistic read if a mark-read request is still in flight.
  const alreadyRead = new Set(remoteStore.read().filter(item => item.read).map(item => item.id));
  remoteStore.write(notifications.map(item => (alreadyRead.has(item.id) ? { ...item, read: true } : item)));
  return notifications;
}

export function addNotification({ audience = 'user', type = 'queue', title, message }) {
  const item = { id: createId('n'), audience, type, title, message, createdAt: new Date().toISOString(), read: false };
  localStore.write([item, ...localStore.read()].slice(0, maxNotifications));
  return item;
}

export function markAllRead(audienceOrSession) {
  if (audienceOrSession && typeof audienceOrSession === 'object' && audienceOrSession.id) {
    const session = audienceOrSession;
    localStore.write(localStore.read().map(item => (
      item.audience === session.role || item.audience === 'all' ? { ...item, read: true } : item
    )));
    remoteStore.write(remoteStore.read().map(item => ({ ...item, read: true })));
    if (session.token) markAllNotificationsReadApi(session.id, session.token).then(items => remoteStore.write(items)).catch(() => {});
    return;
  }
  const audience = audienceOrSession;
  localStore.write(localStore.read().map(item => (item.audience === audience || item.audience === 'all' ? { ...item, read: true } : item)));
}

export function markRead(id, session) {
  if (isServerNotice({ id }) && session?.id && session.token) {
    remoteStore.write(remoteStore.read().map(item => (item.id === id ? { ...item, read: true } : item)));
    markNotificationReadApi(session.id, id, session.token)
      .then(updated => remoteStore.write(remoteStore.read().map(item => (item.id === updated.id ? updated : item))))
      .catch(() => {});
    return;
  }
  localStore.write(localStore.read().map(item => (item.id === id ? { ...item, read: true } : item)));
}

export function clearNotifications(audienceOrSession) {
  if (audienceOrSession && typeof audienceOrSession === 'object' && audienceOrSession.id) {
    const session = audienceOrSession;
    localStore.write(localStore.read().filter(item => item.audience !== session.role && item.audience !== 'all'));
    markAllRead(session);
    return;
  }
  const audience = audienceOrSession;
  localStore.write(localStore.read().filter(item => item.audience !== audience && item.audience !== 'all'));
}

export function useNotifications(audienceOrSession) {
  const localItems = localStore.useItems();
  const remoteItems = remoteStore.useItems();
  const session = audienceOrSession && typeof audienceOrSession === 'object' ? audienceOrSession : { role: audienceOrSession };
  const notifications = mergeNotices(session, localItems, remoteItems);
  return { notifications, unreadCount: notifications.filter(item => !item.read).length };
}
