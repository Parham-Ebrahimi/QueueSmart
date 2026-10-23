import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { resetHistory } from '../src/data/historyStore.js';
import { resetNotifications } from '../src/data/notificationStore.js';
import { resetQueues } from '../src/data/queueStore.js';
import { createService, resetServices } from '../src/data/serviceStore.js';
import { createUser, resetUsers } from '../src/data/userStore.js';
import { signToken } from '../src/utils/tokens.js';

const app = createApp();
const admin = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
const ava = { id: 'user-ava', email: 'ava@example.com', role: 'user' };
const ben = { id: 'user-ben', email: 'ben@example.com', role: 'user' };
const adminToken = signToken(admin);
const avaToken = signToken(ava);
const benToken = signToken(ben);

function as(token, method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

beforeEach(() => {
  resetServices();
  resetQueues();
  resetHistory();
  resetNotifications();
  resetUsers();
  createService({ id: 'help-desk', name: 'Help Desk', description: 'Tech support.', expectedDuration: 5, priority: 'high', location: 'Library' });
  createUser({ id: admin.id, email: admin.email, passwordHash: 'x', role: 'admin' });
});

describe('GET /api/users/:userId/notifications', () => {
  it('requires authentication', async () => {
    const res = await request(app).get(`/api/users/${ava.id}/notifications`);
    expect(res.status).toBe(401);
  });

  it('returns the join notice after a user enters a queue', async () => {
    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    const res = await as(avaToken, 'get', `/api/users/${ava.id}/notifications`);

    expect(res.status).toBe(200);
    expect(res.body.notifications.map(item => item.event)).toEqual(expect.arrayContaining(['joined']));
    expect(res.body.notifications.find(item => item.event === 'joined')).toMatchObject({
      title: 'Joined Help Desk',
      message: 'You are #1 in line. Estimated wait is about 0 min.',
      read: false,
      serviceName: 'Help Desk',
    });
  });

  it('tells the first visitor they are next and the second they are almost ready', async () => {
    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    await as(benToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ben' });

    const avaNotes = (await as(avaToken, 'get', `/api/users/${ava.id}/notifications`)).body.notifications;
    const benNotes = (await as(benToken, 'get', `/api/users/${ben.id}/notifications`)).body.notifications;

    expect(avaNotes.map(item => item.event)).toEqual(expect.arrayContaining(['joined', 'next-up']));
    expect(benNotes.map(item => item.event)).toEqual(expect.arrayContaining(['joined', 'approaching-front']));
    expect(benNotes.find(item => item.event === 'approaching-front').title).toBe('Almost your turn');
  });

  it('notifies the person behind when the front of the line is served', async () => {
    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    await as(benToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ben' });
    await as(adminToken, 'post', '/api/queues/help-desk/serve-next');

    const benNotes = (await as(benToken, 'get', `/api/users/${ben.id}/notifications`)).body.notifications;
    expect(benNotes.map(item => item.event)).toEqual(expect.arrayContaining(['next-up']));
    expect(benNotes.find(item => item.event === 'next-up').title).toBe('You’re next!');
  });

  it('does not send a second next-up notice if the visitor is already at the front', async () => {
    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    const first = (await as(avaToken, 'get', `/api/users/${ava.id}/notifications`)).body.notifications.filter(item => item.event === 'next-up');
    await as(benToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ben' });
    const second = (await as(avaToken, 'get', `/api/users/${ava.id}/notifications`)).body.notifications.filter(item => item.event === 'next-up');
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  it("blocks users from reading someone else's notifications but lets administrators", async () => {
    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    expect((await as(benToken, 'get', `/api/users/${ava.id}/notifications`)).status).toBe(403);
    expect((await as(adminToken, 'get', `/api/users/${ava.id}/notifications`)).status).toBe(200);
  });

  it('notifies registered administrators when a visitor joins', async () => {
    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    const res = await as(adminToken, 'get', `/api/users/${admin.id}/notifications`);
    expect(res.body.notifications[0]).toMatchObject({
      event: 'visitor-joined',
      title: 'New visitor at Help Desk',
      message: 'Ava joined the queue (position #1).',
    });
  });

  it('rejects a malformed user ID', async () => {
    const res = await as(avaToken, 'get', '/api/users/bad%20id/notifications');
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('userId');
  });
});

describe('marking notifications read', () => {
  it('marks one notice as read', async () => {
    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    const { notifications } = (await as(avaToken, 'get', `/api/users/${ava.id}/notifications`)).body;
    const target = notifications.find(item => item.event === 'joined');

    const res = await as(avaToken, 'post', `/api/users/${ava.id}/notifications/${target.id}/read`);
    expect(res.status).toBe(200);
    expect(res.body.notification.read).toBe(true);
    expect((await as(avaToken, 'get', `/api/users/${ava.id}/notifications`)).body.notifications.find(item => item.id === target.id).read).toBe(true);
  });

  it('marks every notice as read', async () => {
    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    const res = await as(avaToken, 'post', `/api/users/${ava.id}/notifications/read-all`);
    expect(res.status).toBe(200);
    expect(res.body.notifications.every(item => item.read)).toBe(true);
  });

  it('returns 404 for an unknown notification', async () => {
    const res = await as(avaToken, 'post', `/api/users/${ava.id}/notifications/ntf_missing/read`);
    expect(res.status).toBe(404);
  });

  it("blocks users from updating someone else's notifications", async () => {
    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    const { notifications } = (await as(avaToken, 'get', `/api/users/${ava.id}/notifications`)).body;
    expect((await as(benToken, 'post', `/api/users/${ava.id}/notifications/${notifications[0].id}/read`)).status).toBe(403);
    expect((await as(benToken, 'post', `/api/users/${ava.id}/notifications/read-all`)).status).toBe(403);
  });

  it('rejects a malformed notification ID', async () => {
    const res = await as(avaToken, 'post', `/api/users/${ava.id}/notifications/bad!id/read`);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('notificationId');
  });
});

describe('queue outcomes write notifications', () => {
  it('records served, left, and removed visits', async () => {
    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    await as(adminToken, 'post', '/api/queues/help-desk/serve-next');
    expect((await as(avaToken, 'get', `/api/users/${ava.id}/notifications`)).body.notifications[0].event).toBe('served');

    await as(benToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ben' });
    await as(benToken, 'post', '/api/queues/help-desk/leave');
    expect((await as(benToken, 'get', `/api/users/${ben.id}/notifications`)).body.notifications[0].event).toBe('left');
  });

  it('records a removed visit when an administrator takes someone out of line', async () => {
    const { body } = await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    await as(adminToken, 'delete', `/api/queues/help-desk/entries/${body.entry.id}`);
    expect((await as(avaToken, 'get', `/api/users/${ava.id}/notifications`)).body.notifications[0].event).toBe('removed');
  });

  it('notifies a visitor who is moved up to the front', async () => {
    await as(avaToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ava' });
    const { body } = await as(benToken, 'post', '/api/queues/help-desk/join').send({ name: 'Ben' });
    await as(adminToken, 'post', `/api/queues/help-desk/entries/${body.entry.id}/move`).send({ direction: -1 });

    const notes = (await as(benToken, 'get', `/api/users/${ben.id}/notifications`)).body.notifications;
    expect(notes.map(item => item.event)).toEqual(expect.arrayContaining(['next-up']));
  });
});
