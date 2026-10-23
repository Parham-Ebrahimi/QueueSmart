import ApiError from '../../utils/ApiError.js';
import { isValidId } from '../queues/queues.validation.js';
import { getNotifications, markNotificationRead, markNotificationsRead } from './notifications.service.js';

function assertIds(params) {
  const errors = {};
  if (params.userId !== undefined && !isValidId(params.userId)) errors.userId = 'User ID is invalid.';
  if (params.notificationId !== undefined && !isValidId(params.notificationId)) errors.notificationId = 'Notification ID is invalid.';
  if (Object.keys(errors).length) throw ApiError.validation(errors);
}

// GET /api/users/:userId/notifications -> { notifications }
export function listNotifications(req, res) {
  assertIds(req.params);
  res.json({ notifications: getNotifications(req.params.userId, req.user) });
}

// POST /api/users/:userId/notifications/:notificationId/read -> { notification }
export function readNotification(req, res) {
  assertIds(req.params);
  res.json({ notification: markNotificationRead(req.params.userId, req.params.notificationId, req.user) });
}

// POST /api/users/:userId/notifications/read-all -> { notifications }
export function readAllNotifications(req, res) {
  assertIds(req.params);
  res.json({ notifications: markNotificationsRead(req.params.userId, req.user) });
}
