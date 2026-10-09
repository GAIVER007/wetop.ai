import { describe, expect, it } from 'vitest';
import {
  isUnrestricted,
  parseScopeAssignments,
  membershipRoleFor,
  roleAt,
  validateAssignments,
  visibleLocations,
  type ScopeAssignment,
} from './scopes';

const B1 = 'b1';
const B2 = 'b2';
const L1 = 'l1';
const L2 = 'l2';
const L3 = 'l3';
const known = [
  { businessId: B1, locationIds: [L1, L2] },
  { businessId: B2, locationIds: [L3] },
];
const loc = (id: string, businessId: string) => ({ id, businessId });

describe('roleAt: роль там, где человек хочет работать', () => {
  it('без назначений действует роль членства на всю организацию', () => {
    expect(isUnrestricted([])).toBe(true);
    expect(roleAt('STAFF', [], { businessId: B2, locationId: L3 })).toBe('STAFF');
  });

  it('владелец всюду владелец, даже если назначения где-то записаны', () => {
    const a: ScopeAssignment[] = [{ role: 'STAFF', businessId: B1, locationId: L1 }];
    expect(roleAt('OWNER', a, { businessId: B2, locationId: L3 })).toBe('OWNER');
  });

  it('назначение на филиал пускает только в него', () => {
    const a: ScopeAssignment[] = [{ role: 'STAFF', businessId: B1, locationId: L1 }];
    expect(roleAt('STAFF', a, { businessId: B1, locationId: L1 })).toBe('STAFF');
    expect(roleAt('STAFF', a, { businessId: B1, locationId: L2 })).toBeNull();
    expect(roleAt('STAFF', a, { businessId: B2, locationId: L3 })).toBeNull();
  });

  it('назначение на бизнес покрывает все его филиалы и не больше', () => {
    const a: ScopeAssignment[] = [{ role: 'MANAGER', businessId: B1, locationId: null }];
    expect(roleAt('MANAGER', a, { businessId: B1, locationId: L2 })).toBe('MANAGER');
    expect(roleAt('MANAGER', a, { businessId: B1 })).toBe('MANAGER');
    expect(roleAt('MANAGER', a, { businessId: B2, locationId: L3 })).toBeNull();
  });

  it('запрос уровня бизнеса не открывается назначением на один филиал', () => {
    const a: ScopeAssignment[] = [{ role: 'STAFF', businessId: B1, locationId: L1 }];
    expect(roleAt('STAFF', a, { businessId: B1 })).toBeNull();
  });

  it('разные роли в разных филиалах: берётся роль назначения', () => {
    const a: ScopeAssignment[] = [
      { role: 'MANAGER', businessId: B1, locationId: L1 },
      { role: 'STAFF', businessId: B2, locationId: L3 },
    ];
    expect(roleAt('MANAGER', a, { businessId: B1, locationId: L1 })).toBe('MANAGER');
    expect(roleAt('MANAGER', a, { businessId: B2, locationId: L3 })).toBe('STAFF');
  });
});

describe('visibleLocations и membershipRoleFor', () => {
  it('человек с назначением видит только свои филиалы, без назначений все', () => {
    const all = [loc(L1, B1), loc(L2, B1), loc(L3, B2)];
    const a: ScopeAssignment[] = [{ role: 'STAFF', businessId: B1, locationId: L2 }];
    expect(visibleLocations('STAFF', a, all).map((l) => l.id)).toEqual([L2]);
    expect(visibleLocations('STAFF', [], all)).toHaveLength(3);
  });

  it('роль членства при назначениях старшая из назначенных', () => {
    expect(
      membershipRoleFor(
        [
          { role: 'STAFF', businessId: B1, locationId: L1 },
          { role: 'MANAGER', businessId: B2, locationId: L3 },
        ],
        'STAFF',
      ),
    ).toBe('MANAGER');
    expect(membershipRoleFor([], 'STAFF')).toBe('STAFF');
  });
});

describe('validateAssignments', () => {
  const ok = (actor: 'OWNER' | 'MANAGER' | 'STAFF', assignments: ScopeAssignment[]) =>
    validateAssignments({ actor, assignments, known });

  it('владелец назначает управляющего и администратора в разные филиалы', () => {
    expect(
      ok('OWNER', [
        { role: 'MANAGER', businessId: B1, locationId: L1 },
        { role: 'STAFF', businessId: B2, locationId: L3 },
      ]),
    ).toEqual({ ok: true });
  });

  it('управляющий не назначает управляющих: роль выше полномочий', () => {
    const r = ok('MANAGER', [{ role: 'MANAGER', businessId: B1, locationId: L1 }]);
    expect(r.ok).toBe(false);
  });

  it('администратор не назначает никого', () => {
    expect(ok('STAFF', [{ role: 'STAFF', businessId: B1, locationId: L1 }]).ok).toBe(false);
  });

  it('чужой бизнес и филиал не своего бизнеса отклоняются', () => {
    expect(ok('OWNER', [{ role: 'STAFF', businessId: 'x', locationId: null }]).ok).toBe(false);
    expect(ok('OWNER', [{ role: 'STAFF', businessId: B1, locationId: L3 }]).ok).toBe(false);
  });

  it('повтор и филиал внутри целого бизнеса отклоняются как конфликт', () => {
    const dup: ScopeAssignment = { role: 'STAFF', businessId: B1, locationId: L1 };
    expect(ok('OWNER', [dup, dup]).ok).toBe(false);
    expect(
      ok('OWNER', [
        { role: 'MANAGER', businessId: B1, locationId: null },
        { role: 'STAFF', businessId: B1, locationId: L1 },
      ]).ok,
    ).toBe(false);
  });
});

describe('parseScopeAssignments', () => {
  const B = '11111111-1111-4111-8111-111111111111';
  const L = '22222222-2222-4222-8222-222222222222';
  it('не передано или пусто: вся организация', () => {
    expect(parseScopeAssignments(undefined)).toEqual({ ok: true, assignments: [] });
    expect(parseScopeAssignments(null)).toEqual({ ok: true, assignments: [] });
    expect(parseScopeAssignments([])).toEqual({ ok: true, assignments: [] });
  });
  it('разбирает бизнес целиком и филиал, роль в любом регистре', () => {
    expect(
      parseScopeAssignments([
        { role: 'manager', businessId: B },
        { role: 'STAFF', businessId: B, locationId: L },
      ]),
    ).toEqual({
      ok: true,
      assignments: [
        { role: 'MANAGER', businessId: B, locationId: null },
        { role: 'STAFF', businessId: B, locationId: L },
      ],
    });
  });
  it('владелец, не uuid, не список и слишком длинный список отклоняются', () => {
    for (const bad of [
      [{ role: 'OWNER', businessId: B }],
      [{ role: 'STAFF', businessId: 'x' }],
      [{ role: 'STAFF', businessId: B, locationId: 5 }],
      'staff',
      [null],
      Array.from({ length: 51 }, () => ({ role: 'STAFF', businessId: B })),
    ])
      expect(parseScopeAssignments(bad).ok).toBe(false);
  });
});
