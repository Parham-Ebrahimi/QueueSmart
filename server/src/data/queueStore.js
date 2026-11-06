import { randomUUID } from 'node:crypto';
import { getDatabase, transaction } from './database.js';

// Queues and queue entries live in SQLite (see schema.sql). Each service has one queue row;
// each user's visit is a queue_entries row linked to that queue and to the user's account.
// Waiting entries keep a stored position (1 = served next) that these functions keep gap-free.

const entryColumns = `e.entry_id AS id, q.queue_id AS queueId, q.service_id AS serviceId, e.user_id AS userId,
  c.email, e.visitor_name AS name, e.priority, e.status, e.position, e.initial_position AS initialPosition,
  e.joined_at AS joinedAt, e.ended_at AS endedAt`;
const entryFrom = `FROM queue_entries e
  JOIN queues q ON q.queue_id = e.queue_id
  JOIN user_credentials c ON c.id = e.user_id`;

function selectEntries(where, ...params) {
  return getDatabase().prepare(`SELECT ${entryColumns} ${entryFrom} WHERE ${where}`).all(...params);
}

export function findQueueByServiceId(serviceId) {
  return getDatabase().prepare(`SELECT queue_id AS id, service_id AS serviceId, status, created_at AS createdAt, updated_at AS updatedAt
    FROM queues WHERE service_id = ?`).get(serviceId) || null;
}

export function findEntryById(id) {
  return selectEntries('e.entry_id = ?', id)[0] || null;
}

export function findWaitingEntryForUser(userId) {
  return selectEntries("e.user_id = ? AND e.status = 'waiting'", userId)[0] || null;
}

// Waiting entries in serving order (position 1 first).
export function listWaitingEntries(serviceId) {
  return selectEntries("q.service_id = ? AND e.status = 'waiting' ORDER BY e.position", serviceId);
}

export function listRecentlyServed(serviceId, limit) {
  return selectEntries("q.service_id = ? AND e.status = 'served' ORDER BY e.ended_at DESC, e.rowid DESC LIMIT ?", serviceId, limit);
}

// Adds a waiting entry at `position`, moving everyone at or behind that position back one place.
export function insertWaitingEntry({ serviceId, userId, name, priority, position }) {
  const db = getDatabase();
  const queue = findQueueByServiceId(serviceId);
  const id = `qe_${randomUUID()}`;
  transaction(() => {
    db.prepare("UPDATE queue_entries SET position = position + 1 WHERE queue_id = ? AND status = 'waiting' AND position >= ?")
      .run(queue.id, position);
    db.prepare(`INSERT INTO queue_entries (entry_id, queue_id, user_id, visitor_name, priority, status, position, initial_position, joined_at)
      VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?, ?)`).run(id, queue.id, userId, name, priority, position, position, new Date().toISOString());
  });
  return findEntryById(id);
}

// Ends a waiting entry with the given status and closes the gap it leaves in the line.
// Call inside a transaction when other writes (such as history) must happen with it.
export function finishWaitingEntry(id, status, endedAt) {
  const db = getDatabase();
  const entry = findEntryById(id);
  db.prepare('UPDATE queue_entries SET status = ?, position = NULL, ended_at = ? WHERE entry_id = ?').run(status, endedAt, id);
  db.prepare("UPDATE queue_entries SET position = position - 1 WHERE queue_id = ? AND status = 'waiting' AND position > ?")
    .run(entry.queueId, entry.position);
  return findEntryById(id);
}

export function swapPositions(firstId, secondId) {
  const db = getDatabase();
  const first = findEntryById(firstId);
  const second = findEntryById(secondId);
  transaction(() => {
    const setPosition = db.prepare('UPDATE queue_entries SET position = ? WHERE entry_id = ?');
    setPosition.run(second.position, first.id);
    setPosition.run(first.position, second.id);
  });
}

export function resetQueues() {
  getDatabase().exec('DELETE FROM queue_entries');
}
