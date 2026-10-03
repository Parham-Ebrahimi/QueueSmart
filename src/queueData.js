const activeQueueKey = 'queuesmart-active-queue';
const servicesKey = 'queuesmart-services';
const servicesUpdatedEvent = 'queuesmart-services-updated';

export const priorityLevels = ['low', 'medium', 'high'];

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

function visitor(id, name, email, minutes) {
  return { id, name, email, joinedAt: minutesAgo(minutes) };
}

export const defaultServices = [
  {
    id: 'student-services',
    name: 'Student Services',
    description: 'Enrollment questions, transcript requests, and general campus support.',
    priority: 'medium',
    location: 'Campus Center · Room 104',
    category: 'Campus support',
    averageMinutes: 4,
    openUntil: '5:00 PM',
    isOpen: true,
    queue: [
      visitor('v-101', 'Avery Chen', 'avery.chen@example.edu', 14),
      visitor('v-102', 'Jordan Patel', 'jordan.patel@example.edu', 9),
      visitor('v-103', 'Sam Okafor', 'sam.okafor@example.edu', 3),
    ],
    served: [
      { ...visitor('v-100', 'Riley Gomez', 'riley.gomez@example.edu', 25), servedAt: minutesAgo(16) },
    ],
  },
  {
    id: 'it-help-desk',
    name: 'IT Help Desk',
    description: 'Password resets, Wi-Fi access, and laptop troubleshooting.',
    priority: 'high',
    location: 'Library · First floor',
    category: 'Technology',
    averageMinutes: 6,
    openUntil: '6:00 PM',
    isOpen: true,
    queue: [visitor('v-201', 'Morgan Lee', 'morgan.lee@example.edu', 5)],
    served: [],
  },
  {
    id: 'health-clinic',
    name: 'Health Clinic',
    description: 'Walk-in appointments, immunizations, and wellness check-ins.',
    priority: 'high',
    location: 'Wellness Building · Suite 20',
    category: 'Health & wellness',
    averageMinutes: 5,
    openUntil: '4:30 PM',
    isOpen: true,
    queue: [
      visitor('v-301', 'Taylor Brooks', 'taylor.brooks@example.edu', 31),
      visitor('v-302', 'Casey Nguyen', 'casey.nguyen@example.edu', 24),
      visitor('v-303', 'Jamie Rivera', 'jamie.rivera@example.edu', 19),
      visitor('v-304', 'Drew Kim', 'drew.kim@example.edu', 12),
      visitor('v-305', 'Quinn Alvarez', 'quinn.alvarez@example.edu', 8),
      visitor('v-306', 'Reese Thompson', 'reese.thompson@example.edu', 2),
    ],
    served: [],
  },
  {
    id: 'financial-aid',
    name: 'Financial Aid Office',
    description: 'Scholarship paperwork, loan counseling, and payment plans.',
    priority: 'low',
    location: 'Welcome Center · Room 210',
    category: 'Campus support',
    averageMinutes: 8,
    openUntil: '4:00 PM',
    isOpen: false,
    queue: [],
    served: [],
  },
];

function normalizeService(service) {
  return {
    ...service,
    description: service.description || '',
    priority: priorityLevels.includes(service.priority) ? service.priority : 'medium',
    averageMinutes: Number(service.averageMinutes) || 1,
    isOpen: service.isOpen !== false,
    queue: Array.isArray(service.queue) ? service.queue : [],
    served: Array.isArray(service.served) ? service.served : [],
  };
}

function cloneDefaults() {
  return defaultServices.map(service => normalizeService(JSON.parse(JSON.stringify(service))));
}

export function loadServices() {
  try {
    const value = JSON.parse(localStorage.getItem(servicesKey));
    if (Array.isArray(value) && value.length) return value.map(normalizeService);
  } catch {
    // Fall through to the seeded demo services.
  }
  const seeded = cloneDefaults();
  saveServices(seeded);
  return seeded;
}

export function saveServices(services) {
  localStorage.setItem(servicesKey, JSON.stringify(services));
  window.dispatchEvent(new Event(servicesUpdatedEvent));
}

export function subscribeToServices(callback) {
  window.addEventListener(servicesUpdatedEvent, callback);
  return () => window.removeEventListener(servicesUpdatedEvent, callback);
}

export function resetServices() {
  const seeded = cloneDefaults();
  saveServices(seeded);
  return seeded;
}

export function findService(services, serviceId) {
  return services.find(service => service.id === serviceId) || null;
}

export function waitingCount(service) {
  return service?.queue?.length || 0;
}

export function estimateWait(service, position) {
  return Math.max(0, position - 1) * (service?.averageMinutes || 0);
}

export function queueWaitMinutes(service) {
  return waitingCount(service) * (service?.averageMinutes || 0);
}

export function getActiveQueue() {
  try {
    const value = JSON.parse(localStorage.getItem(activeQueueKey));
    if (!value?.serviceId || !value?.entryId) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveActiveQueue(queue) {
  if (queue) localStorage.setItem(activeQueueKey, JSON.stringify(queue));
  else localStorage.removeItem(activeQueueKey);
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function updateService(services, serviceId, updater) {
  return services.map(service => (service.id === serviceId ? updater(service) : service));
}

export function joinService(services, serviceId, person) {
  const entry = { id: uniqueId('v'), name: person.name, email: person.email, joinedAt: new Date().toISOString(), isMember: true };
  const service = findService(services, serviceId);
  const position = waitingCount(service) + 1;
  const nextServices = updateService(services, serviceId, current => ({ ...current, queue: [...current.queue, entry] }));
  const activeQueue = { serviceId, entryId: entry.id, initialPosition: position, joinedAt: entry.joinedAt };
  return { services: nextServices, activeQueue, position };
}

export function leaveService(services, serviceId, entryId) {
  return updateService(services, serviceId, current => ({ ...current, queue: current.queue.filter(item => item.id !== entryId) }));
}

export function serveNext(services, serviceId) {
  const service = findService(services, serviceId);
  if (!service || !service.queue.length) return { services, served: null };
  const [head, ...rest] = service.queue;
  const servedEntry = { ...head, servedAt: new Date().toISOString() };
  const nextServices = updateService(services, serviceId, current => ({
    ...current,
    queue: rest,
    served: [servedEntry, ...current.served].slice(0, 6),
  }));
  return { services: nextServices, served: servedEntry };
}

export function removeVisitor(services, serviceId, visitorId) {
  const service = findService(services, serviceId);
  const removed = service?.queue.find(item => item.id === visitorId) || null;
  return { services: leaveService(services, serviceId, visitorId), removed };
}

export function moveVisitor(services, serviceId, visitorId, direction) {
  return updateService(services, serviceId, current => {
    const index = current.queue.findIndex(item => item.id === visitorId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.queue.length) return current;
    const queue = [...current.queue];
    [queue[index], queue[target]] = [queue[target], queue[index]];
    return { ...current, queue };
  });
}

export function statusForPosition(position) {
  return position <= 2 ? 'almost-ready' : 'waiting';
}

export function resolveQueue(services, activeQueue) {
  if (!activeQueue) return null;
  const service = findService(services, activeQueue.serviceId);
  if (!service) return null;
  const index = service.queue.findIndex(item => item.id === activeQueue.entryId);
  if (index >= 0) {
    const position = index + 1;
    return { ...activeQueue, service, position, status: statusForPosition(position), waitMinutes: estimateWait(service, position) };
  }
  const served = service.served.some(item => item.id === activeQueue.entryId);
  return { ...activeQueue, service, position: 0, status: served ? 'served' : 'removed', waitMinutes: 0 };
}

export function createServiceId(name, services) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'service';
  let candidate = base;
  let counter = 2;
  while (services.some(service => service.id === candidate)) candidate = `${base}-${counter++}`;
  return candidate;
}
