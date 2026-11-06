import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import config from '../config.js';

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
