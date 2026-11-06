import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.js';

// Participation history lives in the queue_history table, newest first per user.
const historyColumns = `history_id AS id, user_id AS userId, entry_id AS entryId, service_id AS serviceId,
  service_name AS serviceName, joined_at AS joinedAt, ended_at AS endedAt, outcome, position`;

export function addHistoryEntry(input) {
  const entry = { id: `hist_${randomUUID()}`, ...input };
  getDatabase().prepare(`INSERT INTO queue_history (history_id, user_id, entry_id, service_id, service_name, joined_at, ended_at, outcome, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(entry.id, entry.userId, entry.entryId, entry.serviceId, entry.serviceName, entry.joinedAt, entry.endedAt, entry.outcome, entry.position);
  return entry;
}

export function listHistoryForUser(userId) {
  return getDatabase().prepare(`SELECT ${historyColumns} FROM queue_history WHERE user_id = ? ORDER BY ended_at DESC, rowid DESC`).all(userId);
}

export function resetHistory() {
  getDatabase().exec('DELETE FROM queue_history');
}
