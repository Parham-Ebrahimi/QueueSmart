import { randomUUID } from 'node:crypto';

const servicesById = new Map();

export function listServices() {
  return [...servicesById.values()].map(service => ({ ...service }));
}

export function findServiceById(id) {
  const service = servicesById.get(id);
  return service ? { ...service } : null;
}

export function createService(input) {
  const now = new Date().toISOString();
  let id = input.id;
  if (!id) {
    do {
      id = `srv_${randomUUID()}`;
    } while (servicesById.has(id));
  }
  const service = {
    id,
    name: input.name,
    description: input.description,
    expectedDuration: input.expectedDuration,
    priority: input.priority,
    category: input.category || '',
    location: input.location || '',
    openUntil: input.openUntil || '5:00 PM',
    isOpen: input.isOpen ?? true,
    createdAt: now,
    updatedAt: now,
  };
  servicesById.set(service.id, service);
  return { ...service };
}

export function updateService(id, input) {
  const current = servicesById.get(id);
  if (!current) return null;
  const updated = {
    ...current,
    ...input,
    id,
    updatedAt: new Date().toISOString(),
  };
  servicesById.set(id, updated);
  return { ...updated };
}

export function removeService(id) {
  const service = findServiceById(id);
  if (!service) return null;
  servicesById.delete(id);
  return service;
}

export function resetServices() {
  servicesById.clear();
}
