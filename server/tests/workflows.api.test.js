import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { resetHistory } from '../src/data/historyStore.js';
import { resetNotifications } from '../src/data/notificationStore.js';
import { resetQueues } from '../src/data/queueStore.js';
import { resetServices } from '../src/data/serviceStore.js';
import { resetUsers } from '../src/data/userStore.js';

const app = createApp();

function auth(token, method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

beforeEach(() => {
  resetUsers();
  resetServices();
  resetQueues();
  resetHistory();
  resetNotifications();
});

describe('end-to-end API workflow', () => {
  it('covers register, login, services, join, wait time, notifications, serve, and history', async () => {
    const registered = await request(app).post('/api/auth/register').send({
      email: 'ava@example.com',
      password: 'Password1',
      confirmPassword: 'Password1',
      role: 'user',
    });
    expect(registered.status).toBe(201);
    expect(registered.body.user.role).toBe('user');

    const staff = await request(app).post('/api/auth/register').send({
      email: 'staff@example.com',
      password: 'Password2',
      role: 'admin',
    });
    expect(staff.status).toBe(201);

    const login = await request(app).post('/api/auth/login').send({
      email: 'ava@example.com',
      password: 'Password1',
      role: 'user',
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));

    const avaToken = login.body.token;
    const adminToken = staff.body.token;
    const avaId = login.body.user.id;

    const created = await auth(adminToken, 'post', '/api/services').send({
      id: 'advising',
      name: 'Advising',
      description: 'Course planning.',
      expectedDuration: 10,
      priority: 'medium',
      location: 'Campus Center',
    });
    expect(created.status).toBe(201);

    const listed = await auth(avaToken, 'get', '/api/services');
    expect(listed.body.services).toHaveLength(1);
    expect(listed.body.services[0].name).toBe('Advising');

    const wait = await auth(avaToken, 'get', '/api/queues/advising/wait-time?position=2');
    expect(wait.status).toBe(200);
    expect(wait.body.estimatedWaitMinutes).toBe(10);

    const joined = await auth(avaToken, 'post', '/api/queues/advising/join').send({ name: 'Ava' });
    expect(joined.status).toBe(201);
    expect(joined.body.entry).toMatchObject({ position: 1, estimatedWaitMinutes: 0, status: 'waiting' });

    const queue = await auth(avaToken, 'get', '/api/queues/advising');
    expect(queue.body.queue.myEntry.position).toBe(1);
    expect(queue.body.queue.waitingCount).toBe(1);

    const notes = await auth(avaToken, 'get', `/api/users/${avaId}/notifications`);
    expect(notes.status).toBe(200);
    expect(notes.body.notifications.map(item => item.event)).toEqual(expect.arrayContaining(['joined', 'next-up']));

    const adminNotes = await auth(adminToken, 'get', `/api/users/${staff.body.user.id}/notifications`);
    expect(adminNotes.body.notifications[0].event).toBe('visitor-joined');

    const served = await auth(adminToken, 'post', '/api/queues/advising/serve-next');
    expect(served.status).toBe(200);
    expect(served.body.served.status).toBe('served');

    const history = await auth(avaToken, 'get', `/api/users/${avaId}/history`);
    expect(history.body.history).toHaveLength(1);
    expect(history.body.history[0]).toMatchObject({ serviceName: 'Advising', outcome: 'served' });

    const afterServe = await auth(avaToken, 'get', `/api/users/${avaId}/notifications`);
    expect(afterServe.body.notifications[0].event).toBe('served');

    const marked = await auth(avaToken, 'post', `/api/users/${avaId}/notifications/read-all`);
    expect(marked.body.notifications.every(item => item.read)).toBe(true);
  });

  it('lets a user leave and join another service after the first visit is recorded', async () => {
    const user = await request(app).post('/api/auth/register').send({
      email: 'ben@example.com',
      password: 'Password1',
      role: 'user',
    });
    const admin = await request(app).post('/api/auth/register').send({
      email: 'desk@example.com',
      password: 'Password2',
      role: 'admin',
    });
    await auth(admin.body.token, 'post', '/api/services').send({
      id: 'help-desk',
      name: 'Help Desk',
      description: 'Support.',
      expectedDuration: 5,
      priority: 'high',
    });
    await auth(admin.body.token, 'post', '/api/services').send({
      id: 'clinic',
      name: 'Clinic',
      description: 'Health.',
      expectedDuration: 15,
      priority: 'low',
    });

    const token = user.body.token;
    await auth(token, 'post', '/api/queues/help-desk/join').send({ name: 'Ben' });
    const left = await auth(token, 'post', '/api/queues/help-desk/leave');
    expect(left.body.entry.status).toBe('left');

    const second = await auth(token, 'post', '/api/queues/clinic/join').send({ name: 'Ben' });
    expect(second.status).toBe(201);

    const history = await auth(token, 'get', `/api/users/${user.body.user.id}/history`);
    expect(history.body.history.map(item => [item.serviceName, item.outcome])).toEqual([['Help Desk', 'left']]);
  });
});
