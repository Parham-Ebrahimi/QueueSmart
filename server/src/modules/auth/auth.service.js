import bcrypt from 'bcryptjs';
import config from '../../config.js';
import { createUser, findUserByEmail, findUserById, getProfile, toPublicUser, updatePassword, updateProfile } from '../../data/userStore.js';
import ApiError from '../../utils/ApiError.js';
import { ROLE_LABELS } from '../../utils/roles.js';
import { signToken } from '../../utils/tokens.js';

function createSession(user) {
  return { token: signToken(user), user: toPublicUser(user) };
}

export async function registerUser({ email, password, role, fullName }) {
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  // Checked after hashing so two requests for the same email cannot both get through.
  if (findUserByEmail(email)) {
    const message = 'An account with this email already exists.';
    throw ApiError.conflict(message, { email: message }, 'EMAIL_TAKEN');
  }
  try {
    return createSession(createUser({ email, passwordHash, role, fullName }));
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint failed: user_credentials.email')) {
      const message = 'An account with this email already exists.';
      throw ApiError.conflict(message, { email: message }, 'EMAIL_TAKEN');
    }
    throw error;
  }
}

export async function loginUser({ email, password, role }) {
  const user = findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw ApiError.unauthorized('Email or password is incorrect.', 'INVALID_CREDENTIALS');

  if (role && role !== user.role) {
    const label = ROLE_LABELS[user.role];
    throw ApiError.forbidden(`This is ${user.role === 'admin' ? 'an' : 'a'} ${label} account. Choose ${label} under “Continue as” and try again.`, 'ROLE_MISMATCH');
  }

  return createSession(user);
}

export function profileForUser(userId) {
  const profile = getProfile(userId);
  if (!profile) throw ApiError.notFound('Account not found.');
  return profile;
}

export function saveProfile(userId, details) {
  const existing = findUserByEmail(details.email);
  if (existing && existing.id !== userId) {
    const message = 'An account with this email already exists.';
    throw ApiError.conflict(message, { email: message }, 'EMAIL_TAKEN');
  }
  try {
    const profile = updateProfile(userId, details);
    return { profile, ...createSession(findUserById(userId)) };
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint failed: user_credentials.email')) {
      const message = 'An account with this email already exists.';
      throw ApiError.conflict(message, { email: message }, 'EMAIL_TAKEN');
    }
    throw error;
  }
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = findUserById(userId);
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw ApiError.unauthorized('Current password is incorrect.', 'INVALID_PASSWORD');
  }
  updatePassword(userId, await bcrypt.hash(newPassword, config.bcryptRounds));
  return { message: 'Password updated.' };
}
