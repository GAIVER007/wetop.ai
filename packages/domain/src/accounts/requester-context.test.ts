import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from './permissions';
import { accountStatusOf, buildRequesterContext } from './requester-context';

const now = new Date('2026-09-29T12:00:00Z');
const organization = { name: 'Гостиница А', status: 'ACTIVE' as const, trialEndsAt: null };
const businesses = [
  { name: 'Luxx Hotels', vertical: 'HOSPITALITY', locations: [{ name: 'Алматы' }] },
];
const base = { userRef: 'u_abc', role: 'OWNER' as const, platformAdmin: false, organization, businesses, now };

describe('состояние аккаунта (S4)', () => {
  it('ACTIVE — писать можно, причины нет', () => {
    expect(accountStatusOf(organization, now)).toEqual({ status: 'ACTIVE', canMutate: true, trialEndsAt: null, reasonCode: null });
  });
  it('TRIAL в срок — писать можно, срок виден', () => {
    const trialEndsAt = new Date('2026-10-05T00:00:00Z');
    expect(accountStatusOf({ ...organization, status: 'TRIAL', trialEndsAt }, now)).toEqual({
      status: 'TRIAL',
      canMutate: true,
      trialEndsAt: trialEndsAt.toISOString(),
      reasonCode: null,
    });
  });
  it('TRIAL с вышедшим сроком — READ_ONLY по причине TRIAL_ENDED, даже если в базе ещё TRIAL', () => {
    const trialEndsAt = new Date('2026-09-20T00:00:00Z');
    expect(accountStatusOf({ ...organization, status: 'TRIAL', trialEndsAt }, now)).toEqual({
      status: 'READ_ONLY',
      canMutate: false,
      trialEndsAt: trialEndsAt.toISOString(),
      reasonCode: 'TRIAL_ENDED',
    });
  });
  it('READ_ONLY, выставленный платформой, — писать нельзя, причина отдельная', () => {
    expect(accountStatusOf({ ...organization, status: 'READ_ONLY' }, now)).toMatchObject({
      status: 'READ_ONLY',
      canMutate: false,
      reasonCode: 'READ_ONLY_BY_PLATFORM',
    });
  });
  it('SUSPENDED — писать нельзя', () => {
    expect(accountStatusOf({ ...organization, status: 'SUSPENDED' }, now)).toMatchObject({
      status: 'SUSPENDED',
      canMutate: false,
      reasonCode: 'SUSPENDED',
    });
  });
});

describe('контекст запрашивающего (S4)', () => {
  it('администратор: права из таблицы роли, false остаётся false', () => {
    const ctx = buildRequesterContext({ ...base, role: 'STAFF' });
    expect(ctx.requester.role).toBe('staff');
    expect(ctx.permissions.desk).toBe(true);
    expect(ctx.permissions.settings).toBe(false);
    expect(ctx.permissions.owner).toBe(false);
    expect(Object.keys(ctx.permissions).sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });
  it('владелец: все права', () => {
    const ctx = buildRequesterContext(base);
    expect(Object.values(ctx.permissions).every(Boolean)).toBe(true);
  });
  it('без выбранного филиала область — вся организация со списком бизнесов и филиалов', () => {
    const ctx = buildRequesterContext(base);
    expect(ctx.scope).toBe('ORGANIZATION');
    expect(ctx.organization).toEqual({ displayName: 'Гостиница А' });
    expect(ctx.businesses).toEqual([
      { displayName: 'Luxx Hotels', vertical: 'HOSPITALITY', locations: [{ displayName: 'Алматы' }] },
    ]);
  });
  it('главный администратор отмечен отдельно и остаётся участником своей организации', () => {
    const ctx = buildRequesterContext({ ...base, platformAdmin: true });
    expect(ctx.requester.kind).toBe('PLATFORM_ADMIN');
    expect(buildRequesterContext(base).requester.kind).toBe('TENANT_USER');
  });
  it('списки режутся пределом, лишнее не уходит модели', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      name: `Бизнес ${i}`,
      vertical: 'HOSPITALITY',
      locations: Array.from({ length: 12 }, (_, j) => ({ name: `Филиал ${j}` })),
    }));
    const ctx = buildRequesterContext({ ...base, businesses: many });
    expect(ctx.businesses).toHaveLength(5);
    expect(ctx.businesses[0]?.locations).toHaveLength(10);
  });
  it('в ответе нет почты, телефона, ключей, внутренних id и имени человека', () => {
    const text = JSON.stringify(
      buildRequesterContext({ ...base, userRef: 'u_abc' }),
    );
    for (const banned of ['email', 'phone', 'token', 'secret', 'password', 'cookie', 'organizationId', 'userId', '@']) {
      expect(text.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });
});
