import { createId, createListStore } from './store.js';

export const historyOutcomes = {
  served: { label: 'Served', description: 'You reached the front and were helped.' },
  left: { label: 'Left queue', description: 'You left before being served.' },
  removed: { label: 'Removed', description: 'An administrator removed you from the queue.' },
};

function daysAgo(days, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function seedHistory() {
  return [
    { id: 'h-seed-1', serviceId: 'it-help-desk', serviceName: 'IT Help Desk', joinedAt: daysAgo(1, 10, 5), endedAt: daysAgo(1, 10, 24), outcome: 'served', position: 3 },
    { id: 'h-seed-2', serviceId: 'health-clinic', serviceName: 'Health Clinic', joinedAt: daysAgo(4, 14, 30), endedAt: daysAgo(4, 14, 41), outcome: 'left', position: 5 },
    { id: 'h-seed-3', serviceId: 'student-services', serviceName: 'Student Services', joinedAt: daysAgo(9, 9, 15), endedAt: daysAgo(9, 9, 40), outcome: 'served', position: 4 },
  ];
}

const stores = new Map();

function storeFor(email) {
  const key = (email || 'guest').toLowerCase();
  if (!stores.has(key)) {
    stores.set(key, createListStore(`queuesmart-history:${key}`, `queuesmart-history-updated:${key}`, seedHistory));
  }
  return stores.get(key);
}

export function addHistoryEntry(email, { serviceId, serviceName, joinedAt, outcome, position }) {
  const store = storeFor(email);
  const entry = { id: createId('h'), serviceId, serviceName, joinedAt, endedAt: new Date().toISOString(), outcome, position };
  store.write([entry, ...store.read()]);
  return entry;
}

export function useHistory(email) {
  return storeFor(email).useItems();
}
