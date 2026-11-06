import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.js';

const userColumns = 'id, email, password_hash AS passwordHash, role, created_at AS createdAt';

export function createUser({ id, email, passwordHash, role, fullName, contact = null }) {
  const db = getDatabase();
  const user = { id: id || `usr_${randomUUID()}`, email, passwordHash, role, createdAt: new Date().toISOString() };
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO user_credentials (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, user.email, user.passwordHash, user.role, user.createdAt);
    db.prepare('INSERT INTO user_profiles (user_id, full_name, contact) VALUES (?, ?, ?)')
      .run(user.id, fullName || email.split('@')[0], contact);
    db.exec('COMMIT');
    return user;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function findUserByEmail(email) {
  return getDatabase().prepare(`SELECT ${userColumns} FROM user_credentials WHERE email = ?`).get(email) || null;
}

export function findUserById(id) {
  return getDatabase().prepare(`SELECT ${userColumns} FROM user_credentials WHERE id = ?`).get(id) || null;
}

export function listUsers() {
  return getDatabase().prepare(`SELECT ${userColumns} FROM user_credentials`).all();
}

export function getProfile(userId) {
  return getDatabase().prepare(`SELECT c.id AS userId, c.email, p.full_name AS fullName, p.contact
    FROM user_credentials c JOIN user_profiles p ON p.user_id = c.id WHERE c.id = ?`).get(userId) || null;
}

export function updateProfile(userId, { fullName, email, contact }) {
  const db = getDatabase();
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE user_credentials SET email = ? WHERE id = ?').run(email, userId);
    db.prepare('UPDATE user_profiles SET full_name = ?, contact = ? WHERE user_id = ?').run(fullName, contact, userId);
    db.exec('COMMIT');
    return getProfile(userId);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function updatePassword(userId, passwordHash) {
  getDatabase().prepare('UPDATE user_credentials SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

export function toPublicUser({ id, email, role, createdAt }) {
  return { id, email, role, createdAt };
}

export function resetUsers() {
  getDatabase().exec('DELETE FROM user_credentials');
}
