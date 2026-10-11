import { describe, expect, it } from 'vitest';
import type { AuthAccessStructure, AuthScope } from '../../lib/api';
import { fromScopes, hasChoice, scopeSummary, toScopes } from './scope-model';

const structure: AuthAccessStructure = {
  businesses: [
    {
      id: 'b1',
      name: 'Гостиница',
      vertical: 'HOSPITALITY',
      locations: [
        { id: 'l1', name: 'Центр' },
        { id: 'l2', name: 'Север' },
      ],
    },
    { id: 'b2', name: 'Салон', vertical: 'BEAUTY', locations: [{ id: 'l3', name: 'Салон 1' }] },
  ],
};

describe('модель области доступа на экране', () => {
  it('туда и обратно без потерь', () => {
    const scopes: AuthScope[] = [
      { role: 'MANAGER', businessId: 'b1', locationId: 'l1' },
      { role: 'STAFF', businessId: 'b2', locationId: null },
    ];
    expect(toScopes(structure, fromScopes(scopes))).toEqual(scopes);
  });

  it('пустой выбор: вся организация; пустая роль: туда доступа нет', () => {
    expect(toScopes(structure, {})).toEqual([]);
    expect(toScopes(structure, { 'l:l1': '', 'l:l2': 'STAFF' })).toEqual([
      { role: 'STAFF', businessId: 'b1', locationId: 'l2' },
    ]);
  });

  it('бизнес целиком перекрывает его филиалы: филиальной строки нет', () => {
    expect(toScopes(structure, { 'b:b1': 'STAFF', 'l:l1': 'MANAGER' })).toEqual([
      { role: 'STAFF', businessId: 'b1', locationId: null },
    ]);
  });

  it('выбор нужен, только когда филиалов больше одного', () => {
    expect(hasChoice(structure)).toBe(true);
    expect(
      hasChoice({
        businesses: [
          { id: 'b', name: 'Х', vertical: 'HOSPITALITY', locations: [{ id: 'l', name: 'Х' }] },
        ],
      }),
    ).toBe(false);
    expect(hasChoice(null)).toBe(false);
  });

  it('подпись: вся организация, названия, «и ещё N»', () => {
    expect(scopeSummary([], structure)).toBe('Вся организация');
    expect(scopeSummary([{ role: 'STAFF', businessId: 'b1', locationId: 'l2' }], structure)).toBe(
      'Север',
    );
    expect(scopeSummary([{ role: 'STAFF', businessId: 'b2', locationId: null }], structure)).toBe(
      'Салон (весь)',
    );
    expect(
      scopeSummary(
        [
          { role: 'STAFF', businessId: 'b1', locationId: 'l1' },
          { role: 'STAFF', businessId: 'b1', locationId: 'l2' },
          { role: 'STAFF', businessId: 'b2', locationId: 'l3' },
        ],
        structure,
      ),
    ).toBe('Центр, Север и ещё 1');
  });
});
