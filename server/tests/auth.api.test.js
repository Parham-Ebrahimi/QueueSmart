import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import config from '../src/config.js';
import { resetUsers } from '../src/data/userStore.js';

const app = createApp();
const member = { email: 'member@example.com', password: 'Password1', role: 'user' };
const staff = { email: 'staff@example.com', password: 'Password2', role: 'admin' };

function register(body) {
  return request(app).post('/api/auth/register').send(body);
}

function login(body) {
  return request(app).post('/api/auth/login').send(body);
}

beforeEach(async () => {
  resetUsers();
  await register(member);
  await register(staff);
});

describe('POST /api/auth/register', () => {
  it('creates a user account and returns a session', async () => {
    const res = await register({ email: ' New.Student@Example.com ', password: 'Password1', confirmPassword: 'Password1' });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: expect.stringMatching(/^usr_/), email: 'new.student@example.com', role: 'user', createdAt: expect.any(String) });
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('never returns the password or its hash', async () => {
    const res = await register({ email: 'safe@example.com', password: 'Password1' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('creates an administrator account when role is admin', async () => {
    const res = await register({ email: 'manager@example.com', password: 'Password1', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('admin');
    expect(jwt.verify(res.body.token, config.jwtSecret).role).toBe('admin');
  });

  it('lets the new account sign in right away', async () => {
    await register({ email: 'fresh@example.com', password: 'Password1', role: 'admin' });
    const res = await login({ email: 'fresh@example.com', password: 'Password1', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('fresh@example.com');
  });

  it('rejects an email that is already registered, ignoring case', async () => {
    const res = await register({ email: member.email.toUpperCase(), password: 'Password1' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.', details: { email: 'An account with this email already exists.' } } });
  });

  it('returns field errors in the shared error format', async () => {
    const res = await register({ email: 'bad-email', password: 'short', confirmPassword: 'different', role: 'owner' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toEqual(expect.any(String));
    expect(res.body.error.details).toEqual({
      email: 'Enter a valid email address.',
      password: 'Use at least 8 characters.',
      confirmPassword: 'Passwords do not match.',
      role: 'Role must be "user" or "admin".',
    });
  });

  it('rejects a request with no body', async () => {
    const res = await request(app).post('/api/auth/register');
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ email: 'Email is required.', password: 'Password is required.' });
  });

  it('does not create an account when validation fails', async () => {
    await register({ email: 'short@example.com', password: 'short' });
    const res = await login({ email: 'short@example.com', password: 'short' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/login', () => {
  it.each([
    ['user', member],
    ['admin', staff],
  ])('signs in a %s account with its role', async (role, account) => {
    const res = await login({ email: account.email, password: account.password, role });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: account.email, role });
    const payload = jwt.verify(res.body.token, config.jwtSecret);
    expect(payload).toMatchObject({ sub: res.body.user.id, email: account.email, role });
  });

  it('signs in without a role and returns the stored role', async () => {
    const res = await login({ email: staff.email, password: staff.password });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('matches the email regardless of case and spacing', async () => {
    const res = await login({ email: `  ${member.email.toUpperCase()} `, password: member.password });
    expect(res.status).toBe(200);
  });

  it('rejects a wrong password', async () => {
    const res = await login({ email: member.email, password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
  });

  it('gives an unknown email the same response as a wrong password', async () => {
    const wrongPassword = await login({ email: member.email, password: 'WrongPassword1' });
    const unknownEmail = await login({ email: 'nobody@example.com', password: 'WrongPassword1' });
    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it('is case-sensitive about the password', async () => {
    const res = await login({ email: member.email, password: member.password.toLowerCase() });
    expect(res.status).toBe(401);
  });

  it('refuses a user account signing in as an administrator', async () => {
    const res = await login({ email: member.email, password: member.password, role: 'admin' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ROLE_MISMATCH');
    expect(res.body.error.message).toBe('This is a User account. Choose User under “Continue as” and try again.');
    expect(res.body.token).toBeUndefined();
  });

  it('refuses an administrator account signing in as a user', async () => {
    const res = await login({ email: staff.email, password: staff.password, role: 'user' });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('This is an Administrator account. Choose Administrator under “Continue as” and try again.');
  });

  it('checks the password before revealing a role mismatch', async () => {
    const res = await login({ email: member.email, password: 'WrongPassword1', role: 'admin' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns field errors for missing or invalid input', async () => {
    const res = await login({ email: 'not-an-email', role: 'guest' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ email: 'Enter a valid email address.', password: 'Password is required.', role: 'Role must be "user" or "admin".' });
  });

  it('rejects a password sent as an object', async () => {
    const res = await login({ email: member.email, password: { $gt: '' } });
    expect(res.status).toBe(400);
    expect(res.body.error.details.password).toBe('Password must be text.');
  });
});
