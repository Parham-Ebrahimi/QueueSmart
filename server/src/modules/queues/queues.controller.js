import ApiError from '../../utils/ApiError.js';
import {
  getEntry as findEntry,
  getHistory,
  getQueueView,
  joinQueue,
  leaveQueue,
  listQueueViews,
  moveEntry as moveQueueEntry,
  removeEntry as removeQueueEntry,
  serveNext as serveNextEntry,
} from './queues.service.js';
import { isValidId, validateJoin, validateMove } from './queues.validation.js';

function assertValid({ errors, value }) {
  if (Object.keys(errors).length) throw ApiError.validation(errors);
  return value;
}

function assertIds(params) {
  const errors = {};
  if (params.serviceId !== undefined && !isValidId(params.serviceId)) errors.serviceId = 'Service ID is invalid.';
  if (params.entryId !== undefined && !isValidId(params.entryId)) errors.entryId = 'Entry ID is invalid.';
  if (params.userId !== undefined && !isValidId(params.userId)) errors.userId = 'User ID is invalid.';
  if (Object.keys(errors).length) throw ApiError.validation(errors);
}

// GET /api/queues -> { queues: [view] }
export function listQueues(req, res) {
  res.json({ queues: listQueueViews(req.user) });
}

// GET /api/queues/:serviceId -> { queue: view }
export function getQueue(req, res) {
  assertIds(req.params);
  res.json({ queue: getQueueView(req.params.serviceId, req.user) });
}

// POST /api/queues/:serviceId/join  { name?, priority? } -> 201 { entry }
export function join(req, res) {
  assertIds(req.params);
  const input = assertValid(validateJoin(req.body));
  res.status(201).json({ entry: joinQueue(req.params.serviceId, req.user, input) });
}

// POST /api/queues/:serviceId/leave -> { entry }
export function leave(req, res) {
  assertIds(req.params);
  res.json({ entry: leaveQueue(req.params.serviceId, req.user) });
}

// POST /api/queues/:serviceId/serve-next -> { served, queue }
export function serveNext(req, res) {
  assertIds(req.params);
  const served = serveNextEntry(req.params.serviceId);
  res.json({ served, queue: getQueueView(req.params.serviceId, req.user) });
}

// GET /api/queues/:serviceId/entries/:entryId -> { entry }
export function getEntry(req, res) {
  assertIds(req.params);
  res.json({ entry: findEntry(req.params.serviceId, req.params.entryId, req.user) });
}

// DELETE /api/queues/:serviceId/entries/:entryId -> { removed, queue }
export function removeEntry(req, res) {
  assertIds(req.params);
  const removed = removeQueueEntry(req.params.serviceId, req.params.entryId);
  res.json({ removed, queue: getQueueView(req.params.serviceId, req.user) });
}

// POST /api/queues/:serviceId/entries/:entryId/move  { direction: -1 | 1 } -> { queue }
export function moveEntry(req, res) {
  assertIds(req.params);
  const { direction } = assertValid(validateMove(req.body));
  moveQueueEntry(req.params.serviceId, req.params.entryId, direction);
  res.json({ queue: getQueueView(req.params.serviceId, req.user) });
}

// GET /api/users/:userId/history -> { history }
export function listHistory(req, res) {
  assertIds(req.params);
  res.json({ history: getHistory(req.params.userId, req.user) });
}
