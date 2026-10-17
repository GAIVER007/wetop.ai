/**
 * Единый контур входа (17.10.2026), основной контур WETOP по HTTP с настоящими замками и RLS:
 * - повтор и продолжение настройки бизнеса не заводят новых бизнесов и филиалов, переименование не меняет их номер;
 * - понижение роли в организации действует на уже открытую сессию со следующего запроса.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildScopeWorld, type ScopeWorld } from './scope-world';

describe.skipIf(!process.env.DATABASE_URL)('access continuity over HTTP', () => {
  let w: ScopeWorld;
  beforeAll(async () => {
    w = await buildScopeWorld();
  }, 180_000);
  afterAll(async () => {
    await w?.close();
  }, 60_000);

  const census = async () => ({
    businesses: (await w.db.business.findMany({ where: { organizationId: w.ids.orgA! }, select: { id: true } }))
      .map((b) => b.id).sort(),
    locations: (await w.db.location.findMany({ where: { business: { organizationId: w.ids.orgA! } }, select: { id: true } }))
      .map((l) => l.id).sort(),
    organizations: await w.db.organization.count({ where: { id: { in: [w.ids.orgA!, w.ids.orgB!] } } }),
  });

  it('repeated salon setup keeps the same business and branch ids and creates nothing', async () => {
    const before = await census();
    const draft = { businessName: `S2BEA renamed ${w.ids.m}`, locationName: 'Салон на Абая', timezone: 'Asia/Almaty', currency: 'KZT' };
    const status = await w.call('OWNER', 'get', '/onboarding', { scope: 'BEA+LB' });
    expect(status.status, status.text.slice(0, 160)).toBe(200);
    let updatedAt = (status.json as { updatedAt: string | null }).updatedAt;
    for (let i = 0; i < 2; i += 1) {
      const saved = await w.call('OWNER', 'post', '/onboarding', {
        scope: 'BEA+LB', body: { action: 'apply-profile', draft, updatedAt },
      });
      expect(saved.status, saved.text.slice(0, 160)).toBe(201);
      updatedAt = (saved.json as { updatedAt: string | null }).updatedAt;
    }
    // устаревший черновик из второй вкладки не перезаписывает, а отказывает
    const stale = await w.call('OWNER', 'post', '/onboarding', {
      scope: 'BEA+LB', body: { action: 'apply-profile', draft: { ...draft, businessName: 'Чужая вкладка' }, updatedAt: null },
    });
    expect(stale.status).toBe(409);

    expect(await census()).toEqual(before);
    const business = await w.db.business.findUniqueOrThrow({ where: { id: w.ids.bea! } });
    expect(business.name).toBe(draft.businessName);
  });

  it('a demoted manager loses manager-only access in the session that is already open', async () => {
    const mgr = await w.db.user.findUniqueOrThrow({ where: { email: `s2-orgmgr-${w.ids.m}@example.invalid` } });
    const before = await w.call('ORG_MGR', 'get', '/inventory/categories', { scope: 'HOT+H1' });
    expect(before.status, before.text.slice(0, 160)).toBe(200);

    const demoted = await w.call('OWNER', 'patch', `/auth/members/${mgr.id}`, { body: { role: 'STAFF' } });
    expect(demoted.status, demoted.text.slice(0, 160)).toBe(200);

    const after = await w.call('ORG_MGR', 'get', '/inventory/categories', { scope: 'HOT+H1' });
    expect(after.status).toBe(403);
    // работа смены осталась: администратор по-прежнему видит свой филиал
    const desk = await w.call('ORG_MGR', 'get', '/branches');
    expect(desk.status).toBe(200);
  });
});
