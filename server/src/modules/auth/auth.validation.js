import { ROLES } from '../../utils/roles.js';

// Same rules and messages as the frontend (src/auth.js) so inline errors read the same,
// but the server never trusts the client: every request is checked again here.
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asObject(body) {
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

export function checkEmail(value) {
  if (isMissing(value)) return 'Email is required.';
  if (typeof value !== 'string') return 'Email must be text.';
  const email = value.trim();
  if (!email) return 'Email is required.';
  if (email.length > EMAIL_MAX_LENGTH) return `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`;
  if (!emailPattern.test(email)) return 'Enter a valid email address.';
  return null;
}

function checkRole(value) {
  if (value === undefined) return null;
  return ROLES.includes(value) ? null : 'Role must be "user" or "admin".';
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export function validateRegistration(body) {
  const input = asObject(body);
  const errors = {};

  const emailError = checkEmail(input.email);
  if (emailError) errors.email = emailError;
  if (input.fullName !== undefined && (typeof input.fullName !== 'string' || !input.fullName.trim() || input.fullName.trim().length > 100)) {
    errors.fullName = 'Full name must be 1 to 100 characters.';
  }

  const { password } = input;
  if (isMissing(password)) errors.password = 'Password is required.';
  else if (typeof password !== 'string') errors.password = 'Password must be text.';
  else if (password.length < PASSWORD_MIN_LENGTH) errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  else if (password.length > PASSWORD_MAX_LENGTH) errors.password = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;

  // confirmPassword is optional for API clients, but must match when it is sent.
  if (input.confirmPassword !== undefined && input.confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';

  const roleError = checkRole(input.role);
  if (roleError) errors.role = roleError;

  return { errors, value: { email: normalizeEmail(input.email), password, role: input.role || 'user', fullName: typeof input.fullName === 'string' ? input.fullName.trim() : undefined } };
}

export function validateProfile(body) {
  const input = asObject(body);
  const errors = {};
  const emailError = checkEmail(input.email);
  if (emailError) errors.email = emailError;
  if (typeof input.fullName !== 'string' || !input.fullName.trim()) errors.fullName = 'Full name is required.';
  else if (input.fullName.trim().length > 100) errors.fullName = 'Full name must be 100 characters or fewer.';
  if (input.contact !== undefined && input.contact !== null && (typeof input.contact !== 'string' || input.contact.trim().length > 100)) {
    errors.contact = 'Contact must be 100 characters or fewer.';
  }
  return { errors, value: { fullName: typeof input.fullName === 'string' ? input.fullName.trim() : undefined, email: normalizeEmail(input.email), contact: typeof input.contact === 'string' ? input.contact.trim() || null : null } };
}

export function validatePasswordChange(body) {
  const input = asObject(body);
  const errors = {};
  if (!input.currentPassword || typeof input.currentPassword !== 'string') errors.currentPassword = 'Current password is required.';
  if (typeof input.newPassword !== 'string' || input.newPassword.length < PASSWORD_MIN_LENGTH) errors.newPassword = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  else if (input.newPassword.length > PASSWORD_MAX_LENGTH) errors.newPassword = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  if (input.confirmPassword !== input.newPassword) errors.confirmPassword = 'Passwords do not match.';
  return { errors, value: { currentPassword: input.currentPassword, newPassword: input.newPassword } };
}

export function validateLogin(body) {
  const input = asObject(body);
  const errors = {};

  const emailError = checkEmail(input.email);
  if (emailError) errors.email = emailError;

  // Only presence and size are checked at login; the minimum length applies when the password is created.
  const { password } = input;
  if (isMissing(password)) errors.password = 'Password is required.';
  else if (typeof password !== 'string') errors.password = 'Password must be text.';
  else if (password.length > PASSWORD_MAX_LENGTH) errors.password = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;

  const roleError = checkRole(input.role);
  if (roleError) errors.role = roleError;

  return { errors, value: { email: normalizeEmail(input.email), password, role: input.role } };
}
