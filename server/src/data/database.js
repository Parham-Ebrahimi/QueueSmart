import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import config from '../config.js';

// One SQLite file (or :memory: in tests) for every A4 module: accounts, services,
// queues, history, and notifications. schema.sql is applied on first open.
let database;

export function getDatabase() {
  if (!database) {
    const path = config.databasePath === ':memory:' ? ':memory:' : resolve(config.databasePath);
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    database = new DatabaseSync(path);
    database.exec('PRAGMA foreign_keys = ON');
    database.exec(readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8'));
  }
  return database;
}

export function closeDatabase() {
  database?.close();
  database = undefined;
}

// Runs fn inside one transaction so a multi-step change is saved completely or not at all.
export function transaction(fn) {
  const db = getDatabase();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
