import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { parsePersonnelKind, personnelLists } from './personnel';

// Assignment is explicit metadata, never inferred from services or access roles.
describe('explicit personnel assignment', () => {
  it('accepts the three exact owner-approved assignments', () => {
    for (const kind of ['SPECIALIST', 'OTHER_EMPLOYEE', 'BOTH']) {
      assert.equal(parsePersonnelKind(kind), kind);
    }
  });
  it('rejects roles, coercion and malformed command values', () => {
    const values: unknown[] = [
      null, undefined, '', 'STAFF', 'OWNER', 'specialist', 1, true,
      ['SPECIALIST'], { toString() { throw new Error('must not coerce'); } },
    ];
    for (const value of values) assert.throws(() => parsePersonnelKind(value), RangeError);
  });
  it('keeps an explicitly assigned specialist with no services', () => {
    const person = { id: 'a', personnelKind: 'SPECIALIST' as const, serviceIds: [] };
    const lists = personnelLists([person]);
    assert.deepEqual(lists.specialists, [person]);
    assert.deepEqual(lists.employees, []);
    assert.deepEqual(lists.unassigned, []);
  });
  it('does not turn another employee into a specialist through services or roles', () => {
    const person = {
      id: 'b', personnelKind: 'OTHER_EMPLOYEE' as const, serviceIds: ['service'], role: 'OWNER',
    };
    const lists = personnelLists([person]);
    assert.deepEqual(lists.specialists, []);
    assert.deepEqual(lists.employees, [person]);
  });
  it('shows both as the same employee object in both lists', () => {
    const person = { id: 'c', personnelKind: 'BOTH' as const };
    const lists = personnelLists([person]);
    assert.equal(lists.specialists[0], person);
    assert.equal(lists.employees[0], person);
    assert.equal(lists.specialists[0], lists.employees[0]);
    assert.deepEqual(lists.unassigned, []);
  });
  it('keeps legacy unknown assignments visible and separate without guessing', () => {
    const person = { id: 'd', personnelKind: null, serviceIds: ['service'], role: 'MANAGER' };
    const lists = personnelLists([person]);
    assert.deepEqual(lists.unassigned, [person]);
    assert.deepEqual(lists.specialists, []);
    assert.deepEqual(lists.employees, []);
  });
  it('does not mutate frozen input or employee records', () => {
    const person = Object.freeze({ id: 'e', personnelKind: 'BOTH' as const });
    const input = Object.freeze([person]);
    personnelLists(input);
    assert.deepEqual(input, [person]);
  });
  it('does not silently classify a malformed server value', () => {
    const input = [{ id: 'bad', personnelKind: 'ADMIN' as unknown as 'SPECIALIST' }];
    assert.throws(() => personnelLists(input), RangeError);
  });
  it('returns empty lists for an authoritative empty response', () => {
    assert.deepEqual(personnelLists([]), { specialists: [], employees: [], unassigned: [] });
  });
});
