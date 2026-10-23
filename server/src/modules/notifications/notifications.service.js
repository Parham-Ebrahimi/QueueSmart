import { addNotification, findNotification, hasNotificationEvent, listNotificationsForUser, markAllNotificationsRead, updateNotification } from '../../data/notificationStore.js';
import { listUsers } from '../../data/userStore.js';
import ApiError from '../../utils/ApiError.js';

function logNotification(item) {
  if (process.env.NODE_ENV === 'test') return;
  console.log(`[notification] ${item.event} -> ${item.userId}: ${item.title}`);
}

function writeNotification(input) {
  const item = addNotification(input);
  logNotification(item);
  return item;
}

function writeOnce(userId, entryId, event, input) {
  if (hasNotificationEvent(userId, entryId, event)) return null;
  return writeNotification({ userId, entryId, event, ...input });
}

function serviceLocation(service) {
  return service.location || service.name;
}

export function getNotifications(userId, viewer) {
  if (viewer.role !== 'admin' && viewer.id !== userId) {
    throw ApiError.forbidden('You can only view your own notifications.');
  }
  return listNotificationsForUser(userId);
}

export function markNotificationRead(userId, notificationId, viewer) {
  if (viewer.role !== 'admin' && viewer.id !== userId) {
    throw ApiError.forbidden('You can only update your own notifications.');
  }
  const existing = findNotification(userId, notificationId);
  if (!existing) throw ApiError.notFound('Notification not found.');
  return updateNotification(userId, notificationId, { read: true });
}

export function markNotificationsRead(userId, viewer) {
  if (viewer.role !== 'admin' && viewer.id !== userId) {
    throw ApiError.forbidden('You can only update your own notifications.');
  }
  return markAllNotificationsRead(userId);
}

// Sent to the visitor after a successful join.
export function notifyJoined(user, entry, service) {
  return writeNotification({
    userId: user.id,
    type: 'queue',
    event: 'joined',
    title: `Joined ${service.name}`,
    message: `You are #${entry.position} in line. Estimated wait is about ${entry.estimatedWaitMinutes} min.`,
    serviceId: service.id,
    serviceName: service.name,
    entryId: entry.id,
    position: entry.position,
  });
}

// Administrators who have registered get a notice when someone joins.
export function notifyAdminsOfJoin(entry, service) {
  const created = [];
  for (const admin of listUsers().filter(user => user.role === 'admin')) {
    created.push(writeNotification({
      userId: admin.id,
      type: 'queue',
      event: 'visitor-joined',
      title: `New visitor at ${service.name}`,
      message: `${entry.name} joined the queue (position #${entry.position}).`,
      serviceId: service.id,
      serviceName: service.name,
      entryId: entry.id,
      position: entry.position,
    }));
  }
  return created;
}

// Position 2 = almost ready, position 1 = you are next. Each fires at most once per visit.
export function notifyApproachingFront(waiting, service) {
  const created = [];
  for (const entry of waiting) {
    if (entry.position === 1) {
      const item = writeOnce(entry.userId, entry.id, 'next-up', {
        type: 'status',
        title: 'You’re next!',
        message: `Please head to ${serviceLocation(service)} now.`,
        serviceId: service.id,
        serviceName: service.name,
        position: 1,
      });
      if (item) created.push(item);
    } else if (entry.position === 2) {
      const item = writeOnce(entry.userId, entry.id, 'approaching-front', {
        type: 'status',
        title: 'Almost your turn',
        message: `1 person is ahead of you at ${service.name}.`,
        serviceId: service.id,
        serviceName: service.name,
        position: 2,
      });
      if (item) created.push(item);
    }
  }
  return created;
}

export function notifyOutcome(entry, service, outcome) {
  const copy = {
    served: {
      type: 'status',
      title: `You’ve been served at ${service.name}`,
      message: 'Thanks for visiting. This queue has been added to your history.',
    },
    left: {
      type: 'status',
      title: `Left ${service.name}`,
      message: 'Your place in line was released. You can join another service any time.',
    },
    removed: {
      type: 'status',
      title: `Removed from ${service.name}`,
      message: 'An administrator removed you from this queue. You can join another service.',
    },
  }[outcome];
  if (!copy) return null;
  return writeNotification({
    userId: entry.userId,
    event: outcome,
    serviceId: service.id,
    serviceName: service.name,
    entryId: entry.id,
    position: 0,
    ...copy,
  });
}
