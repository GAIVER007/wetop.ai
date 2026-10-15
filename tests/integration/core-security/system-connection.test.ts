import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { DataConnectionModule } from '../../../apps/api/src/database/connection';
import {
  actorOf,
  bootApp,
  call,
  forgetPropertyRef,
  makeClients,
  seedHotel,
  seedLocation,
  seedUser,
  url,
  type Actor,
  type Hotel,
} from './harness';

/**
 * CORE-SECURITY-FIX-01, A2 (CORE-01 U1 T06, T07): `GET /system/connection` искал гостиницу по имени
 * `Luxx Aparts`, не читая указатель и роль места: ограниченный менеджер салона или другого филиала получал имя,
 * пояс, валюту и счётчики чужого филиала. Теперь объект берётся через `propertyRef` по области запроса.
 *
 * Стенд: организация с гостиницей H1 (названа как объект установки, это и есть ловушка старого поиска по имени),
 * вторым филиалом H2 той же гостиницы, салоном BL1 и рестораном FL1; чужая организация со своей гостиницей.
 */
describe.skipIf(!url)('A2: /system/connection уважает область запроса', () => {
  let admin: Db;
  let tenant: Db;
  let app: INestApplication;
  let base = '';
  const actors = new Map<string, Actor>();
  const ids = {} as Record<string, string>;
  let h1: Hotel;
  let h2: Hotel;
  let foreignHotel: Hotel;
  const H2_NAME = `CSF second hotel ${randomUUID().slice(0, 8)}`;
  const FOREIGN_NAME = `CSF foreign hotel ${randomUUID().slice(0, 8)}`;
  const LUXX = LUXX_APARTS_PROPERTY.name;

  const at = (businessId: string, locationId: string) => ({ businessId, locationId });

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    const org = randomUUID();
    const foreignOrg = randomUUID();
    await admin.organization.create({ data: { id: org, name: `CSF-A2-${org}`, status: 'ACTIVE' } });
    await admin.organization.create({
      data: { id: foreignOrg, name: `CSF-A2-foreign-${foreignOrg}`, status: 'ACTIVE' },
    });
    h1 = await seedHotel(admin, org, LUXX, undefined, 'A');
    h2 = await seedHotel(admin, org, H2_NAME, h1.businessId, 'B');
    foreignHotel = await seedHotel(admin, foreignOrg, FOREIGN_NAME, undefined, 'F');
    const bl1 = await seedLocation(admin, org, 'CSF A2 Salon', 'BEAUTY');
    const fl1 = await seedLocation(admin, org, 'CSF A2 Rest', 'FOOD_SERVICE');
    Object.assign(ids, { bz: bl1.businessId, bl1: bl1.id, fb: fl1.businessId, fl1: fl1.id });

    const user = (role: 'OWNER' | 'MANAGER' | 'STAFF', tag: string, orgId = org) =>
      seedUser(admin, orgId, role, tag);
    actors.set('owner', actorOf(await user('OWNER', 'a2owner'), org, 'OWNER'));
    actors.set('orgMgr', actorOf(await user('MANAGER', 'a2orgmgr'), org, 'MANAGER'));
    actors.set(
      'mgrH1',
      actorOf(await user('MANAGER', 'a2mgrh1'), org, 'MANAGER', [
        { role: 'MANAGER', businessId: h1.businessId, locationId: h1.locationId },
      ]),
    );
    actors.set(
      'mgrH2',
      actorOf(await user('MANAGER', 'a2mgrh2'), org, 'MANAGER', [
        { role: 'MANAGER', businessId: h2.businessId, locationId: h2.locationId },
      ]),
    );
    actors.set(
      'mgrBl1',
      actorOf(await user('MANAGER', 'a2mgrbl1'), org, 'MANAGER', [
        { role: 'MANAGER', businessId: ids.bz!, locationId: ids.bl1! },
      ]),
    );
    actors.set(
      'mgrFl1',
      actorOf(await user('MANAGER', 'a2mgrfl1'), org, 'MANAGER', [
        { role: 'MANAGER', businessId: ids.fb!, locationId: ids.fl1! },
      ]),
    );
    actors.set(
      'foreignOwner',
      actorOf(await user('OWNER', 'a2foreign', foreignOrg), foreignOrg, 'OWNER'),
    );
    forgetPropertyRef();
    ({ app, base } = await bootApp([DataConnectionModule], tenant, actors));
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    // объект назван именем установки: после теста снимаем имя, чтобы поиск по имени в соседних тестах его не находил
    if (admin && h1)
      await admin.property
        .update({ where: { id: h1.propertyId }, data: { name: `CSF retired ${h1.propertyId}` } })
        .catch(() => undefined);
    forgetPropertyRef();
    await tenant?.$disconnect();
    await admin?.$disconnect();
  });

  const get = (actor: string, scope: { businessId?: string; locationId?: string } = {}) =>
    call(base, actor, 'GET', '/system/connection', scope);

  // ───────── разрешено, как раньше ─────────

  it('ALLOW: владелец без указателя получает объект своей организации и счётчики', async () => {
    const r = await get('owner');
    expect(r.status, r.text).toBe(200);
    expect(r.json.state).toBe('READY');
    expect(r.json.property.name).toBe(LUXX);
    expect(r.json.counts.units).toBe(1);
  });

  it('ALLOW: неограниченный менеджер получает объект организации', async () => {
    const r = await get('orgMgr');
    expect(r.status, r.text).toBe(200);
    expect(r.json.property.name).toBe(LUXX);
  });

  it('ALLOW: менеджер филиала H1 с указателем на H1 получает H1', async () => {
    const r = await get('mgrH1', at(h1.businessId, h1.locationId));
    expect(r.status, r.text).toBe(200);
    expect(r.json.property.name).toBe(LUXX);
  });

  // ───────── запрещено ─────────

  it('T07 DENY: менеджер филиала H2 получает свой объект H2, а не объект H1', async () => {
    const r = await get('mgrH2', at(h2.businessId, h2.locationId));
    expect(r.status, r.text).toBe(200);
    expect(r.text, 'в ответе объект другого филиала (H1)').not.toContain(LUXX);
    expect(r.json.property.name).toBe(H2_NAME);
  });

  it('T07 DENY: менеджер H2 с указателем на H1 получает отказ и ничего из H1', async () => {
    const r = await get('mgrH2', at(h1.businessId, h1.locationId));
    expect([403, 404]).toContain(r.status);
    expect(r.text).not.toContain(LUXX);
  });

  it('T06 DENY: ограниченный менеджер салона не получает гостиницу (403 или 404, без данных объекта)', async () => {
    const r = await get('mgrBl1', at(ids.bz!, ids.bl1!));
    expect([403, 404], r.text).toContain(r.status);
    expect(r.text).not.toContain(LUXX);
    expect(r.text).not.toContain('counts');
  });

  it('DENY: ограниченный менеджер ресторана (другая вертикаль) не получает гостиницу', async () => {
    const r = await get('mgrFl1', at(ids.fb!, ids.fl1!));
    expect([403, 404], r.text).toContain(r.status);
    expect(r.text).not.toContain(LUXX);
  });

  it('DENY: владелец чужой организации видит только свою гостиницу, не объект Luxx Aparts', async () => {
    const r = await get('foreignOwner');
    expect(r.text).not.toContain(LUXX);
    expect(r.text).not.toContain(H2_NAME);
    expect(r.status, r.text).toBe(200);
    expect(r.json.property.name).toBe(FOREIGN_NAME);
    expect(foreignHotel.propertyId).toBeTruthy();
  });
});
