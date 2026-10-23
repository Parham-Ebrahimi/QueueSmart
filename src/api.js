// Client for the QueueSmart API. Every endpoint returns errors as
// { error: { code, message, details } }, which apiRequest turns into an ApiError.
const unreachableMessage = 'Can’t reach the QueueSmart server. Make sure the backend is running, then try again.';

export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', unreachableMessage);
  }

  const data = await response.json().catch(() => null);
  if (response.ok) return data;
  // The dev proxy answers with an empty error page when the backend is not running.
  if (!data?.error) throw new ApiError(response.status, 'NETWORK_ERROR', unreachableMessage);
  throw new ApiError(response.status, data.error.code, data.error.message, data.error.details);
}

export function loginAccount({ email, password, role }) {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password, role } });
}

export function registerAccount({ email, password, confirmPassword, role }) {
  return apiRequest('/auth/register', { method: 'POST', body: { email, password, confirmPassword, role } });
}

function toServicePayload(service) {
  const { queue, served, averageMinutes, serverBacked, ...fields } = service;
  return { ...fields, expectedDuration: service.expectedDuration ?? averageMinutes };
}

export async function listServices(token) {
  return apiRequest('/services', { token });
}

export async function createService(service, token) {
  const { service: created } = await apiRequest('/services', { method: 'POST', body: toServicePayload(service), token });
  return created;
}

export async function updateService(id, service, token) {
  const { service: updated } = await apiRequest(`/services/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: toServicePayload(service),
    token,
  });
  return updated;
}

export async function deleteService(id, token) {
  return apiRequest(`/services/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

export function getServiceWaitTime(id, position, token) {
  return apiRequest(`/queues/${encodeURIComponent(id)}/wait-time?position=${encodeURIComponent(position)}`, { token });
}
