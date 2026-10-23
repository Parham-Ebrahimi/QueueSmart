import { addHistoryEntry, listHistoryForUser } from '../../data/historyStore.js';
import { createEntry, findEntryById, listEntries, listWaitingEntries, setWaitingOrder, updateEntry } from '../../data/queueStore.js';
import { findServiceById, listServices } from '../../data/serviceStore.js';
import ApiError from '../../utils/ApiError.js';
import { notifyAdminsOfJoin, notifyApproachingFront, notifyJoined, notifyOutcome } from '../notifications/notifications.service.js';

const priorityRank = { normal: 0, high: 1 };
const RECENTLY_SERVED_LIMIT = 6;

// Where a new entry goes: behind everyone with the same or higher priority, ahead of anyone lower.
// Within one priority level this keeps arrival order.
export function insertionIndex(waiting, priority) {
  const rank = priorityRank[priority] ?? 0;
  const index = waiting.findIndex(entry => (priorityRank[entry.priority] ?? 0) < rank);
  return index === -1 ? waiting.length : index;
}

function requireService(serviceId) {
  const service = findServiceById(serviceId);
  if (!service) throw ApiError.notFound('Service not found.');
  return service;
}

function withPosition(entry, service, position) {
  return { ...entry, position, estimatedWaitMinutes: position ? (position - 1) * service.expectedDuration : 0 };
}

function positionedQueue(service) {
  return listWaitingEntries(service.id).map((entry, index) => withPosition(entry, service, index + 1));
}

function findWaitingEntryForUser(userId) {
  return listEntries(entry => entry.userId === userId && entry.status === 'waiting')[0] || null;
}

function takeOutOfLine(serviceId, entryId) {
  setWaitingOrder(serviceId, listWaitingEntries(serviceId).filter(entry => entry.id !== entryId).map(entry => entry.id));
}

// Ends a visit and writes the participation record for the user.
function finishEntry(entry, service, outcome) {
  const endedAt = new Date().toISOString();
  takeOutOfLine(service.id, entry.id);
  const finished = updateEntry(entry.id, { status: outcome, endedAt });
  addHistoryEntry({
    userId: entry.userId,
    entryId: entry.id,
    serviceId: service.id,
    serviceName: service.name,
    joinedAt: entry.joinedAt,
    endedAt,
    outcome,
    position: entry.initialPosition,
  });
  const positioned = withPosition(finished, service, 0);
  notifyOutcome(positioned, service, outcome);
  notifyApproachingFront(positionedQueue(service), service);
  return positioned;
}

function requireWaitingEntry(service, entryId) {
  const entry = findEntryById(entryId);
  if (!entry || entry.serviceId !== service.id || entry.status !== 'waiting') {
    throw ApiError.notFound('That visitor is not waiting in this queue.');
  }
  return entry;
}

export function joinQueue(serviceId, user, { name, priority }) {
  const service = requireService(serviceId);
  if (!service.isOpen) throw ApiError.conflict('This service is closed and is not accepting new visitors.', undefined, 'SERVICE_CLOSED');
  if (findWaitingEntryForUser(user.id)) {
    throw ApiError.conflict('You are already waiting in a queue. Leave it before joining another.', undefined, 'ALREADY_IN_QUEUE');
  }

  const waiting = listWaitingEntries(serviceId);
  const index = insertionIndex(waiting, priority);
  const entry = createEntry({
    serviceId,
    userId: user.id,
    email: user.email,
    name: name || user.email.split('@')[0],
    priority,
    initialPosition: index + 1,
  });
  const ids = waiting.map(item => item.id);
  ids.splice(index, 0, entry.id);
  setWaitingOrder(serviceId, ids);
  const positioned = withPosition(entry, service, index + 1);
  notifyJoined(user, positioned, service);
  notifyAdminsOfJoin(positioned, service);
  notifyApproachingFront(positionedQueue(service), service);
  return positioned;
}

export function leaveQueue(serviceId, user) {
  const service = requireService(serviceId);
  const entry = listWaitingEntries(serviceId).find(item => item.userId === user.id);
  if (!entry) throw new ApiError(404, 'NOT_IN_QUEUE', 'You are not waiting in this queue.');
  return finishEntry(entry, service, 'left');
}

export function serveNext(serviceId) {
  const service = requireService(serviceId);
  const [next] = listWaitingEntries(serviceId);
  if (!next) throw ApiError.conflict('Nobody is waiting in this queue.', undefined, 'QUEUE_EMPTY');
  return finishEntry(next, service, 'served');
}

export function removeEntry(serviceId, entryId) {
  const service = requireService(serviceId);
  return finishEntry(requireWaitingEntry(service, entryId), service, 'removed');
}

// Lets an administrator override the automatic order by swapping a visitor with a neighbour.
export function moveEntry(serviceId, entryId, direction) {
  const service = requireService(serviceId);
  requireWaitingEntry(service, entryId);
  const ids = listWaitingEntries(serviceId).map(entry => entry.id);
  const index = ids.indexOf(entryId);
  const target = index + direction;
  if (target < 0 || target >= ids.length) {
    throw ApiError.conflict(`This visitor is already at the ${direction < 0 ? 'front' : 'back'} of the queue.`, undefined, 'CANNOT_MOVE');
  }
  [ids[index], ids[target]] = [ids[target], ids[index]];
  setWaitingOrder(serviceId, ids);
  const queue = positionedQueue(service);
  notifyApproachingFront(queue, service);
  return queue;
}

// Called when a service is deleted so nobody is left waiting in a queue that no longer exists.
export function closeOutQueue(service) {
  for (const entry of listWaitingEntries(service.id)) finishEntry(entry, service, 'removed');
}

// Administrators see every waiting visitor; users only see counts and their own place.
export function getQueueView(serviceId, viewer) {
  return buildQueueView(requireService(serviceId), viewer);
}

export function listQueueViews(viewer) {
  return listServices().map(service => buildQueueView(service, viewer));
}

function buildQueueView(service, viewer) {
  const queue = positionedQueue(service);
  const view = {
    serviceId: service.id,
    serviceName: service.name,
    isOpen: service.isOpen,
    expectedDuration: service.expectedDuration,
    waitingCount: queue.length,
    estimatedWaitMinutes: queue.length * service.expectedDuration,
  };
  if (viewer.role === 'admin') {
    view.entries = queue;
    view.recentlyServed = listEntries(entry => entry.serviceId === service.id && entry.status === 'served')
      .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
      .slice(0, RECENTLY_SERVED_LIMIT);
  } else {
    view.myEntry = queue.find(entry => entry.userId === viewer.id) || null;
  }
  return view;
}

// Current status of one visit, including finished ones (served, left, removed).
export function getEntry(serviceId, entryId, viewer) {
  const entry = findEntryById(entryId);
  // Users get the same 404 for someone else's entry as for a missing one.
  if (!entry || entry.serviceId !== serviceId || (viewer.role !== 'admin' && entry.userId !== viewer.id)) {
    throw ApiError.notFound('Queue entry not found.');
  }
  const service = findServiceById(serviceId) || { expectedDuration: 0 };
  if (entry.status !== 'waiting') return withPosition(entry, service, 0);
  const index = listWaitingEntries(serviceId).findIndex(item => item.id === entryId);
  return withPosition(entry, service, index + 1);
}

export function getHistory(userId, viewer) {
  if (viewer.role !== 'admin' && viewer.id !== userId) throw ApiError.forbidden('You can only view your own queue history.');
  return listHistoryForUser(userId);
}
