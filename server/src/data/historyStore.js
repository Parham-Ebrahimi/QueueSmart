import { randomUUID } from 'node:crypto';

// In-memory participation history, newest first per user. Resets when the server restarts.
const historyByUser = new Map();

export function addHistoryEntry(input) {
  const entry = { id: `hist_${randomUUID()}`, ...input };
  historyByUser.set(input.userId, [entry, ...(historyByUser.get(input.userId) || [])]);
  return { ...entry };
}

export function listHistoryForUser(userId) {
  return (historyByUser.get(userId) || []).map(entry => ({ ...entry }));
}

export function resetHistory() {
  historyByUser.clear();
}
