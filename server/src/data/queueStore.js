import { randomUUID } from 'node:crypto';

// In-memory queue entries. Like the other stores, everything resets when the server restarts.
// Each service keeps an ordered list of waiting entry IDs; finished entries stay in entriesById
// so a user can still look up how their visit ended.
const entriesById = new Map();
const waitingIdsByService = new Map();

function waitingIds(serviceId) {
  if (!waitingIdsByService.has(serviceId)) waitingIdsByService.set(serviceId, []);
  return waitingIdsByService.get(serviceId);
}

export function createEntry(input) {
  let id;
  do {
    id = `qe_${randomUUID()}`;
  } while (entriesById.has(id));
  const entry = { id, status: 'waiting', joinedAt: new Date().toISOString(), endedAt: null, ...input };
  entriesById.set(id, entry);
  return { ...entry };
}

export function findEntryById(id) {
  const entry = entriesById.get(id);
  return entry ? { ...entry } : null;
}

export function updateEntry(id, changes) {
  const current = entriesById.get(id);
  if (!current) return null;
  const updated = { ...current, ...changes, id };
  entriesById.set(id, updated);
  return { ...updated };
}

// Waiting entries in serving order (index 0 is served next).
export function listWaitingEntries(serviceId) {
  return waitingIds(serviceId).map(id => ({ ...entriesById.get(id) }));
}

export function setWaitingOrder(serviceId, ids) {
  waitingIdsByService.set(serviceId, [...ids]);
}

export function listEntries(filter = () => true) {
  return [...entriesById.values()].filter(filter).map(entry => ({ ...entry }));
}

export function resetQueues() {
  entriesById.clear();
  waitingIdsByService.clear();
}
