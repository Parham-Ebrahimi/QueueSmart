import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const appUrl = JSON.stringify(new URL('../src/app.js', import.meta.url).href);
const tokensUrl = JSON.stringify(new URL('../src/utils/tokens.js', import.meta.url).href);

function runBackendRequest(method, path, body, environment) {
  const script = `import { createApp } from ${appUrl};
  import { signToken } from ${tokensUrl};
  const server = createApp().listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const port = server.address().port;
    const response = await fetch('http://127.0.0.1:' + port + ${JSON.stringify(path)}, {
      method: ${JSON.stringify(method)},
      headers: {
        Authorization: 'Bearer ' + signToken({ id: 'admin-1', email: 'admin@example.com', role: 'admin' }),
        Accept: 'application/json',
        ${body === undefined ? '' : "'Content-Type': 'application/json',"}
      },
      ${body === undefined ? '' : `body: JSON.stringify(${JSON.stringify(body)}),`}
    });
    if (!response.ok) throw new Error('Backend request failed: ' + response.status + ' ' + await response.text());
    process.stdout.write(JSON.stringify(await response.json()));
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }`;

  return execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: environment,
    encoding: 'utf8',
  });
}

describe('service database persistence', () => {
  it('retains API-created services and final deletion across backend restarts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'queuesmart-services-'));
    const databasePath = join(directory, 'services.sqlite');
    const environment = { ...process.env, NODE_ENV: 'development', DATABASE_PATH: databasePath };

    try {
      runBackendRequest('POST', '/api/services', {
        id: 'persistent-service',
        name: 'Persistent Service',
        description: 'Stored on disk.',
        expectedDuration: 15,
        priority: 'high',
      }, environment);

      const output = runBackendRequest('GET', '/api/services', undefined, environment);

      expect(JSON.parse(output).services).toMatchObject([{
        id: 'persistent-service',
        name: 'Persistent Service',
        expectedDuration: 15,
        priority: 'high',
      }]);

      runBackendRequest('DELETE', '/api/services/persistent-service', undefined, environment);
      expect(JSON.parse(runBackendRequest('GET', '/api/services', undefined, environment)).services).toEqual([]);
      expect(JSON.parse(runBackendRequest('GET', '/api/services', undefined, environment)).services).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps test-mode service resets away from an explicitly configured database path', () => {
    const directory = mkdtempSync(join(tmpdir(), 'queuesmart-test-isolation-'));
    const databasePath = join(directory, 'protected.sqlite');
    const protectedDatabase = new DatabaseSync(databasePath);
    protectedDatabase.exec('CREATE TABLE protected_records (value TEXT NOT NULL)');
    protectedDatabase.prepare('INSERT INTO protected_records (value) VALUES (?)').run('preserve me');
    protectedDatabase.close();

    try {
      execFileSync(process.execPath, [
        '--input-type=module',
        '-e',
        `import config from ${JSON.stringify(new URL('../src/config.js', import.meta.url).href)};
        import { createService, resetServices } from ${JSON.stringify(new URL('../src/data/serviceStore.js', import.meta.url).href)};
        if (config.databasePath !== ':memory:') throw new Error('Tests must use an in-memory database.');
        resetServices();
        createService({ id: 'test-only', name: 'Test only', description: 'Isolated', expectedDuration: 5 });`,
      ], {
        env: { ...process.env, NODE_ENV: 'test', DATABASE_PATH: databasePath },
      });

      const verifiedDatabase = new DatabaseSync(databasePath);
      expect(verifiedDatabase.prepare('SELECT value FROM protected_records').get().value).toBe('preserve me');
      expect(verifiedDatabase.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'services'",
      ).get()).toBeUndefined();
      verifiedDatabase.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('adds description guards to an existing services table without replacing its records', () => {
    const directory = mkdtempSync(join(tmpdir(), 'queuesmart-service-migration-'));
    const databasePath = join(directory, 'legacy.sqlite');
    const environment = { ...process.env, NODE_ENV: 'development', DATABASE_PATH: databasePath };
    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`CREATE TABLE services (
      service_id TEXT PRIMARY KEY CHECK (length(service_id) BETWEEN 1 AND 100),
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
      description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
      expected_duration INTEGER NOT NULL CHECK (expected_duration BETWEEN 1 AND 480),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      category TEXT NOT NULL DEFAULT '' CHECK (length(category) <= 40),
      location TEXT NOT NULL DEFAULT '' CHECK (length(location) <= 120),
      open_until TEXT NOT NULL DEFAULT '5:00 PM' CHECK (length(open_until) BETWEEN 6 AND 8),
      is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT`);
    legacyDatabase.prepare(`INSERT INTO services (
      service_id, name, description, expected_duration, priority, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      'existing-service',
      'Existing service',
      'Keep this description.',
      10,
      'medium',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    );
    legacyDatabase.close();

    try {
      const output = execFileSync(process.execPath, [
        '--input-type=module',
        '-e',
        `import { getDatabase } from ${JSON.stringify(new URL('../src/data/database.js', import.meta.url).href)};
        const db = getDatabase();
        const existing = db.prepare('SELECT service_id, description FROM services WHERE service_id = ?').get('existing-service');
        let emptyRejected = false;
        let whitespaceRejected = false;
        let invalidIdRejected = false;
        let invalidTimeRejected = false;
        try { db.prepare('UPDATE services SET description = ? WHERE service_id = ?').run('', 'existing-service'); }
        catch { emptyRejected = true; }
        try { db.prepare('UPDATE services SET description = ? WHERE service_id = ?').run('   ', 'existing-service'); }
        catch { whitespaceRejected = true; }
        try { db.prepare('UPDATE services SET service_id = ? WHERE service_id = ?').run('bad!id', 'existing-service'); }
        catch { invalidIdRejected = true; }
        try { db.prepare('UPDATE services SET open_until = ? WHERE service_id = ?').run('25:00 PM', 'existing-service'); }
        catch { invalidTimeRejected = true; }
        process.stdout.write(JSON.stringify({ existing, emptyRejected, whitespaceRejected, invalidIdRejected, invalidTimeRejected }));`,
      ], { env: environment, encoding: 'utf8' });

      expect(JSON.parse(output)).toEqual({
        existing: { service_id: 'existing-service', description: 'Keep this description.' },
        emptyRejected: true,
        whitespaceRejected: true,
        invalidIdRejected: true,
        invalidTimeRejected: true,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
