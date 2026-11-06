import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import config from '../src/config.js';
import { closeDatabase, getDatabase } from '../src/data/database.js';
import { getProfile, resetUsers } from '../src/data/userStore.js';

const app = createApp();
const account = { fullName: 'Taylor Morgan', email: 'taylor@example.com', password: 'Password1', role: 'user' };
const auth = (token, method, path) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

beforeEach(() => resetUsers());

describe('stored accounts and profiles', () => {
  it('stores a hash and a profile linked to the registered user', async () => {
    const res = await request(app).post('/api/auth/register').send(account);
    expect(res.status).toBe(201);
    const row = getDatabase().prepare('SELECT password_hash, email FROM user_credentials WHERE id = ?').get(res.body.user.id);
    expect(row.password_hash).not.toBe(account.password);
    expect(row.password_hash).toMatch(/^\$2/);
    expect(getProfile(res.body.user.id)).toMatchObject({ fullName: account.fullName, email: account.email });
    expect(JSON.stringify(res.body)).not.toContain(row.password_hash);
  });

  it('rejects duplicate emails at the database level regardless of case', async () => {
    await request(app).post('/api/auth/register').send(account);
    expect(() => getDatabase().prepare('INSERT INTO user_credentials (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run('other', 'TAYLOR@example.com', 'hash', 'user', new Date().toISOString())).toThrow();
  });

  it('enforces profile foreign keys and required fields', async () => {
    expect(() => getDatabase().prepare('INSERT INTO user_profiles (user_id, full_name) VALUES (?, ?)').run('missing', 'Someone')).toThrow();
    expect(() => getDatabase().prepare('INSERT INTO user_credentials (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run('bad', 'invalid@example.com', 'hash', 'owner', new Date().toISOString())).toThrow();
  });

  it('reads and updates the signed-in profile', async () => {
    const created = await request(app).post('/api/auth/register').send(account);
    const before = await auth(created.body.token, 'get', '/api/auth/profile');
    expect(before.body.profile).toMatchObject({ userId: created.body.user.id, fullName: account.fullName });

    const changed = await auth(created.body.token, 'patch', '/api/auth/profile').send({ fullName: 'Taylor M', email: 'taylor.new@example.com', contact: '555-0100' });
    expect(changed.status).toBe(200);
    expect(changed.body.profile).toMatchObject({ fullName: 'Taylor M', email: 'taylor.new@example.com', contact: '555-0100' });
    expect(changed.body.user.email).toBe('taylor.new@example.com');
    expect(getProfile(created.body.user.id).email).toBe('taylor.new@example.com');
    const login = await request(app).post('/api/auth/login').send({ email: 'taylor.new@example.com', password: account.password });
    expect(login.status).toBe(200);
  });

  it('rejects profile updates that use another account email', async () => {
    const first = await request(app).post('/api/auth/register').send(account);
    await request(app).post('/api/auth/register').send({ ...account, email: 'second@example.com' });
    const res = await auth(first.body.token, 'patch', '/api/auth/profile').send({ fullName: 'Changed', email: 'SECOND@example.com' });
    expect(res.status).toBe(409);
    expect(getProfile(first.body.user.id).fullName).toBe(account.fullName);
  });

  it('validates profile fields and authentication', async () => {
    const created = await request(app).post('/api/auth/register').send(account);
    expect((await request(app).get('/api/auth/profile')).status).toBe(401);
    const res = await auth(created.body.token, 'patch', '/api/auth/profile').send({ fullName: '', email: 'bad', contact: 'x'.repeat(101) });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('fullName');
    expect(res.body.error.details).toHaveProperty('email');
    expect(res.body.error.details).toHaveProperty('contact');
  });

  it('changes the password only after verifying the current one', async () => {
    const created = await request(app).post('/api/auth/register').send(account);
    const wrong = await auth(created.body.token, 'post', '/api/auth/change-password').send({ currentPassword: 'WrongPassword1', newPassword: 'AnotherPassword1', confirmPassword: 'AnotherPassword1' });
    expect(wrong.status).toBe(401);
    const changed = await auth(created.body.token, 'post', '/api/auth/change-password').send({ currentPassword: account.password, newPassword: 'AnotherPassword1', confirmPassword: 'AnotherPassword1' });
    expect(changed.status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: account.email, password: account.password })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: account.email, password: 'AnotherPassword1' })).status).toBe(200);
  });

  it('validates new passwords and full names', async () => {
    const invalid = await request(app).post('/api/auth/register').send({ ...account, fullName: 12 });
    expect(invalid.status).toBe(400);
    const created = await request(app).post('/api/auth/register').send(account);
    const res = await auth(created.body.token, 'post', '/api/auth/change-password').send({ currentPassword: account.password, newPassword: 'short', confirmPassword: 'other' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('newPassword');
    expect(res.body.error.details).toHaveProperty('confirmPassword');
  });
});

describe('database persistence', () => {
  let directory;
  let originalPath;

  afterEach(() => {
    closeDatabase();
    config.databasePath = originalPath;
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  it('keeps accounts and profiles after reopening the database', async () => {
    directory = mkdtempSync(join(tmpdir(), 'queuesmart-accounts-'));
    originalPath = config.databasePath;
    closeDatabase();
    config.databasePath = join(directory, 'accounts.sqlite');
    const created = await request(app).post('/api/auth/register').send(account);
    expect(created.status).toBe(201);
    closeDatabase();
    expect(getProfile(created.body.user.id).fullName).toBe(account.fullName);
    const login = await request(app).post('/api/auth/login').send({ email: account.email, password: account.password });
    expect(login.status).toBe(200);
  });
});
