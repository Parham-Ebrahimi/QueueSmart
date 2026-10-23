import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { resetHistory } from '../src/data/historyStore.js';
import { resetNotifications } from '../src/data/notificationStore.js';
import { resetQueues } from '../src/data/queueStore.js';
import { createService, resetServices } from '../src/data/serviceStore.js';
import { signToken } from '../src/utils/tokens.js';

const app = createApp();
const adminToken = signToken({ id: 'admin-1', email: 'admin@example.com', role: 'admin' });
const members = ['ava', 'ben', 'cam', 'dee'].map(name => ({
  id: `user-${name}`,
  token: signToken({ id: `user-${name}`, email: `${name}@example.com`, role: 'user' }),
}));
const [ava, ben, cam, dee] = members;

function as(token, method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

function joinAs(member, body = {}, serviceId = 'help-desk') {
  return as(member.token, 'post', `/api/queues/${serviceId}/join`).send(body);
}

async function adminQueue(serviceId = 'help-desk') {
  return (await as(adminToken, 'get', `/api/queues/${serviceId}`)).body.queue;
}

beforeEach(() => {
  resetServices();
  resetQueues();
  resetHistory();
  resetNotifications();
  createService({ id: 'help-desk', name: 'Help Desk', description: 'Tech support.', expectedDuration: 5, priority: 'high' });
  createService({ id: 'advising', name: 'Advising', description: 'Course planning.', expectedDuration: 10, priority: 'medium' });
});

describe('joining a queue', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/queues/help-desk/join');
    expect(res.status).toBe(401);
  });

  it('only lets users join, not administrators', async () => {
    const res = await as(adminToken, 'post', '/api/queues/help-desk/join').send({});
    expect(res.status).toBe(403);
  });

  it('adds the user at the back of the line with a wait estimate', async () => {
    await joinAs(ava, { name: 'Ava' });
    const res = await joinAs(ben, { name: 'Ben' });

    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({
      serviceId: 'help-desk',
      userId: ben.id,
      name: 'Ben',
      status: 'waiting',
      priority: 'normal',
      position: 2,
      initialPosition: 2,
      estimatedWaitMinutes: 5,
    });
    expect(Date.parse(res.body.entry.joinedAt)).not.toBeNaN();
  });

  it('defaults the visitor name to the email name', async () => {
    const res = await joinAs(ava);
    expect(res.body.entry.name).toBe('ava');
  });

  it('rejects a user who is already waiting in any queue', async () => {
    await joinAs(ava);
    const again = await joinAs(ava, {}, 'advising');
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_IN_QUEUE');
  });

  it('rejects joining a closed service', async () => {
    await as(adminToken, 'put', '/api/services/help-desk').send({ isOpen: false });
    const res = await joinAs(ava);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SERVICE_CLOSED');
  });

  it('returns 404 for an unknown service', async () => {
    const res = await joinAs(ava, {}, 'nope');
    expect(res.status).toBe(404);
  });

  it.each([
    [{ priority: 'urgent' }, 'priority'],
    [{ name: 42 }, 'name'],
    [{ name: 'x'.repeat(81) }, 'name'],
  ])('rejects the invalid body %j', async (body, field) => {
    const res = await joinAs(ava, body);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty(field);
  });

  it('rejects a malformed service ID', async () => {
    const res = await joinAs(ava, {}, 'bad%20id');
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('serviceId');
  });
});

describe('queue ordering', () => {
  it('orders visitors by arrival time', async () => {
    for (const member of [ava, ben, cam]) await joinAs(member);
    const queue = await adminQueue();
    expect(queue.entries.map(entry => entry.userId)).toEqual([ava.id, ben.id, cam.id]);
    expect(queue.entries.map(entry => entry.position)).toEqual([1, 2, 3]);
    expect(queue.entries.map(entry => entry.estimatedWaitMinutes)).toEqual([0, 5, 10]);
  });

  it('puts high-priority visitors ahead of normal ones, keeping arrival order within a priority', async () => {
    await joinAs(ava);
    await joinAs(ben);
    const first = await joinAs(cam, { priority: 'high' });
    const second = await joinAs(dee, { priority: 'high' });

    expect(first.body.entry.position).toBe(1);
    expect(second.body.entry.position).toBe(2);
    expect((await adminQueue()).entries.map(entry => entry.userId)).toEqual([cam.id, dee.id, ava.id, ben.id]);
  });

  it('lets an administrator move a visitor up or down', async () => {
    for (const member of [ava, ben, cam]) await joinAs(member);
    const { entries } = await adminQueue();

    const moved = await as(adminToken, 'post', `/api/queues/help-desk/entries/${entries[2].id}/move`).send({ direction: -1 });
    expect(moved.status).toBe(200);
    expect(moved.body.queue.entries.map(entry => entry.userId)).toEqual([ava.id, cam.id, ben.id]);

    const blocked = await as(adminToken, 'post', `/api/queues/help-desk/entries/${entries[0].id}/move`).send({ direction: -1 });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('CANNOT_MOVE');

    const invalid = await as(adminToken, 'post', `/api/queues/help-desk/entries/${entries[0].id}/move`).send({ direction: 2 });
    expect(invalid.status).toBe(400);
  });
});

describe('viewing queues and position', () => {
  it('shows administrators every waiting visitor', async () => {
    await joinAs(ava);
    const res = await as(adminToken, 'get', '/api/queues/help-desk');
    expect(res.status).toBe(200);
    expect(res.body.queue).toMatchObject({ serviceId: 'help-desk', isOpen: true, waitingCount: 1, estimatedWaitMinutes: 5 });
    expect(res.body.queue.entries).toHaveLength(1);
    expect(res.body.queue.recentlyServed).toEqual([]);
  });

  it('shows users only the count and their own place', async () => {
    await joinAs(ava);
    await joinAs(ben);
    const res = await as(ben.token, 'get', '/api/queues/help-desk');
    expect(res.body.queue).not.toHaveProperty('entries');
    expect(res.body.queue.waitingCount).toBe(2);
    expect(res.body.queue.myEntry).toMatchObject({ userId: ben.id, position: 2 });

    const other = await as(cam.token, 'get', '/api/queues/help-desk');
    expect(other.body.queue.myEntry).toBeNull();
  });

  it('lists every service queue', async () => {
    await joinAs(ava, {}, 'advising');
    const res = await as(adminToken, 'get', '/api/queues');
    expect(res.body.queues.map(queue => [queue.serviceId, queue.waitingCount])).toEqual([['help-desk', 0], ['advising', 1]]);
  });

  it('tracks a user position as people ahead are served', async () => {
    await joinAs(ava);
    const { body } = await joinAs(ben);
    const path = `/api/queues/help-desk/entries/${body.entry.id}`;

    expect((await as(ben.token, 'get', path)).body.entry).toMatchObject({ status: 'waiting', position: 2 });
    await as(adminToken, 'post', '/api/queues/help-desk/serve-next');
    expect((await as(ben.token, 'get', path)).body.entry).toMatchObject({ status: 'waiting', position: 1, estimatedWaitMinutes: 0 });
    await as(adminToken, 'post', '/api/queues/help-desk/serve-next');
    expect((await as(ben.token, 'get', path)).body.entry).toMatchObject({ status: 'served', position: 0 });
  });

  it("hides another user's entry", async () => {
    const { body } = await joinAs(ava);
    const res = await as(ben.token, 'get', `/api/queues/help-desk/entries/${body.entry.id}`);
    expect(res.status).toBe(404);
  });
});

describe('leaving a queue', () => {
  it('removes the user and moves everyone behind them up', async () => {
    await joinAs(ava);
    await joinAs(ben);
    const res = await as(ava.token, 'post', '/api/queues/help-desk/leave');

    expect(res.status).toBe(200);
    expect(res.body.entry).toMatchObject({ userId: ava.id, status: 'left' });
    expect((await adminQueue()).entries.map(entry => [entry.userId, entry.position])).toEqual([[ben.id, 1]]);
  });

  it('lets the user join another queue after leaving', async () => {
    await joinAs(ava);
    await as(ava.token, 'post', '/api/queues/help-desk/leave');
    expect((await joinAs(ava, {}, 'advising')).status).toBe(201);
  });

  it('returns 404 when the user is not in that queue', async () => {
    const res = await as(ava.token, 'post', '/api/queues/help-desk/leave');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_IN_QUEUE');
  });
});

describe('serving and removing visitors', () => {
  it('serves the visitor at the front of the line', async () => {
    await joinAs(ava);
    await joinAs(ben);
    const res = await as(adminToken, 'post', '/api/queues/help-desk/serve-next');

    expect(res.status).toBe(200);
    expect(res.body.served).toMatchObject({ userId: ava.id, status: 'served' });
    expect(res.body.queue.entries.map(entry => entry.userId)).toEqual([ben.id]);
    expect(res.body.queue.recentlyServed.map(entry => entry.userId)).toEqual([ava.id]);
  });

  it('only lets administrators serve', async () => {
    await joinAs(ava);
    const res = await as(ben.token, 'post', '/api/queues/help-desk/serve-next');
    expect(res.status).toBe(403);
  });

  it('reports an empty queue', async () => {
    const res = await as(adminToken, 'post', '/api/queues/help-desk/serve-next');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('QUEUE_EMPTY');
  });

  it('removes a visitor from the line', async () => {
    const { body } = await joinAs(ava);
    const res = await as(adminToken, 'delete', `/api/queues/help-desk/entries/${body.entry.id}`);
    expect(res.status).toBe(200);
    expect(res.body.removed.status).toBe('removed');
    expect(res.body.queue.waitingCount).toBe(0);

    const again = await as(adminToken, 'delete', `/api/queues/help-desk/entries/${body.entry.id}`);
    expect(again.status).toBe(404);
  });
});

describe('participation history', () => {
  it('records the service, timestamps, and outcome of each visit', async () => {
    await joinAs(ava);
    await as(adminToken, 'post', '/api/queues/help-desk/serve-next');
    await joinAs(ava, {}, 'advising');
    await as(ava.token, 'post', '/api/queues/advising/leave');

    const res = await as(ava.token, 'get', `/api/users/${ava.id}/history`);
    expect(res.status).toBe(200);
    expect(res.body.history.map(entry => [entry.serviceName, entry.outcome])).toEqual([['Advising', 'left'], ['Help Desk', 'served']]);
    for (const entry of res.body.history) {
      expect(entry).toMatchObject({ userId: ava.id, position: 1 });
      expect(Date.parse(entry.endedAt)).toBeGreaterThanOrEqual(Date.parse(entry.joinedAt));
    }
  });

  it('records visitors removed by an administrator or by deleting the service', async () => {
    const { body } = await joinAs(ava);
    await joinAs(ben);
    await as(adminToken, 'delete', `/api/queues/help-desk/entries/${body.entry.id}`);
    await as(adminToken, 'delete', '/api/services/help-desk');

    expect((await as(ava.token, 'get', `/api/users/${ava.id}/history`)).body.history[0].outcome).toBe('removed');
    expect((await as(ben.token, 'get', `/api/users/${ben.id}/history`)).body.history[0]).toMatchObject({ serviceName: 'Help Desk', outcome: 'removed' });
  });

  it('starts empty and does not record a visit that is still waiting', async () => {
    await joinAs(ava);
    expect((await as(ava.token, 'get', `/api/users/${ava.id}/history`)).body.history).toEqual([]);
  });

  it("blocks users from reading someone else's history but lets administrators", async () => {
    expect((await as(ben.token, 'get', `/api/users/${ava.id}/history`)).status).toBe(403);
    expect((await as(adminToken, 'get', `/api/users/${ava.id}/history`)).status).toBe(200);
  });
});
