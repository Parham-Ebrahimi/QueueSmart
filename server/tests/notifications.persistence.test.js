import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import config from '../src/config.js';
import { closeDatabase, getDatabase } from '../src/data/database.js';
import { addHistoryEntry, listHistoryForUser } from '../src/data/historyStore.js';
import { addNotification, listNotificationsForUser, resetNotifications } from '../src/data/notificationStore.js';
import { createService, resetServices } from '../src/data/serviceStore.js';
import { createUser, resetUsers } from '../src/data/userStore.js';
import { signToken } from '../src/utils/tokens.js';

const app = createApp();
const ava = { id: 'user-ava', email: 'ava@example.com', role: 'user' };
const admin = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
const avaToken = signToken(ava);
const adminToken = signToken(admin);

function as(token, method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

function notificationRow(userId) {
  return getDatabase().prepare('SELECT user_id, message, status, created_at FROM notifications WHERE user_id = ? ORDER BY rowid').all(userId);
}

describe('notification table constraints', () => {
  it('stores sent notices and marks them viewed', () => {
    resetUsers();
    resetNotifications();
    createUser({ id: ava.id, email: ava.email, passwordHash: 'x', role: 'user' });
    const item = addNotification({ userId: ava.id, title: 'Joined Help Desk', message: 'You are #1 in line.', event: 'joined' });

    expect(item).toMatchObject({ userId: ava.id, status: 'sent', read: false, message: 'You are #1 in line.' });
    expect(notificationRow(ava.id)[0]).toMatchObject({ user_id: ava.id, status: 'sent', message: 'You are #1 in line.' });
    expect(Date.parse(notificationRow(ava.id)[0].created_at)).not.toBeNaN();
  });

  it('rejects a missing user, empty message, or unknown status', () => {
    resetUsers();
    createUser({ id: ava.id, email: ava.email, passwordHash: 'x', role: 'user' });
    const insert = (row) => getDatabase().prepare(`INSERT INTO notifications (
        notification_id, user_id, message, created_at, status, title, type, event
      ) VALUES (?, ?, ?, ?, ?, ?, 'queue', 'joined')`).run(...row);

    expect(() => insert(['ntf_missing_user', 'usr_nobody', 'Hello', 'now', 'sent', 'Hi'])).toThrow();
    expect(() => insert(['ntf_blank', ava.id, '   ', 'now', 'sent', 'Hi'])).toThrow();
    expect(() => insert(['ntf_status', ava.id, 'Hello', 'now', 'queued', 'Hi'])).toThrow();
  });

  it('keeps history rows with the required visit fields', () => {
    resetUsers();
    createUser({ id: ava.id, email: ava.email, passwordHash: 'x', role: 'user' });
    addHistoryEntry({
      userId: ava.id,
      entryId: 'qe_1',
      serviceId: 'help-desk',
      serviceName: 'Help Desk',
      joinedAt: '2026-01-01T10:00:00.000Z',
      endedAt: '2026-01-01T10:05:00.000Z',
      outcome: 'served',
      position: 1,
    });
    expect(listHistoryForUser(ava.id)[0]).toMatchObject({ serviceName: 'Help Desk', outcome: 'served', position: 1 });
  });
});

describe('notification and history persistence', () => {
  let directory;
  let originalPath;

  afterEach(() => {
    closeDatabase();
    config.databasePath = originalPath;
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  it('keeps notices and visit history after reopening the database', async () => {
    directory = mkdtempSync(join(tmpdir(), 'queuesmart-notices-'));
    originalPath = config.databasePath;
    closeDatabase();
    config.databasePath = join(directory, 'notices.sqlite');

    resetUsers();
    createUser({ ...ava, passwordHash: 'x' });
    createUser({ ...admin, passwordHash: 'x' });
    createService({ id: 'help-desk', name: 'Help Desk', description: 'Tech support.', expectedDuration: 5, priority: 'high', location: 'Library' });

    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    await as(adminToken, 'post', '/api/queues/help-desk/serve-next');

    const beforeNotices = await as(avaToken, 'get', `/api/users/${ava.id}/notifications`);
    const beforeHistory = await as(avaToken, 'get', `/api/users/${ava.id}/history`);
    expect(beforeNotices.body.notifications.map(item => item.event)).toEqual(expect.arrayContaining(['joined', 'next-up', 'served']));
    expect(beforeNotices.body.notifications[0]).toMatchObject({ status: 'sent', read: false });
    expect(beforeHistory.body.history).toHaveLength(1);
    expect(beforeHistory.body.history[0]).toMatchObject({ serviceName: 'Help Desk', outcome: 'served' });

    closeDatabase();

    expect(listNotificationsForUser(ava.id).map(item => item.event)).toEqual(expect.arrayContaining(['joined', 'served']));
    expect(listHistoryForUser(ava.id)[0].outcome).toBe('served');

    const afterNotices = await as(avaToken, 'get', `/api/users/${ava.id}/notifications`);
    const marked = await as(avaToken, 'post', `/api/users/${ava.id}/notifications/read-all`);
    expect(afterNotices.status).toBe(200);
    expect(marked.body.notifications.every(item => item.status === 'viewed' && item.read)).toBe(true);

    closeDatabase();
    expect(listNotificationsForUser(ava.id).every(item => item.status === 'viewed')).toBe(true);
    expect((await as(avaToken, 'get', `/api/users/${ava.id}/history`)).body.history[0].outcome).toBe('served');
  });
});
