import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import config from '../src/config.js';
import { authenticate, requireRole } from '../src/middleware/authenticate.js';
import { errorHandler, notFound } from '../src/middleware/errorHandler.js';
import ApiError from '../src/utils/ApiError.js';
import { signToken } from '../src/utils/tokens.js';

// A small app that uses the shared middleware the same way feature routes will.
function createProtectedApp() {
  const app = express();
  app.get('/admin-only', authenticate, requireRole('admin'), (req, res) => res.json({ ok: true, user: req.user }));
  app.get('/members', authenticate, requireRole('user', 'admin'), (req, res) => res.json({ ok: true }));
  app.get('/no-auth-first', requireRole('admin'), (req, res) => res.json({ ok: true }));
  app.get('/boom', () => {
    throw new Error('database password is hunter2');
  });
  app.get('/async-boom', async () => {
    throw ApiError.conflict('Already there.');
  });
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

const protectedApp = createProtectedApp();
const userToken = signToken({ id: 'usr_1', email: 'member@example.com', role: 'user' });
const adminToken = signToken({ id: 'usr_2', email: 'staff@example.com', role: 'admin' });

describe('authenticate', () => {
  it('requires a token', async () => {
    const res = await request(protectedApp).get('/members');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' } });
  });

  it.each(['Token abc', 'Bearer', 'Bearer ', 'abc.def.ghi'])('rejects the malformed header %j', async header => {
    const res = await request(protectedApp).get('/members').set('Authorization', header);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a token signed with another secret', async () => {
    const forged = jwt.sign({ email: 'staff@example.com', role: 'admin' }, 'not-the-secret', { subject: 'usr_2' });
    const res = await request(protectedApp).get('/members').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign({ email: 'member@example.com', role: 'user', exp: Math.floor(Date.now() / 1000) - 60 }, config.jwtSecret, { subject: 'usr_1' });
    const res = await request(protectedApp).get('/members').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a token with an unknown role', async () => {
    const token = jwt.sign({ email: 'member@example.com', role: 'superuser' }, config.jwtSecret, { subject: 'usr_1' });
    const res = await request(protectedApp).get('/members').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('requireRole', () => {
  it('lets an administrator reach an admin-only route', async () => {
    const res = await request(protectedApp).get('/admin-only').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'usr_2', email: 'staff@example.com', role: 'admin' });
  });

  it('blocks a regular user from an admin-only route', async () => {
    const res = await request(protectedApp).get('/admin-only').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: 'This action requires the Administrator role.' } });
  });

  it('allows any of several roles', async () => {
    const asUser = await request(protectedApp).get('/members').set('Authorization', `Bearer ${userToken}`);
    const asAdmin = await request(protectedApp).get('/members').set('Authorization', `Bearer ${adminToken}`);
    expect(asUser.status).toBe(200);
    expect(asAdmin.status).toBe(200);
  });

  it('returns 401 for anonymous requests before checking the role', async () => {
    const res = await request(protectedApp).get('/admin-only');
    expect(res.status).toBe(401);
  });

  it('returns 401 when used without authenticate', async () => {
    const res = await request(protectedApp).get('/no-auth-first');
    expect(res.status).toBe(401);
  });
});

describe('error handling', () => {
  it('hides unexpected error details behind a generic 500', async () => {
    const res = await request(protectedApp).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our end. Please try again.' } });
  });

  it('formats ApiErrors thrown from async handlers', async () => {
    const res = await request(protectedApp).get('/async-boom');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'CONFLICT', message: 'Already there.' } });
  });

  it('returns 404 in the shared format for unknown routes', async () => {
    const res = await request(createApp()).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'No route matches GET /api/does-not-exist.' } });
  });

  it('returns 404 for the wrong method on an auth route', async () => {
    const res = await request(createApp()).get('/api/auth/login');
    expect(res.status).toBe(404);
  });

  it('rejects malformed JSON', async () => {
    const res = await request(createApp()).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": "a@b.co",');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } });
  });

  it('rejects oversized request bodies', async () => {
    const res = await request(createApp()).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(20_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('ApiError', () => {
  it('omits details when there are none', () => {
    expect(ApiError.notFound().toJSON()).toEqual({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } });
    expect(ApiError.validation({}).toJSON()).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'Some fields need your attention.' } });
  });

  it('uses friendly defaults for 401 and 403', () => {
    expect(ApiError.unauthorized()).toMatchObject({ status: 401, code: 'UNAUTHORIZED', message: 'Sign in to continue.' });
    expect(ApiError.forbidden()).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'You do not have permission to do that.' });
  });
});
