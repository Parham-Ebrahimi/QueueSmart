const activeQueueKey = 'queuesmart-active-queue';
const servicesKey = 'queuesmart-services';
const servicesUpdatedEvent = 'queuesmart-services-updated';

export const priorityLevels = ['low', 'medium', 'high'];

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
    queue: [],
    served: [],
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
    queue: [],
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

// Users only receive a count from the API (not other people's entries), so prefer it when present.
export function waitingCount(service) {
  return service?.waitingCount ?? service?.queue?.length ?? 0;
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

export function statusForPosition(position) {
  return position <= 2 ? 'almost-ready' : 'waiting';
}

// Combines the locally remembered active queue with the latest entry from GET /api/queues/:id/entries/:entryId.
export function resolveQueue(services, activeQueue, entry) {
  if (!activeQueue) return null;
  const service = findService(services, activeQueue.serviceId);
  if (!service) return null;
  const current = entry?.id === activeQueue.entryId ? entry : null;
  if (current && current.status !== 'waiting') {
    return { ...activeQueue, service, position: 0, status: current.status === 'served' ? 'served' : 'removed', waitMinutes: 0 };
  }
  const position = current?.position || activeQueue.initialPosition;
  const waitMinutes = current ? current.estimatedWaitMinutes : estimateWait(service, position);
  return { ...activeQueue, service, position, status: statusForPosition(position), waitMinutes };
}

function toVisitor(entry) {
  return { id: entry.id, name: entry.name, email: entry.email, priority: entry.priority, joinedAt: entry.joinedAt, isMember: true };
}

// Merges queue views from the API into the matching services. Services without a view are left as they are.
export function applyQueueViews(services, views) {
  return services.map(service => {
    const view = views.find(item => item.serviceId === service.id);
    if (!view) return service;
    return {
      ...service,
      waitingCount: view.waitingCount,
      queue: (view.entries || []).map(toVisitor),
      served: (view.recentlyServed || []).map(entry => ({ ...toVisitor(entry), servedAt: entry.endedAt })),
    };
  });
}

export function createServiceId(name, services) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'service';
  let candidate = base;
  let counter = 2;
  while (services.some(service => service.id === candidate)) candidate = `${base}-${counter++}`;
  return candidate;
}
