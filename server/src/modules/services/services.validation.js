export const SERVICE_NAME_MAX_LENGTH = 100;
export const SERVICE_DESCRIPTION_MAX_LENGTH = 500;
export const SERVICE_DURATION_MIN = 1;
export const SERVICE_DURATION_MAX = 480;
const priorityLevels = ['low', 'medium', 'high'];
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const timePattern = /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i;

function asObject(body) {
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

function validateServiceFields(body, partial = false) {
  const input = asObject(body);
  const errors = {};
  const value = {};
  const has = field => Object.hasOwn(input, field);

  if (!partial || has('name')) {
    if (!has('name') || input.name === null || input.name === '') errors.name = 'Service name is required.';
    else if (typeof input.name !== 'string') errors.name = 'Service name must be text.';
    else {
      const name = input.name.trim();
      if (!name) errors.name = 'Service name is required.';
      else if (name.length > SERVICE_NAME_MAX_LENGTH) errors.name = `Service name must be ${SERVICE_NAME_MAX_LENGTH} characters or fewer.`;
      else value.name = name;
    }
  }

  if (!partial || has('description')) {
    if (!has('description') || input.description === null || input.description === '') errors.description = 'Description is required.';
    else if (typeof input.description !== 'string') errors.description = 'Description must be text.';
    else {
      const description = input.description.trim();
      if (!description) errors.description = 'Description is required.';
      else if (description.length > SERVICE_DESCRIPTION_MAX_LENGTH) errors.description = `Description must be ${SERVICE_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
      else value.description = description;
    }
  }

  if (!partial || has('expectedDuration')) {
    if (!has('expectedDuration') || input.expectedDuration === null || input.expectedDuration === '') errors.expectedDuration = 'Expected duration is required.';
    else if (!Number.isInteger(input.expectedDuration)) errors.expectedDuration = 'Expected duration must be a whole number of minutes.';
    else if (input.expectedDuration < SERVICE_DURATION_MIN || input.expectedDuration > SERVICE_DURATION_MAX) {
      errors.expectedDuration = `Expected duration must be between ${SERVICE_DURATION_MIN} and ${SERVICE_DURATION_MAX} minutes.`;
    } else value.expectedDuration = input.expectedDuration;
  }

  if (!partial || has('priority')) {
    if (!has('priority') || input.priority === null || input.priority === '') errors.priority = 'Priority is required.';
    else if (!priorityLevels.includes(input.priority)) errors.priority = 'Priority must be "low", "medium", or "high".';
    else value.priority = input.priority;
  }

  if (has('id')) {
    if (typeof input.id !== 'string' || !idPattern.test(input.id)) {
      errors.id = 'Service ID must contain only letters, numbers, underscores, and hyphens.';
    } else if (!partial) {
      value.id = input.id;
    }
  }

  if (has('category')) {
    if (typeof input.category !== 'string') errors.category = 'Category must be text.';
    else if (input.category.trim().length > 40) errors.category = 'Category must be 40 characters or fewer.';
    else value.category = input.category.trim();
  }
  if (has('location')) {
    if (typeof input.location !== 'string') errors.location = 'Location must be text.';
    else if (input.location.trim().length > 120) errors.location = 'Location must be 120 characters or fewer.';
    else value.location = input.location.trim();
  }
  if (has('openUntil')) {
    if (typeof input.openUntil !== 'string' || !timePattern.test(input.openUntil.trim())) {
      errors.openUntil = 'Open until must be a valid time such as "5:00 PM".';
    } else value.openUntil = input.openUntil.trim();
  }
  if (has('isOpen')) {
    if (typeof input.isOpen !== 'boolean') errors.isOpen = 'isOpen must be true or false.';
    else value.isOpen = input.isOpen;
  }

  if (partial && Object.keys(value).length === 0 && Object.keys(errors).length === 0) {
    errors._body = 'Provide at least one service field to update.';
  }

  return { errors, value };
}

export function validateCreateService(body) {
  return validateServiceFields(body);
}

export function validateUpdateService(body) {
  return validateServiceFields(body, true);
}

export function isValidServiceId(id) {
  return typeof id === 'string' && idPattern.test(id);
}
