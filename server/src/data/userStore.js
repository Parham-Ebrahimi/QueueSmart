import { randomUUID } from 'node:crypto';

// In-memory accounts. Assignment 3 has no database yet, so registered users reset
// whenever the server restarts. Replace these functions with queries in Assignment 4.
const usersByEmail = new Map();

export function createUser({ email, passwordHash, role }) {
  const user = { id: `usr_${randomUUID()}`, email, passwordHash, role, createdAt: new Date().toISOString() };
  usersByEmail.set(email, user);
  return user;
}

export function findUserByEmail(email) {
  return usersByEmail.get(email) || null;
}

// Never send password hashes to the client.
export function toPublicUser({ id, email, role, createdAt }) {
  return { id, email, role, createdAt };
}

export function resetUsers() {
  usersByEmail.clear();
}
