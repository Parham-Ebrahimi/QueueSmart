import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { resetServices, updateService as updateStoredService } from '../src/data/serviceStore.js';
import { signToken } from '../src/utils/tokens.js';

const app = createApp();
const adminToken = signToken({ id: 'admin-1', email: 'admin@example.com', role: 'admin' });
const userToken = signToken({ id: 'user-1', email: 'user@example.com', role: 'user' });
const validService = {
  id: 'student-services',
  name: 'Student Services',
  description: 'Campus support and enrollment questions.',
  expectedDuration: 12,
  priority: 'medium',
};

function authorized(token, method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

beforeEach(() => resetServices());

describe('service management API', () => {
  it('requires authentication to list services', async () => {
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(401);
  });

  it('requires authentication for wait-time estimates', async () => {
    const res = await request(app).get('/api/queues/student-services/wait-time?position=1');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('lets users and administrators list services', async () => {
    const created = await authorized(adminToken, 'post', '/api/services').send(validService);
    const asUser = await authorized(userToken, 'get', '/api/services');
    const asAdmin = await authorized(adminToken, 'get', '/api/services');

    expect(asUser.status).toBe(200);
    expect(asAdmin.body.services).toEqual([created.body.service]);
  });

  it('creates, updates, and deletes a service as an administrator', async () => {
    const created = await authorized(adminToken, 'post', '/api/services').send(validService);
    expect(created.status).toBe(201);
    expect(created.body.service).toMatchObject({
      id: 'student-services',
      name: 'Student Services',
      expectedDuration: 12,
      priority: 'medium',
      isOpen: true,
    });

    const updated = await authorized(adminToken, 'put', '/api/services/student-services').send({
      ...validService,
      name: 'Campus Services',
      expectedDuration: 20,
      priority: 'high',
      isOpen: false,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.service).toMatchObject({ name: 'Campus Services', expectedDuration: 20, priority: 'high', isOpen: false });

    const deleted = await authorized(adminToken, 'delete', '/api/services/student-services');
    expect(deleted.status).toBe(200);
    expect((await authorized(adminToken, 'get', '/api/services')).body.services).toEqual([]);
  });

  it.each([1, 480])('accepts the duration boundary %i', async expectedDuration => {
    const res = await authorized(adminToken, 'post', '/api/services').send({
      ...validService,
      name: 'S'.repeat(100),
      description: 'd'.repeat(500),
      expectedDuration,
    });
    expect(res.status).toBe(201);
    expect(res.body.service).toMatchObject({
      name: 'S'.repeat(100),
      description: 'd'.repeat(500),
      expectedDuration,
    });
  });

  it.each(['low', 'medium', 'high'])('accepts %s priority', async priority => {
    const res = await authorized(adminToken, 'post', '/api/services').send({ ...validService, priority });
    expect(res.status).toBe(201);
    expect(res.body.service.priority).toBe(priority);
  });

  it('preserves omitted fields when updating a service', async () => {
    await authorized(adminToken, 'post', '/api/services').send({
      ...validService,
      category: 'Support',
      location: 'Room 10',
      openUntil: '4:30 PM',
      isOpen: false,
    });

    const res = await authorized(adminToken, 'put', '/api/services/student-services').send({ name: 'Updated name' });
    expect(res.status).toBe(200);
    expect(res.body.service).toMatchObject({
      name: 'Updated name',
      description: validService.description,
      expectedDuration: validService.expectedDuration,
      priority: validService.priority,
      category: 'Support',
      location: 'Room 10',
      openUntil: '4:30 PM',
      isOpen: false,
    });
  });

  it.each([
    ['post', '/api/services', validService],
    ['put', '/api/services/student-services', { name: 'Unauthorized update' }],
    ['delete', '/api/services/student-services'],
  ])('rejects user-token %s requests to manage services', async (method, path, body) => {
    await authorized(adminToken, 'post', '/api/services').send(validService);
    let req = authorized(userToken, method, path);
    if (body) req = req.send(body);
    const res = await req;

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await authorized(adminToken, 'get', '/api/services')).body.services).toHaveLength(1);
  });

  it('does not overwrite a service when an ID is reused', async () => {
    await authorized(adminToken, 'post', '/api/services').send(validService);
    const res = await authorized(adminToken, 'post', '/api/services').send({ ...validService, name: 'Overwritten service' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SERVICE_ID_TAKEN');
    expect((await authorized(adminToken, 'get', '/api/services')).body.services[0].name).toBe(validService.name);
  });

  it('validates required fields, name length, duration, and priority', async () => {
    const res = await authorized(adminToken, 'post', '/api/services').send({
      name: 'x'.repeat(101),
      description: '',
      expectedDuration: 0.5,
      priority: 'urgent',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual({
      name: 'Service name must be 100 characters or fewer.',
      description: 'Description is required.',
      expectedDuration: 'Expected duration must be a whole number of minutes.',
      priority: 'Priority must be "low", "medium", or "high".',
    });
  });

  it.each([
    [{ name: 123 }, 'name', 'Service name must be text.'],
    [{ description: false }, 'description', 'Description must be text.'],
    [{ expectedDuration: '12' }, 'expectedDuration', 'Expected duration must be a whole number of minutes.'],
    [{ priority: 1 }, 'priority', 'Priority must be "low", "medium", or "high".'],
    [{ name: '   ' }, 'name', 'Service name is required.'],
    [{ description: '  ' }, 'description', 'Description is required.'],
  ])('rejects invalid service field types or whitespace values', async (overrides, field, message) => {
    const res = await authorized(adminToken, 'post', '/api/services').send({ ...validService, ...overrides });
    expect(res.status).toBe(400);
    expect(res.body.error.details[field]).toBe(message);
  });

  it('rejects malformed JSON with the shared error response', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send('{"name":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } });
  });

  it('rejects malformed service IDs', async () => {
    const res = await authorized(adminToken, 'put', '/api/services/bad%21id').send({ name: 'Updated' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.id).toBe('Service ID is invalid.');

    const createRes = await authorized(adminToken, 'post', '/api/services').send({ ...validService, id: 'bad!id' });
    expect(createRes.status).toBe(400);
    expect(createRes.body.error.details.id).toBe('Service ID must contain only letters, numbers, underscores, and hyphens.');
  });

  it('rejects an empty update body', async () => {
    const res = await authorized(adminToken, 'put', '/api/services/student-services').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details._body).toBe('Provide at least one service field to update.');
  });

  it.each([0, 481])('rejects duration %i outside the supported range', async expectedDuration => {
    const res = await authorized(adminToken, 'post', '/api/services').send({ ...validService, expectedDuration });
    expect(res.status).toBe(400);
    expect(res.body.error.details.expectedDuration).toContain('between 1 and 480');
  });

  it('rejects overlong descriptions and invalid optional metadata', async () => {
    const res = await authorized(adminToken, 'post', '/api/services').send({
      ...validService,
      description: 'd'.repeat(501),
      category: 'c'.repeat(41),
      location: 'l'.repeat(121),
      openUntil: '25:00 PM',
      isOpen: 'yes',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toMatchObject({
      description: 'Description must be 500 characters or fewer.',
      category: 'Category must be 40 characters or fewer.',
      location: 'Location must be 120 characters or fewer.',
      openUntil: 'Open until must be a valid time such as "5:00 PM".',
      isOpen: 'isOpen must be true or false.',
    });
  });

  it('returns a not found error for missing services', async () => {
    const res = await authorized(adminToken, 'put', '/api/services/missing').send(validService);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Service not found.');

    const deleteRes = await authorized(adminToken, 'delete', '/api/services/missing');
    expect(deleteRes.status).toBe(404);
  });
});

describe('GET /api/queues/:id/wait-time', () => {
  beforeEach(async () => {
    await authorized(adminToken, 'post', '/api/services').send(validService);
  });

  it.each([[1, 0], [2, 12], [4, 36]])('estimates position %i as %i minutes', async (position, estimatedWaitMinutes) => {
    const res = await authorized(userToken, 'get', `/api/queues/student-services/wait-time?position=${position}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      serviceId: 'student-services',
      position,
      expectedDuration: 12,
      estimatedWaitMinutes,
    });
  });

  it.each([[1, 0], [2, 10], [3, 20], [5, 40]])(
    'estimates position %i as %i minutes for a 10-minute service',
    async (position, estimatedWaitMinutes) => {
      await authorized(adminToken, 'put', '/api/services/student-services').send({ expectedDuration: 10 });
      const res = await authorized(userToken, 'get', `/api/queues/student-services/wait-time?position=${position}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        serviceId: 'student-services',
        position,
        expectedDuration: 10,
        estimatedWaitMinutes,
      });
    },
  );

  it.each(['0', '-1', '1.5', 'abc', ''])('rejects invalid queue position %j', async position => {
    const res = await authorized(userToken, 'get', `/api/queues/student-services/wait-time?position=${position}`);
    expect(res.status).toBe(400);
    expect(res.body.error.details.position).toBe('Position must be a positive whole number.');
  });

  it.each([undefined, '9007199254740992', '0x10', '1e2'])('rejects missing, unsafe, or non-decimal positions %j', async position => {
    const query = position === undefined ? '' : `?position=${encodeURIComponent(position)}`;
    const res = await authorized(userToken, 'get', `/api/queues/student-services/wait-time${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.details.position).toBe('Position must be a positive whole number.');
  });

  it('rejects repeated position parameters', async () => {
    const res = await authorized(userToken, 'get', '/api/queues/student-services/wait-time?position=1&position=2');
    expect(res.status).toBe(400);
    expect(res.body.error.details.position).toBe('Position must be a positive whole number.');
  });

  it('rejects an estimate that would overflow a safe integer', async () => {
    const res = await authorized(userToken, 'get', '/api/queues/student-services/wait-time?position=9007199254740991');
    expect(res.status).toBe(400);
    expect(res.body.error.details.position).toBe('Position is too large to estimate safely.');
  });

  it('rejects malformed service IDs for estimates', async () => {
    const res = await authorized(userToken, 'get', '/api/queues/%21invalid/wait-time?position=1');
    expect(res.status).toBe(400);
    expect(res.body.error.details.id).toBe('Service ID is invalid.');
  });

  it.each([0, undefined, '10'])('does not return a misleading estimate for invalid stored duration %j', async expectedDuration => {
    updateStoredService('student-services', { expectedDuration });
    const res = await authorized(userToken, 'get', '/api/queues/student-services/wait-time?position=2');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INVALID_SERVICE_DATA', message: 'Wait time is unavailable for this service.' },
    });
  });

  it('returns not found when the service does not exist', async () => {
    const res = await authorized(userToken, 'get', '/api/queues/missing/wait-time?position=1');
    expect(res.status).toBe(404);
  });
});
