import ApiError from '../../utils/ApiError.js';
import {
  createService as saveService,
  findServiceById,
  listServices as getServices,
  removeService,
  updateService as saveServiceUpdate,
} from '../../data/serviceStore.js';
import { closeOutQueue } from '../queues/queues.service.js';
import { isValidServiceId, validateCreateService, validateUpdateService, SERVICE_DURATION_MAX, SERVICE_DURATION_MIN } from './services.validation.js';

function assertValid({ errors, value }) {
  if (Object.keys(errors).length) throw ApiError.validation(errors);
  return value;
}

export function listServices(req, res) {
  res.json({ services: getServices() });
}

export function createService(req, res) {
  const input = assertValid(validateCreateService(req.body));
  if (input.id && findServiceById(input.id)) {
    throw ApiError.conflict('A service with this ID already exists.', { id: 'Choose a different service ID.' }, 'SERVICE_ID_TAKEN');
  }
  const service = saveService(input);
  res.status(201).json({ service });
}

export function updateService(req, res) {
  const input = assertValid(validateUpdateService(req.body));
  if (!isValidServiceId(req.params.id)) {
    throw ApiError.validation({ id: 'Service ID is invalid.' });
  }
  const current = findServiceById(req.params.id);
  if (!current) throw ApiError.notFound('Service not found.');
  res.json({ service: saveServiceUpdate(req.params.id, input) });
}

export function deleteService(req, res) {
  if (!isValidServiceId(req.params.id)) {
    throw ApiError.validation({ id: 'Service ID is invalid.' });
  }
  const current = findServiceById(req.params.id);
  if (!current) throw ApiError.notFound('Service not found.');
  // Anyone still waiting is recorded as removed before the service disappears.
  closeOutQueue(current);
  res.json({ service: removeService(req.params.id) });
}

export function getWaitTime(req, res) {
  if (!isValidServiceId(req.params.id)) {
    throw ApiError.validation({ id: 'Service ID is invalid.' });
  }
  const service = findServiceById(req.params.id);
  if (!service) throw ApiError.notFound('Service not found.');

  const positionValue = req.query.position;
  const position = typeof positionValue === 'string' && /^\d+$/.test(positionValue) ? Number(positionValue) : NaN;
  if (!Number.isSafeInteger(position) || position < 1) {
    throw ApiError.validation({ position: 'Position must be a positive whole number.' });
  }
  if (!Number.isInteger(service.expectedDuration) || service.expectedDuration < SERVICE_DURATION_MIN || service.expectedDuration > SERVICE_DURATION_MAX) {
    throw new ApiError(500, 'INVALID_SERVICE_DATA', 'Wait time is unavailable for this service.');
  }

  const estimatedWaitMinutes = (position - 1) * service.expectedDuration;
  if (!Number.isSafeInteger(estimatedWaitMinutes)) {
    throw ApiError.validation({ position: 'Position is too large to estimate safely.' });
  }

  res.json({
    serviceId: service.id,
    position,
    expectedDuration: service.expectedDuration,
    estimatedWaitMinutes,
  });
}
