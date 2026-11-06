import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { getDatabase } from '../src/data/database.js';
import { resetHistory } from '../src/data/historyStore.js';
import { resetNotifications } from '../src/data/notificationStore.js';
import { resetQueues } from '../src/data/queueStore.js';
import { createService, resetServices } from '../src/data/serviceStore.js';
import { createUser, resetUsers } from '../src/data/userStore.js';
import { signToken } from '../src/utils/tokens.js';

const app = createApp();
const adminToken = signToken({ id: 'admin-1', email: 'admin@example.com', role: 'admin' });
const members = ['ava', 'ben', 'cam'].map(name => ({
  id: `user-${name}`,
  email: `${name}@example.com`,
  token: signToken({ id: `user-${name}`, email: `${name}@example.com`, role: 'user' }),
}));
const [ava, ben, cam] = members;

function as(token, method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

function joinAs(member, serviceId = 'help-desk') {
  return as(member.token, 'post', `/api/queues/${serviceId}/join`).send({});
}

function queueRow(serviceId) {
  return getDatabase().prepare('SELECT queue_id, service_id, status FROM queues WHERE service_id = ?').get(serviceId);
}

function entryRows() {
  return getDatabase().prepare('SELECT entry_id, queue_id, user_id, status, position, initial_position, joined_at, ended_at FROM queue_entries ORDER BY rowid').all();
}

function insertEntry(overrides = {}) {
  const row = { entry_id: 'qe_manual', queue_id: 'q_help-desk', user_id: ava.id, visitor_name: 'Ava', status: 'waiting', position: 1, initial_position: 1, joined_at: new Date().toISOString(), ended_at: null, ...overrides };
  getDatabase().prepare(`INSERT INTO queue_entries (entry_id, queue_id, user_id, visitor_name, status, position, initial_position, joined_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...Object.values(row));
}

beforeEach(() => {
  resetServices();
  resetQueues();
  resetHistory();
  resetNotifications();
  resetUsers();
  for (const member of members) createUser({ id: member.id, email: member.email, passwordHash: 'x', role: 'user' });
  createService({ id: 'help-desk', name: 'Help Desk', description: 'Tech support.', expectedDuration: 5, priority: 'high' });
});

describe('queue table', () => {
  it('creates one queue for each new service', async () => {
    expect(queueRow('help-desk')).toEqual({ queue_id: 'q_help-desk', service_id: 'help-desk', status: 'open' });

    await as(adminToken, 'post', '/api/services').send({ id: 'advising', name: 'Advising', description: 'Plans.', expectedDuration: 10, priority: 'low', isOpen: false });
    expect(queueRow('advising')).toEqual({ queue_id: 'q_advising', service_id: 'advising', status: 'closed' });
  });

  it('keeps the queue status in step with the service', async () => {
    await as(adminToken, 'put', '/api/services/help-desk').send({ isOpen: false });
    expect(queueRow('help-desk').status).toBe('closed');
    await as(adminToken, 'put', '/api/services/help-desk').send({ isOpen: true });
    expect(queueRow('help-desk').status).toBe('open');
  });

  it('allows only one queue per service', () => {
    expect(() => getDatabase().prepare("INSERT INTO queues (queue_id, service_id, status, created_at, updated_at) VALUES ('q_other', 'help-desk', 'open', 'now', 'now')").run())
      .toThrow(/UNIQUE/);
  });

  it('removes the queue and its entries with the service but keeps history', async () => {
    await joinAs(ava);
    await as(adminToken, 'delete', '/api/services/help-desk');

    expect(queueRow('help-desk')).toBeUndefined();
    expect(entryRows()).toEqual([]);
    expect(getDatabase().prepare('SELECT user_id, service_name, outcome FROM queue_history').all())
      .toEqual([{ user_id: ava.id, service_name: 'Help Desk', outcome: 'removed' }]);
  });
});

describe('queue entry table', () => {
  it('stores the queue, user, status, position, and join time when a user joins', async () => {
    const res = await joinAs(ava);
    const [row] = entryRows();

    expect(row).toMatchObject({
      entry_id: res.body.entry.id,
      queue_id: 'q_help-desk',
      user_id: ava.id,
      status: 'waiting',
      position: 1,
      initial_position: 1,
      joined_at: res.body.entry.joinedAt,
      ended_at: null,
    });
    expect(res.body.entry).toMatchObject({ queueId: 'q_help-desk', serviceId: 'help-desk', email: ava.email });
  });

  it('keeps stored positions in order as people join, leave, and are served', async () => {
    for (const member of members) await joinAs(member);
    expect(entryRows().map(row => [row.user_id, row.position])).toEqual([[ava.id, 1], [ben.id, 2], [cam.id, 3]]);

    await as(ben.token, 'post', '/api/queues/help-desk/leave');
    expect(entryRows().map(row => [row.user_id, row.status, row.position])).toEqual([[ava.id, 'waiting', 1], [ben.id, 'left', null], [cam.id, 'waiting', 2]]);

    await as(adminToken, 'post', '/api/queues/help-desk/serve-next');
    const rows = entryRows();
    expect(rows.map(row => [row.user_id, row.status, row.position])).toEqual([[ava.id, 'served', null], [ben.id, 'left', null], [cam.id, 'waiting', 1]]);
    expect(rows[0].ended_at).not.toBeNull();
  });

  it('stores high-priority entries ahead of normal ones', async () => {
    await joinAs(ava);
    await as(ben.token, 'post', '/api/queues/help-desk/join').send({ priority: 'high' });
    expect(entryRows().map(row => [row.user_id, row.position])).toEqual([[ava.id, 2], [ben.id, 1]]);
  });

  it('stores an administrator move as swapped positions', async () => {
    await joinAs(ava);
    const { body } = await joinAs(ben);
    await as(adminToken, 'post', `/api/queues/help-desk/entries/${body.entry.id}/move`).send({ direction: -1 });
    expect(entryRows().map(row => [row.user_id, row.position])).toEqual([[ava.id, 2], [ben.id, 1]]);
  });

  it('lets a user wait in only one queue at a time', () => {
    insertEntry();
    expect(() => insertEntry({ entry_id: 'qe_second', position: 2 })).toThrow(/UNIQUE/);
  });

  it('rejects entries for unknown users or queues', () => {
    expect(() => insertEntry({ user_id: 'user-ghost' })).toThrow(/FOREIGN KEY/);
    expect(() => insertEntry({ queue_id: 'q_missing' })).toThrow(/FOREIGN KEY/);
  });

  it('rejects an invalid status or a waiting entry without a position', () => {
    expect(() => insertEntry({ status: 'lost' })).toThrow(/CHECK/);
    expect(() => insertEntry({ position: null })).toThrow(/CHECK/);
    expect(() => insertEntry({ status: 'served', position: 1, ended_at: new Date().toISOString() })).toThrow(/CHECK/);
  });

  it("deletes a user's entries when the account is deleted", async () => {
    await joinAs(ava);
    await joinAs(ben);
    getDatabase().prepare('DELETE FROM user_credentials WHERE id = ?').run(ava.id);
    expect(entryRows().map(row => row.user_id)).toEqual([ben.id]);
  });

  it('rejects a join from a token whose account no longer exists', async () => {
    const ghost = signToken({ id: 'user-ghost', email: 'ghost@example.com', role: 'user' });
    const res = await as(ghost, 'post', '/api/queues/help-desk/join').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
    expect(entryRows()).toEqual([]);
  });
});

describe('queue persistence', () => {
  it('keeps queues, entries, and history across a backend restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'queuesmart-queues-'));
    const environment = { ...process.env, NODE_ENV: 'development', DATABASE_PATH: join(directory, 'queues.sqlite') };
    const modules = ['app', 'utils/tokens', 'data/userStore', 'data/serviceStore', 'data/database']
      .map(name => JSON.stringify(new URL(`../src/${name}.js`, import.meta.url).href));

    // Each run starts a fresh backend process against the same database file.
    function runBackend(steps) {
      const script = `import { createApp } from ${modules[0]};
      import { signToken } from ${modules[1]};
      import { createUser } from ${modules[2]};
      import { createService } from ${modules[3]};
      import { closeDatabase } from ${modules[4]};
      const server = createApp().listen(0);
      await new Promise(resolve => server.once('listening', resolve));
      const base = 'http://127.0.0.1:' + server.address().port + '/api';
      const user = { id: 'user-ava', email: 'ava@example.com', role: 'user' };
      const call = async (method, path, role = 'user') => {
        const token = signToken(role === 'admin' ? { id: 'admin-1', email: 'admin@example.com', role: 'admin' } : user);
        const response = await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + token } });
        return response.json();
      };
      try {
        ${steps}
      } finally {
        server.close();
        closeDatabase();
      }`;
      // The backend may log other lines first; the result is always the last line.
      const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: environment, encoding: 'utf8' });
      return JSON.parse(output.trim().split('\n').at(-1));
    }

    try {
      const joined = runBackend(`createUser({ id: user.id, email: user.email, passwordHash: 'x', role: 'user' });
        createService({ id: 'help-desk', name: 'Help Desk', description: 'Tech support.', expectedDuration: 5, priority: 'high' });
        process.stdout.write(JSON.stringify(await call('POST', '/queues/help-desk/join')));`);
      expect(joined.entry.position).toBe(1);

      const afterRestart = runBackend(`process.stdout.write(JSON.stringify(await call('GET', '/queues/help-desk')));`);
      expect(afterRestart.queue.myEntry).toMatchObject({ id: joined.entry.id, status: 'waiting', position: 1 });

      const history = runBackend(`await call('POST', '/queues/help-desk/serve-next', 'admin');
        process.stdout.write(JSON.stringify(await call('GET', '/users/user-ava/history')));`);
      expect(history.history).toMatchObject([{ entryId: joined.entry.id, outcome: 'served' }]);

      const historyAfterRestart = runBackend(`process.stdout.write(JSON.stringify(await call('GET', '/users/user-ava/history')));`);
      expect(historyAfterRestart.history).toEqual(history.history);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
