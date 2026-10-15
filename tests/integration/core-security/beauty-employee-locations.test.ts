import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import { BeautyModule } from '../../../apps/api/src/beauty/beauty.module';
import { bootApp, call, makeClients, url } from './harness';
import { seedBeautyFoodWorld, type BeautyFoodWorld } from './world';

/**
 * CORE-SECURITY-FIX-01, F4 (CORE-01 U2 B-6): `PUT /beauty/employees/:id/locations` принимал `locationIds` из тела и
 * давал менеджеру одного филиала снять мастера с филиала, который ему не назначен, вместе с графиком мастера там.
 *
 * Правило после правки: менять привязки мастера можно только внутри своей области (назначения вызывающего).
 *   - добавить мастера в филиал вне области нельзя (403);
 *   - привязки мастера к филиалам вне области не снимаются и не меняются, график там не стирается;
 *     филиал вне области в теле, где мастер и так работает, ничего не меняет (форма отдаёт список целиком);
 *   - пустой список снимает мастера только с филиалов внутри области;
 *   - неограниченный человек и владелец ведут себя как раньше.
 */
describe.skipIf(!url)('F4: привязки мастера к филиалам только внутри области вызывающего', () => {
  let admin: Db;
  let tenant: Db;
  let app: INestApplication;
  let base = '';
  let w: BeautyFoodWorld;
  const ids = () => w.ids;
  const bl1 = () => ({ businessId: ids().bz!, locationId: ids().bl1! });
  const mon9to18 = {
    weekday: 1,
    timeFrom: new Date('1970-01-01T09:00:00Z'),
    timeTo: new Date('1970-01-01T18:00:00Z'),
  };

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    w = await seedBeautyFoodWorld(admin);
    ({ app, base } = await bootApp([BeautyModule], tenant, w.actors));
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await tenant?.$disconnect();
    await admin?.$disconnect();
  });

  /** Свежий мастер бизнеса BZ в перечисленных филиалах, с графиком в каждом (пн 09:00-18:00) */
  async function master(businessId: string, locationIds: string[]): Promise<string> {
    const e = await admin.employee.create({ data: { businessId, name: 'CSF F4 master' } });
    for (const locationId of locationIds) {
      await admin.employeeLocation.create({ data: { employeeId: e.id, locationId } });
      await admin.workingHours.create({ data: { employeeId: e.id, locationId, ...mon9to18 } });
    }
    return e.id;
  }
  const bound = async (employeeId: string) =>
    (await admin.employeeLocation.findMany({ where: { employeeId } }))
      .map((r) => r.locationId)
      .sort();
  const hoursAt = (employeeId: string, locationId: string) =>
    admin.workingHours.count({ where: { employeeId, locationId } });
  const put = (actor: string, employeeId: string, locationIds: string[], scope = bl1()) =>
    call(base, actor, 'PUT', `/beauty/employees/${employeeId}/locations`, scope, { locationIds });

  // ───────── разрешено, как раньше ─────────

  it('ALLOW: владелец снимает мастера с BL2 при указателе на BL1, график BL2 уходит вместе с филиалом', async () => {
    const e = await master(ids().bz!, [ids().bl1!, ids().bl2!]);
    const r = await put('owner', e, [ids().bl1!]);
    expect(r.status, r.text).toBe(200);
    expect(await bound(e)).toEqual([ids().bl1!]);
    expect(await hoursAt(e, ids().bl2!)).toBe(0);
    expect(await hoursAt(e, ids().bl1!)).toBe(1);
  });

  it('ALLOW: неограниченный менеджер ведёт себя как раньше (снимает и добавляет любые филиалы бизнеса)', async () => {
    const e = await master(ids().bz!, [ids().bl2!]);
    const r = await put('orgMgr', e, [ids().bl1!]);
    expect(r.status, r.text).toBe(200);
    expect(await bound(e)).toEqual([ids().bl1!]);
    expect(await hoursAt(e, ids().bl2!)).toBe(0);
  });

  it('ALLOW: менеджер, назначенный на весь бизнес BZ, меняет привязки в обоих филиалах бизнеса', async () => {
    const e = await master(ids().bz!, [ids().bl1!, ids().bl2!]);
    const r = await put('mgrBz', e, [ids().bl2!]);
    expect(r.status, r.text).toBe(200);
    expect(await bound(e)).toEqual([ids().bl2!]);
    expect(await hoursAt(e, ids().bl1!)).toBe(0);
  });

  it('ALLOW: менеджер филиала BL1 снимает мастера с BL1 и добавляет его в BL1 (свой филиал)', async () => {
    const e = await master(ids().bz!, [ids().bl1!]);
    const r1 = await put('mgrBl1', e, []);
    expect(r1.status, r1.text).toBe(200);
    expect(await bound(e)).toEqual([]);
    expect(await hoursAt(e, ids().bl1!)).toBe(0);
    const r2 = await put('mgrBl1', e, [ids().bl1!]);
    expect(r2.status, r2.text).toBe(200);
    expect(await bound(e)).toEqual([ids().bl1!]);
  });

  // ───────── запрещено: филиал вне области ─────────

  it('B-6 DENY: менеджер BL1 не снимает мастера с неназначенного BL2 и не стирает график BL2', async () => {
    const e = await master(ids().bz!, [ids().bl2!]);
    const r = await put('mgrBl1', e, [ids().bl1!]);
    expect(r.status, r.text).toBe(200); // BL1 в области: мастер добавлен сюда
    // привязка к BL2 и график BL2 не тронуты
    expect(await bound(e)).toEqual([ids().bl1!, ids().bl2!].sort());
    expect(await hoursAt(e, ids().bl2!)).toBe(1);
  });

  it('DENY: пустой список от менеджера BL1 не снимает мастера с BL2 (снимает только с BL1)', async () => {
    const e = await master(ids().bz!, [ids().bl1!, ids().bl2!]);
    const r = await put('mgrBl1', e, []);
    expect(r.status, r.text).toBe(200);
    expect(await bound(e)).toEqual([ids().bl2!]);
    expect(await hoursAt(e, ids().bl2!)).toBe(1);
    expect(await hoursAt(e, ids().bl1!)).toBe(0);
  });

  it('DENY: замена списка от менеджера BL1 не затрагивает BL2 (мастер был в обоих, в теле только BL1)', async () => {
    const e = await master(ids().bz!, [ids().bl1!, ids().bl2!]);
    const r = await put('mgrBl1', e, [ids().bl1!]);
    expect(r.status, r.text).toBe(200);
    expect(await bound(e)).toEqual([ids().bl1!, ids().bl2!].sort());
    expect(await hoursAt(e, ids().bl2!)).toBe(1);
  });

  it('DENY: менеджер BL1 не добавляет мастера в BL2 (403), состояние не меняется', async () => {
    const e = await master(ids().bz!, [ids().bl1!]);
    const r = await put('mgrBl1', e, [ids().bl1!, ids().bl2!]);
    expect(r.status, r.text).toBe(403);
    expect(await bound(e)).toEqual([ids().bl1!]);
    expect(await hoursAt(e, ids().bl1!)).toBe(1);
  });

  it('DENY: одни только чужие для менеджера BL1 филиалы (BL2) в теле: 403, привязки целы', async () => {
    const e = await master(ids().bz!, [ids().bl1!]);
    const r = await put('mgrBl1', e, [ids().bl2!]);
    expect(r.status, r.text).toBe(403);
    expect(await bound(e)).toEqual([ids().bl1!]);
    expect(await hoursAt(e, ids().bl1!)).toBe(1);
  });

  it('ALLOW: форма отдаёт список целиком, филиал BL2 вне области уже привязан: ничего лишнего не меняется', async () => {
    const e = await master(ids().bz!, [ids().bl1!, ids().bl2!]);
    const r = await put('mgrBl1', e, [ids().bl1!, ids().bl2!]);
    expect(r.status, r.text).toBe(200);
    expect(await bound(e)).toEqual([ids().bl1!, ids().bl2!].sort());
    expect(await hoursAt(e, ids().bl2!)).toBe(1);
  });

  // ───────── запрещено: другой бизнес, другая вертикаль, другая организация ─────────

  it('DENY: филиал другого Beauty-бизнеса в теле: 400 (как раньше), привязки целы', async () => {
    const e = await master(ids().bz!, [ids().bl1!]);
    for (const actor of ['owner', 'mgrBl1']) {
      const r = await put(actor, e, [ids().bl1!, ids().bl3!]);
      expect([400, 403], `${actor}: ${r.text}`).toContain(r.status);
    }
    expect(await bound(e)).toEqual([ids().bl1!]);
  });

  it('DENY: филиал ресторана (другая вертикаль) в теле: отказ, привязки целы', async () => {
    const e = await master(ids().bz!, [ids().bl1!]);
    for (const actor of ['owner', 'mgrBl1']) {
      const r = await put(actor, e, [ids().bl1!, ids().fl1!]);
      expect([400, 403], `${actor}: ${r.text}`).toContain(r.status);
    }
    expect(await bound(e)).toEqual([ids().bl1!]);
  });

  it('DENY: мастер другого Beauty-бизнеса: 404 для менеджера BL1', async () => {
    const r = await put('mgrBl1', ids().eBz2!, [ids().bl1!]);
    expect(r.status, r.text).toBe(404);
    expect(await bound(ids().eBz2!)).toEqual([ids().bl3!]);
  });

  it('DENY: владелец чужой организации не меняет привязки нашего мастера', async () => {
    const e = await master(ids().bz!, [ids().bl1!]);
    const foreign = { businessId: ids().fbz!, locationId: ids().fbl1! };
    const r = await put('foreignOwner', e, [ids().fbl1!], foreign);
    expect([403, 404, 400], r.text).toContain(r.status);
    expect(await bound(e)).toEqual([ids().bl1!]);
    // и чужой указатель на наш филиал тоже не открывает
    const r2 = await put('foreignOwner', e, [], bl1());
    expect([403, 404], r2.text).toContain(r2.status);
    expect(await bound(e)).toEqual([ids().bl1!]);
  });
});
