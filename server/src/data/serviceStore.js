import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.js';

const serviceColumns = `service_id AS id, name, description,
  expected_duration AS expectedDuration, priority, category, location,
  open_until AS openUntil, is_open AS isOpen, created_at AS createdAt, updated_at AS updatedAt`;

function toService(row) {
  return row ? { ...row, isOpen: Boolean(row.isOpen) } : null;
}

export function listServices() {
  return getDatabase().prepare(`SELECT ${serviceColumns} FROM services ORDER BY rowid`).all().map(toService);
}

export function findServiceById(id) {
  return toService(getDatabase().prepare(`SELECT ${serviceColumns} FROM services WHERE service_id = ?`).get(id));
}

export function createService(input) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = input.id || `srv_${randomUUID()}`;
  const service = {
    id,
    name: input.name,
    description: input.description ?? input.name,
    expectedDuration: input.expectedDuration,
    priority: input.priority ?? 'medium',
    category: input.category || '',
    location: input.location || '',
    openUntil: input.openUntil || '5:00 PM',
    isOpen: input.isOpen ?? true,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`INSERT INTO services (
    service_id, name, description, expected_duration, priority, category,
    location, open_until, is_open, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    service.id,
    service.name,
    service.description,
    service.expectedDuration,
    service.priority,
    service.category,
    service.location,
    service.openUntil,
    Number(service.isOpen),
    service.createdAt,
    service.updatedAt,
  );

  return service;
}

export function updateService(id, input) {
  const columns = {
    name: 'name',
    description: 'description',
    expectedDuration: 'expected_duration',
    priority: 'priority',
    category: 'category',
    location: 'location',
    openUntil: 'open_until',
    isOpen: 'is_open',
  };
  const updates = Object.entries(input)
    .filter(([field]) => Object.hasOwn(columns, field))
    .map(([field, value]) => [columns[field], field === 'isOpen' ? Number(value) : value]);
  if (!updates.length) return findServiceById(id);

  updates.push(['updated_at', new Date().toISOString()]);
  const assignments = updates.map(([column]) => `${column} = ?`).join(', ');
  getDatabase().prepare(`UPDATE services SET ${assignments} WHERE service_id = ?`)
    .run(...updates.map(([, value]) => value), id);
  return findServiceById(id);
}

export function removeService(id) {
  const service = findServiceById(id);
  if (!service) return null;
  getDatabase().prepare('DELETE FROM services WHERE service_id = ?').run(id);
  return service;
}

export function resetServices() {
  getDatabase().exec('DELETE FROM services');
}
