import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { PERSONNEL_KINDS, PERSONNEL_KIND_LABELS, parsePersonnelKind, personnelLists, personnelTabs } from './personnel';

// Назначение явное: не выводится из услуг и ролей доступа
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

// Вкладки экрана «Специалисты»: подписи и пустая «Не назначено» не показывается
describe('personnel tabs', () => {
  it('counts tabs and hides empty unassigned tab', () => {
    const tabs = personnelTabs([
      { id: 'a', personnelKind: 'SPECIALIST' as const },
      { id: 'b', personnelKind: 'BOTH' as const },
      { id: 'c', personnelKind: 'OTHER_EMPLOYEE' as const },
    ]);
    assert.deepEqual(tabs.map((t) => [t.key, t.count]), [['specialists', 2], ['employees', 2]]);
  });
  it('puts unassigned tab first with its count while legacy rows exist', () => {
    // после выпуска у всех старых записей назначения нет: первой открывается вкладка, где нужно действие
    const tabs = personnelTabs([{ id: 'd', personnelKind: null }, { id: 'e', personnelKind: 'SPECIALIST' as const }]);
    assert.deepEqual(tabs.map((t) => [t.key, t.label, t.count]), [
      ['unassigned', 'Не назначено (1)', 1],
      ['specialists', 'Специалисты', 1],
      ['employees', 'Другие сотрудники', 0],
    ]);
  });
  it('labels every kind in Russian', () => {
    assert.deepEqual(PERSONNEL_KINDS.map((k) => PERSONNEL_KIND_LABELS[k]), ['Специалист', 'Другой сотрудник', 'Оба']);
  });
});
