import { describe, expect, it } from 'vitest';
import { parseScopePointer, resolveScope } from './scope';

/**
 * Platform P2, К1 (план `plans/platform-p2-request-context-2026-09-27.md` §4–§5, ADR-120): указатель выбора —
 * намерение человека, а не право. API каждый раз проверяет его сам; любой отказ тихо сводит scope к организации.
 */
const B_OWN = '11111111-1111-4111-8111-111111111111';
const B_OTHER_OWN = '22222222-2222-4222-8222-222222222222';
const B_FOREIGN = '33333333-3333-4333-8333-333333333333';
const B_ARCHIVED = '44444444-4444-4444-8444-444444444444';
const L_OWN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const L_OF_OTHER_BUSINESS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const L_ARCHIVED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const L_FOREIGN = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function fakeDb() {
  const businesses = [
    { id: B_OWN, organizationId: 'org-own', vertical: 'HOSPITALITY', status: 'ACTIVE' },
    { id: B_OTHER_OWN, organizationId: 'org-own', vertical: 'BEAUTY', status: 'ACTIVE' },
    { id: B_FOREIGN, organizationId: 'org-foreign', vertical: 'HOSPITALITY', status: 'ACTIVE' },
    { id: B_ARCHIVED, organizationId: 'org-own', vertical: 'HOSPITALITY', status: 'ARCHIVED' },
  ];
  const locations = [
    { id: L_OWN, businessId: B_OWN, status: 'ACTIVE' },
    { id: L_OF_OTHER_BUSINESS, businessId: B_OTHER_OWN, status: 'ACTIVE' },
    { id: L_ARCHIVED, businessId: B_OWN, status: 'ARCHIVED' },
    { id: L_FOREIGN, businessId: B_FOREIGN, status: 'ACTIVE' },
  ];
  let calls = 0;
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => row[k] === v);
  return {
    calls: () => calls,
    db: {
      business: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          calls += 1;
          const row = businesses.find((b) => match(b, where));
          return row ? { id: row.id, vertical: row.vertical } : null;
        },
      },
      location: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          calls += 1;
          const row = locations.find((l) => match(l, where));
          return row ? { id: row.id } : null;
        },
      },
    } as never,
  };
}

describe('parseScopePointer — указатель X-Wetop-Scope', () => {
  it('пусто, не строка или список — указателя нет', () => {
    expect(parseScopePointer(undefined)).toEqual({});
    expect(parseScopePointer('')).toEqual({});
    expect(parseScopePointer([`business=${B_OWN}`, `business=${B_OWN}`])).toEqual({});
  });

  it('business и location в любом порядке, с пробелами', () => {
    expect(parseScopePointer(`business=${B_OWN}`)).toEqual({ businessId: B_OWN });
    expect(parseScopePointer(` location=${L_OWN} ; business=${B_OWN} `)).toEqual({
      businessId: B_OWN,
      locationId: L_OWN,
    });
  });

  it('не UUID, чужие ключи или повтор ключа — указатель отбрасывается целиком', () => {
    expect(parseScopePointer('business=1; DROP TABLE')).toEqual({});
    expect(parseScopePointer(`business=${B_OWN};org=other`)).toEqual({});
    expect(parseScopePointer(`business=${B_OWN};business=${B_OTHER_OWN}`)).toEqual({});
  });
});

describe('resolveScope — validation matrix (план P2 §5)', () => {
  it('указателя нет — ORGANIZATION, в базу не ходим', async () => {
    const { db, calls } = fakeDb();
    expect(await resolveScope(db, 'org-own', {})).toEqual({ scope: 'ORGANIZATION' });
    expect(calls()).toBe(0);
  });

  it('свой действующий Business — BUSINESS, вертикаль из Business', async () => {
    const { db } = fakeDb();
    expect(await resolveScope(db, 'org-own', { businessId: B_OTHER_OWN })).toEqual({
      scope: 'BUSINESS',
      businessId: B_OTHER_OWN,
      vertical: 'BEAUTY',
    });
  });

  it('свой Business и его действующий филиал — LOCATION', async () => {
    const { db } = fakeDb();
    expect(await resolveScope(db, 'org-own', { businessId: B_OWN, locationId: L_OWN })).toEqual({
      scope: 'LOCATION',
      businessId: B_OWN,
      locationId: L_OWN,
      vertical: 'HOSPITALITY',
    });
  });

  it('филиал без Business — неполный указатель: ORGANIZATION, в базу не ходим', async () => {
    const { db, calls } = fakeDb();
    expect(await resolveScope(db, 'org-own', { locationId: L_OWN })).toEqual({ scope: 'ORGANIZATION' });
    expect(calls()).toBe(0);
  });

  it('чужой, несуществующий или архивный Business — ORGANIZATION, без отказа', async () => {
    const { db } = fakeDb();
    for (const businessId of [B_FOREIGN, '55555555-5555-4555-8555-555555555555', B_ARCHIVED])
      expect(await resolveScope(db, 'org-own', { businessId, locationId: L_OWN })).toEqual({
        scope: 'ORGANIZATION',
      });
  });

  it('филиал чужого или другого Business, архивный филиал — весь указатель отброшен', async () => {
    const { db } = fakeDb();
    for (const locationId of [L_OF_OTHER_BUSINESS, L_FOREIGN, L_ARCHIVED])
      expect(await resolveScope(db, 'org-own', { businessId: B_OWN, locationId })).toEqual({
        scope: 'ORGANIZATION',
      });
  });

  it('подделка мимо стойки не поднимает выше своей организации: чужая пара Business и филиала', async () => {
    const { db } = fakeDb();
    expect(await resolveScope(db, 'org-own', { businessId: B_FOREIGN, locationId: L_FOREIGN })).toEqual({
      scope: 'ORGANIZATION',
    });
  });
});
