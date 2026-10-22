/**
 * «Личный кабинет» (роль EMPLOYEE, решение владельца 20.10.2026) на настоящем HTTP: после входа стойка выбирает филиал
 * через `GET /branches` (`app/scope/resolve`). Живой аудит 21.10.2026: у EMPLOYEE этот маршрут закрыт правом `desk`,
 * выбор филиала не происходит, и `/my-work` показывает «Кабинет недоступен» любому мастеру. Тест утверждает рабочее
 * поведение: свой филиал в списке есть, чужих нет, кабинет открывается по своему указателю, рабочие разделы закрыты.
 */
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { hashPassword } from '@pms/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildScopeWorld, type ScopeWorld } from './scope-world';

const ENABLED = !!process.env.DATABASE_URL;

describe.skipIf(!ENABLED)('«Личный кабинет»: выбор своего филиала и кабинет (HTTP + настоящая база + RLS)', () => {
  let w: ScopeWorld;
  let token = '';
  let userId = '';
  let employeeId = '';
  const pointer = () => `business=${w.ids.bea};location=${w.ids.lb}`;
  const get = (path: string, scope?: string) => {
    let req = request(w.app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);
    if (scope) req = req.set('X-Wetop-Scope', scope);
    return req;
  };

  beforeAll(async () => {
    w = await buildScopeWorld();
    const password = randomBytes(24).toString('base64url') + 'aA1!';
    const user = await w.db.user.create({
      data: {
        email: `s2-portal-${w.ids.m}@example.invalid`,
        emailVerifiedAt: new Date(),
        passwordHash: await hashPassword(password),
        name: 'Портал Мастер',
      },
    });
    userId = user.id;
    await w.db.membership.create({ data: { organizationId: w.ids.orgA!, userId, role: 'EMPLOYEE' } });
    await w.db.membershipScope.create({
      data: { organizationId: w.ids.orgA!, userId, role: 'EMPLOYEE', businessId: w.ids.bea!, locationId: w.ids.lb! },
    });
    const employee = await w.db.employee.create({
      data: { businessId: w.ids.bea!, name: 'Портал Мастер', userId, personnelKind: 'SPECIALIST' },
    });
    employeeId = employee.id;
    await w.db.employeeLocation.create({ data: { employeeId, locationId: w.ids.lb! } });
    const login = await request(w.app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password });
    expect(login.status, JSON.stringify(login.body)).toBe(201);
    token = login.body.token as string;
  }, 180_000);

  afterAll(async () => {
    if (w) {
      await w.db.employeeLocation.deleteMany({ where: { employeeId } }).catch(() => undefined);
      await w.db.employee.deleteMany({ where: { id: employeeId } }).catch(() => undefined);
      await w.db.session.deleteMany({ where: { userId } }).catch(() => undefined);
      await w.db.membershipScope.deleteMany({ where: { userId } }).catch(() => undefined);
      await w.db.membership.deleteMany({ where: { userId } }).catch(() => undefined);
      await w.db.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
      await w.close();
    }
  }, 60_000);

  it('GET /branches без указателя отдаёт ровно свой филиал салона: стойка выберет его сама', async () => {
    const r = await get('/branches');
    expect(r.status, r.text.slice(0, 200)).toBe(200);
    const items = (r.body as { items: Array<{ locationId: string; vertical: string }> }).items;
    expect(items.map((i) => i.locationId)).toEqual([w.ids.lb]);
    expect(items[0]!.vertical).toBe('BEAUTY');
    // карточки бизнесов и сводки организации «Личному кабинету» не нужны
    expect(r.text).not.toContain('S2P1');
    expect(r.text).not.toContain('S2FOO');
  });

  it('GET /employee-portal/me по своему указателю открывает свой кабинет', async () => {
    const r = await get('/employee-portal/me', pointer());
    expect(r.status, r.text.slice(0, 200)).toBe(200);
    expect((r.body as { employee: { id: string }; access: string }).employee.id).toBe(employeeId);
    expect((r.body as { access: string }).access).toBe('SELF');
  });

  it('GET /auth/me без указателя отвечает 200 с ролью EMPLOYEE: стойка знает, что это личный кабинет', async () => {
    const r = await get('/auth/me');
    expect(r.status, r.text.slice(0, 200)).toBe(200);
    expect((r.body as { user?: { role?: string } }).user?.role).toBe('EMPLOYEE');
  });

  it('GET /auth/me по своему указателю подтверждает салон и филиал', async () => {
    const r = await get('/auth/me', pointer());
    expect(r.status).toBe(200);
    const ctx = (r.body as { context?: { businessId?: string; locationId?: string; vertical?: string } }).context;
    expect(ctx?.businessId).toBe(w.ids.bea);
    expect(ctx?.locationId).toBe(w.ids.lb);
    expect(ctx?.vertical).toBe('BEAUTY');
  });

  it.each(['/branches/overview?from=2026-10-01&to=2026-10-31', '/team/members', '/beauty/customers'])(
    'рабочий раздел %s остаётся закрытым',
    async (path) => {
      const r = await get(path, pointer());
      expect([403, 404]).toContain(r.status);
    },
  );
});
