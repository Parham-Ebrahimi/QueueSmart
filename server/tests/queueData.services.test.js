import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultServices, loadServices } from '../../src/queueData.js';

function useMemoryStorage() {
  const values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
}

afterEach(() => vi.unstubAllGlobals());

describe('frontend service loading', () => {
  it('initializes demo services only when no catalog has been saved yet', () => {
    useMemoryStorage();

    expect(loadServices()).toHaveLength(defaultServices.length);
    expect(JSON.parse(localStorage.getItem('queuesmart-services'))).toHaveLength(defaultServices.length);
  });

  it('keeps an intentionally empty catalog empty', () => {
    useMemoryStorage();
    localStorage.setItem('queuesmart-services', '[]');

    expect(loadServices()).toEqual([]);
    expect(localStorage.getItem('queuesmart-services')).toBe('[]');
  });
});
