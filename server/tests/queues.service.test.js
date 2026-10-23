import { describe, expect, it } from 'vitest';
import { insertionIndex } from '../src/modules/queues/queues.service.js';
import { validateJoin, validateMove } from '../src/modules/queues/queues.validation.js';

const line = priorities => priorities.map((priority, index) => ({ id: `e${index}`, priority }));

describe('insertionIndex', () => {
  it('appends to an empty queue', () => {
    expect(insertionIndex([], 'normal')).toBe(0);
    expect(insertionIndex([], 'high')).toBe(0);
  });

  it('puts a normal visitor at the back', () => {
    expect(insertionIndex(line(['high', 'normal', 'normal']), 'normal')).toBe(3);
  });

  it('puts a high-priority visitor behind other high-priority visitors but ahead of normal ones', () => {
    expect(insertionIndex(line(['high', 'high', 'normal']), 'high')).toBe(2);
    expect(insertionIndex(line(['normal', 'normal']), 'high')).toBe(0);
  });

  it('treats a missing priority as normal', () => {
    expect(insertionIndex(line([undefined, 'normal']), 'normal')).toBe(2);
  });
});

describe('validateJoin', () => {
  it('defaults to normal priority with no name', () => {
    expect(validateJoin(undefined)).toEqual({ errors: {}, value: { priority: 'normal' } });
  });

  it('trims the name and keeps a valid priority', () => {
    expect(validateJoin({ name: '  Ava  ', priority: 'high' }).value).toEqual({ name: 'Ava', priority: 'high' });
  });

  it('ignores a blank name', () => {
    expect(validateJoin({ name: '   ' }).value).toEqual({ priority: 'normal' });
  });
});

describe('validateMove', () => {
  it.each([-1, 1])('accepts direction %i', direction => {
    expect(validateMove({ direction })).toEqual({ errors: {}, value: { direction } });
  });

  it.each([0, 2, '1', null])('rejects direction %j', direction => {
    expect(validateMove({ direction }).errors).toHaveProperty('direction');
  });
});
