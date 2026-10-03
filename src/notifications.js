import { createId, createListStore } from './store.js';

const maxNotifications = 40;

function seedNotifications() {
  const now = Date.now();
  return [
    { id: 'n-seed-1', audience: 'user', type: 'service', title: 'IT Help Desk is open', message: 'The IT Help Desk is accepting visitors until 6:00 PM.', createdAt: new Date(now - 42 * 60000).toISOString(), read: true },
    { id: 'n-seed-2', audience: 'admin', type: 'queue', title: 'Health Clinic is getting busy', message: '6 visitors are now waiting at the Health Clinic.', createdAt: new Date(now - 18 * 60000).toISOString(), read: false },
    { id: 'n-seed-3', audience: 'admin', type: 'status', title: 'Riley Gomez was served', message: 'Student Services served the next visitor.', createdAt: new Date(now - 16 * 60000).toISOString(), read: true },
  ];
}

const store = createListStore('queuesmart-notifications', 'queuesmart-notifications-updated', seedNotifications);

export function addNotification({ audience = 'user', type = 'queue', title, message }) {
  const item = { id: createId('n'), audience, type, title, message, createdAt: new Date().toISOString(), read: false };
  store.write([item, ...store.read()].slice(0, maxNotifications));
  return item;
}

export function markAllRead(audience) {
  store.write(store.read().map(item => (item.audience === audience || item.audience === 'all' ? { ...item, read: true } : item)));
}

export function markRead(id) {
  store.write(store.read().map(item => (item.id === id ? { ...item, read: true } : item)));
}

export function clearNotifications(audience) {
  store.write(store.read().filter(item => item.audience !== audience && item.audience !== 'all'));
}

export function useNotifications(audience) {
  const items = store.useItems();
  const visible = items.filter(item => item.audience === audience || item.audience === 'all');
  return { notifications: visible, unreadCount: visible.filter(item => !item.read).length };
}
