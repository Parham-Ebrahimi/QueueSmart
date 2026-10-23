export const ENTRY_PRIORITIES = ['normal', 'high'];
export const VISITOR_NAME_MAX_LENGTH = 80;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

function asObject(body) {
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

// POST /queues/:serviceId/join  { name?, priority? }
export function validateJoin(body) {
  const input = asObject(body);
  const errors = {};
  const value = { priority: 'normal' };

  if (input.name !== undefined && input.name !== null && input.name !== '') {
    if (typeof input.name !== 'string') errors.name = 'Name must be text.';
    else if (input.name.trim().length > VISITOR_NAME_MAX_LENGTH) errors.name = `Name must be ${VISITOR_NAME_MAX_LENGTH} characters or fewer.`;
    else if (input.name.trim()) value.name = input.name.trim();
  }

  if (input.priority !== undefined) {
    if (!ENTRY_PRIORITIES.includes(input.priority)) errors.priority = 'Priority must be "normal" or "high".';
    else value.priority = input.priority;
  }

  return { errors, value };
}

// POST /queues/:serviceId/entries/:entryId/move  { direction: -1 | 1 }
export function validateMove(body) {
  const { direction } = asObject(body);
  if (direction !== -1 && direction !== 1) return { errors: { direction: 'Direction must be -1 (up) or 1 (down).' }, value: {} };
  return { errors: {}, value: { direction } };
}

export function isValidId(id) {
  return typeof id === 'string' && idPattern.test(id);
}
