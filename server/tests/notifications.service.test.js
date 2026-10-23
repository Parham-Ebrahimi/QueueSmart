import { describe, expect, it, beforeEach } from 'vitest';
import { addNotification, hasNotificationEvent, listNotificationsForUser, resetNotifications } from '../src/data/notificationStore.js';
import { createService, resetServices } from '../src/data/serviceStore.js';
import { createUser, resetUsers } from '../src/data/userStore.js';
import { notifyAdminsOfJoin, notifyApproachingFront, notifyJoined, notifyOutcome } from '../src/modules/notifications/notifications.service.js';

const service = {
  id: 'help-desk',
  name: 'Help Desk',
  location: 'Library · First floor',
  expectedDuration: 5,
};

const entry = {
  id: 'qe_ava',
  userId: 'user-ava',
  name: 'Ava',
  position: 3,
  estimatedWaitMinutes: 10,
};

beforeEach(() => {
  resetNotifications();
  resetServices();
  resetUsers();
  createService(service);
});

describe('notifyJoined', () => {
  it('records the service, place in line, and wait estimate', () => {
    const item = notifyJoined({ id: 'user-ava' }, entry, service);

    expect(item).toMatchObject({
      userId: 'user-ava',
      type: 'queue',
      event: 'joined',
      title: 'Joined Help Desk',
      message: 'You are #3 in line. Estimated wait is about 10 min.',
      serviceId: 'help-desk',
      serviceName: 'Help Desk',
      entryId: 'qe_ava',
      position: 3,
      read: false,
    });
    expect(item.id).toMatch(/^ntf_/);
    expect(Date.parse(item.createdAt)).not.toBeNaN();
    expect(listNotificationsForUser('user-ava')).toHaveLength(1);
  });
});

describe('notifyApproachingFront', () => {
  it('notifies position 2 that they are almost ready', () => {
    const created = notifyApproachingFront([{ ...entry, position: 2 }], service);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      userId: 'user-ava',
      event: 'approaching-front',
      title: 'Almost your turn',
      message: '1 person is ahead of you at Help Desk.',
      position: 2,
    });
  });

  it('notifies position 1 that they are next', () => {
    const created = notifyApproachingFront([{ ...entry, position: 1 }], service);
    expect(created[0]).toMatchObject({
      event: 'next-up',
      title: 'You’re next!',
      message: 'Please head to Library · First floor now.',
      position: 1,
    });
  });

  it('falls back to the service name when there is no location', () => {
    const created = notifyApproachingFront([{ ...entry, position: 1 }], { ...service, location: '' });
    expect(created[0].message).toBe('Please head to Help Desk now.');
  });

  it('does not notify people further back in line', () => {
    expect(notifyApproachingFront([{ ...entry, position: 3 }], service)).toEqual([]);
  });

  it('only sends each front-of-line notice once per visit', () => {
    notifyApproachingFront([{ ...entry, position: 2 }], service);
    notifyApproachingFront([{ ...entry, position: 2 }], service);
    notifyApproachingFront([{ ...entry, position: 1 }], service);
    notifyApproachingFront([{ ...entry, position: 1 }], service);

    const events = listNotificationsForUser('user-ava').map(item => item.event);
    expect(events).toEqual(['next-up', 'approaching-front']);
    expect(hasNotificationEvent('user-ava', 'qe_ava', 'approaching-front')).toBe(true);
  });
});

describe('notifyOutcome', () => {
  it.each([
    ['served', 'You’ve been served at Help Desk'],
    ['left', 'Left Help Desk'],
    ['removed', 'Removed from Help Desk'],
  ])('records a %s visit', (outcome, title) => {
    const item = notifyOutcome(entry, service, outcome);
    expect(item).toMatchObject({ userId: 'user-ava', event: outcome, title, type: 'status' });
  });

  it('ignores an unknown outcome', () => {
    expect(notifyOutcome(entry, service, 'skipped')).toBeNull();
    expect(listNotificationsForUser('user-ava')).toEqual([]);
  });
});

describe('notifyAdminsOfJoin', () => {
  it('writes a visitor-joined notice for every administrator account', () => {
    createUser({ email: 'staff@example.com', passwordHash: 'x', role: 'admin' });
    createUser({ email: 'other@example.com', passwordHash: 'x', role: 'admin' });
    createUser({ email: 'member@example.com', passwordHash: 'x', role: 'user' });

    const created = notifyAdminsOfJoin(entry, service);
    expect(created).toHaveLength(2);
    expect(created.every(item => item.event === 'visitor-joined')).toBe(true);
    expect(listNotificationsForUser(created[0].userId)[0].message).toBe('Ava joined the queue (position #3).');
    expect(listNotificationsForUser(created[0].userId)[0].title).toBe('New visitor at Help Desk');
  });

  it('does nothing when no administrators are registered', () => {
    expect(notifyAdminsOfJoin(entry, service)).toEqual([]);
  });
});

describe('notification store', () => {
  it('keeps the newest notice first and can mark one as read', async () => {
    const first = addNotification({ userId: 'user-ava', title: 'First', event: 'joined', entryId: 'qe_1' });
    const second = addNotification({ userId: 'user-ava', title: 'Second', event: 'joined', entryId: 'qe_2' });
    expect(listNotificationsForUser('user-ava').map(item => item.id)).toEqual([second.id, first.id]);
    expect(listNotificationsForUser('nobody')).toEqual([]);
  });
});
