const activeQueueKey = 'queuesmart-active-queue';

export const mockServices = [
  {
    id: 'student-services',
    name: 'Student Services',
    location: 'Campus Center · Room 104',
    category: 'Campus support',
    waiting: 3,
    averageMinutes: 4,
    openUntil: '5:00 PM',
  },
  {
    id: 'it-help-desk',
    name: 'IT Help Desk',
    location: 'Library · First floor',
    category: 'Technology',
    waiting: 1,
    averageMinutes: 6,
    openUntil: '6:00 PM',
  },
  {
    id: 'health-clinic',
    name: 'Health Clinic',
    location: 'Wellness Building · Suite 20',
    category: 'Health & wellness',
    waiting: 6,
    averageMinutes: 5,
    openUntil: '4:30 PM',
  },
];

export function getActiveQueue() {
  try {
    const value = JSON.parse(localStorage.getItem(activeQueueKey));
    if (!value?.serviceId || !Number.isInteger(value.position)) return null;
    if (value.status === 'ready') return { ...value, position: 1, status: 'almost-ready' };
    return value;
  } catch {
    return null;
  }
}

export function saveActiveQueue(queue) {
  if (queue) localStorage.setItem(activeQueueKey, JSON.stringify(queue));
  else localStorage.removeItem(activeQueueKey);
}

export function findService(serviceId) {
  return mockServices.find(service => service.id === serviceId);
}

export function createQueueEntry(service) {
  const position = service.waiting + 1;
  return {
    serviceId: service.id,
    position,
    initialPosition: position,
    joinedAt: new Date().toISOString(),
    status: position <= 2 ? 'almost-ready' : 'waiting',
  };
}

export function advanceQueue(queue) {
  if (!queue || queue.status === 'served') return queue;
  if (queue.position <= 1) return { ...queue, position: 0, status: 'served' };
  const position = queue.position - 1;
  return { ...queue, position, status: position <= 2 ? 'almost-ready' : 'waiting' };
}
