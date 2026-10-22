import { describe, expect, it } from 'vitest';
import { validateLogin, validateRegistration } from '../src/modules/auth/auth.validation.js';

const validRegistration = { email: 'Student@Example.com', password: 'Password1', confirmPassword: 'Password1', role: 'user' };

describe('validateRegistration', () => {
  it('accepts valid input and normalizes the email', () => {
    const { errors, value } = validateRegistration({ ...validRegistration, email: '  Student@Example.com  ' });
    expect(errors).toEqual({});
    expect(value).toEqual({ email: 'student@example.com', password: 'Password1', role: 'user' });
  });

  it('defaults the role to user when none is sent', () => {
    const { errors, value } = validateRegistration({ email: 'a@b.co', password: 'Password1' });
    expect(errors).toEqual({});
    expect(value.role).toBe('user');
  });

  it('accepts the admin role', () => {
    const { errors, value } = validateRegistration({ ...validRegistration, role: 'admin' });
    expect(errors).toEqual({});
    expect(value.role).toBe('admin');
  });

  it.each([undefined, null, [], 'email=a@b.co', 42])('reports every required field when the body is %j', body => {
    expect(validateRegistration(body).errors).toEqual({ email: 'Email is required.', password: 'Password is required.' });
  });

  it.each([
    ['empty string', ''],
    ['only spaces', '   '],
    ['null', null],
  ])('requires an email (%s)', (label, email) => {
    expect(validateRegistration({ ...validRegistration, email }).errors.email).toBe('Email is required.');
  });

  it.each(['plainaddress', 'missing-at.com', 'user@', '@example.com', 'user@example', 'user name@example.com', 'user@exa mple.com', 'a@@b.com'])('rejects the malformed email %j', email => {
    expect(validateRegistration({ ...validRegistration, email }).errors.email).toBe('Enter a valid email address.');
  });

  it('rejects an email longer than 254 characters', () => {
    const email = `${'a'.repeat(250)}@b.co`;
    expect(validateRegistration({ ...validRegistration, email }).errors.email).toBe('Email must be 254 characters or fewer.');
  });

  it.each([123, true, { address: 'a@b.co' }, ['a@b.co']])('rejects a non-text email (%j)', email => {
    expect(validateRegistration({ ...validRegistration, email }).errors.email).toBe('Email must be text.');
  });

  it('requires a password', () => {
    expect(validateRegistration({ email: 'a@b.co', password: '' }).errors.password).toBe('Password is required.');
  });

  it('rejects a non-text password', () => {
    expect(validateRegistration({ email: 'a@b.co', password: 12345678 }).errors.password).toBe('Password must be text.');
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(validateRegistration({ email: 'a@b.co', password: 'Pass1' }).errors.password).toBe('Use at least 8 characters.');
  });

  it('accepts passwords of exactly 8 and 128 characters', () => {
    expect(validateRegistration({ email: 'a@b.co', password: 'Passwor1' }).errors).toEqual({});
    expect(validateRegistration({ email: 'a@b.co', password: `${'a'.repeat(127)}1` }).errors).toEqual({});
  });

  it('rejects a password longer than 128 characters', () => {
    expect(validateRegistration({ email: 'a@b.co', password: `${'a'.repeat(128)}1` }).errors.password).toBe('Use 128 characters or fewer.');
  });

  it('rejects a confirmPassword that does not match', () => {
    expect(validateRegistration({ ...validRegistration, confirmPassword: 'Password2' }).errors.confirmPassword).toBe('Passwords do not match.');
  });

  it.each(['administrator', 'ADMIN', 'superuser', '', 1, null])('rejects the unknown role %j', role => {
    expect(validateRegistration({ ...validRegistration, role }).errors.role).toBe('Role must be "user" or "admin".');
  });

  it('reports several invalid fields at once', () => {
    const { errors } = validateRegistration({ email: 'nope', password: 'short', confirmPassword: 'other', role: 'owner' });
    expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'email', 'password', 'role']);
  });
});

describe('validateLogin', () => {
  it('accepts valid input and keeps the requested role', () => {
    const { errors, value } = validateLogin({ email: ' Admin@QueueSmart.test ', password: 'anything-goes', role: 'admin' });
    expect(errors).toEqual({});
    expect(value).toEqual({ email: 'admin@queuesmart.test', password: 'anything-goes', role: 'admin' });
  });

  it('treats the role as optional', () => {
    const { errors, value } = validateLogin({ email: 'a@b.co', password: 'Password1' });
    expect(errors).toEqual({});
    expect(value.role).toBeUndefined();
  });

  it('does not apply the registration minimum length to the login password', () => {
    expect(validateLogin({ email: 'a@b.co', password: 'short' }).errors).toEqual({});
  });

  it('reports missing email and password', () => {
    expect(validateLogin({}).errors).toEqual({ email: 'Email is required.', password: 'Password is required.' });
  });

  it('rejects a malformed email', () => {
    expect(validateLogin({ email: 'not-an-email', password: 'Password1' }).errors.email).toBe('Enter a valid email address.');
  });

  it('rejects a non-text password', () => {
    expect(validateLogin({ email: 'a@b.co', password: { $ne: '' } }).errors.password).toBe('Password must be text.');
  });

  it('rejects a password longer than 128 characters', () => {
    expect(validateLogin({ email: 'a@b.co', password: 'a'.repeat(129) }).errors.password).toBe('Use 128 characters or fewer.');
  });

  it('rejects an unknown role', () => {
    expect(validateLogin({ email: 'a@b.co', password: 'Password1', role: 'guest' }).errors.role).toBe('Role must be "user" or "admin".');
  });
});
