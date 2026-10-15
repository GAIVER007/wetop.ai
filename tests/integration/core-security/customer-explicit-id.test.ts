import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import { BeautyModule } from '../../../apps/api/src/beauty/beauty.module';
import { FoodModule } from '../../../apps/api/src/food-service/food.module';
import { almatyAt, bootApp, call, makeClients, nextMonday, url } from './harness';
import { seedBeautyFoodWorld, type BeautyFoodWorld } from './world';

/**
 * CORE-SECURITY-FIX-01, F5 (CORE-01 U2 B-5, F-3): явный `customerId` в записи Beauty и в брони Food.
 *
 * ЧТО ДЕРЖИТСЯ (зелёное на чистой main, оберегаем): клиент чужой организации, архивный и несуществующий не
 * принимаются (404), клиент своего бизнеса принимается, филиал вне назначений закрыт указателем (403).
 *
 * REQUIRED OWNER DECISION (код не менялся): клиент ТОЙ ЖЕ организации из ДРУГОГО бизнеса или другой вертикали без
 * строки `customer_businesses` для этого бизнеса принимается и получает такую строку при первом обращении. Это записано
 * в DATA_MODEL как замысел («клиент сети»: §17.3 «создаётся при первом обращении клиента в этот Business»; §19.1
 * «создание Appointment атомарно создаёт/подтверждает эту связь для Customer своей Organization»; Food: «Customer must
 * be non-archived and same Organization; CustomerBusiness upsert … atomic with create»), и тем же путём работает поиск
 * по телефону (find-or-create в Beauty). Закрыть только `customerId`, не решив судьбу телефона и замысла сети, значит
 * сломать записанное решение и оставить обход через телефон. Тесты `PENDING OWNER DECISION` фиксируют текущее поведение,
 * пока владелец не выберет; после выбора их надо переписать на выбранное.
 */
describe.skipIf(!url)('F5: явный customerId в записи Beauty и брони Food', () => {
  let admin: Db;
  let tenant: Db;
  let app: INestApplication;
  let base = '';
  let w: BeautyFoodWorld;
  let weekN = 60;
  let foodArchived = '';
  let foodPeriod = '';
  const bl1 = () => ({ businessId: w.ids.bz!, locationId: w.ids.bl1! });
  const bl2 = () => ({ businessId: w.ids.bz!, locationId: w.ids.bl2! });
  const fl1 = () => ({ businessId: w.ids.fb!, locationId: w.ids.fl1! });

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    w = await seedBeautyFoodWorld(admin);
    const archived = await admin.customer.create({
      data: {
        organizationId: w.org,
        firstName: 'CsfFoodArchived',
        phone: '+77005550006',
        status: 'ARCHIVED',
      },
    });
    await admin.customerBusiness.create({
      data: { customerId: archived.id, businessId: w.ids.fb! },
    });
    foodArchived = archived.id;
    const period = await admin.servicePeriod.create({
      data: {
        locationId: w.ids.fl1!,
        name: 'Lunch',
        weekday: 1,
        timeFrom: new Date('1970-01-01T10:00:00Z'),
        timeTo: new Date('1970-01-01T22:00:00Z'),
        defaultDurationMinutes: 90,
      },
    });
    foodPeriod = period.id;
    ({ app, base } = await bootApp([BeautyModule, FoodModule], tenant, w.actors));
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await tenant?.$disconnect();
    await admin?.$disconnect();
  });

  const linked = (customerId: string, businessId: string) =>
    admin.customerBusiness.count({ where: { customerId, businessId } });

  const beautyBook = (
    actor: string,
    customerId: unknown,
    scope: { businessId?: string; locationId?: string } = bl1(),
  ) =>
    call(base, actor, 'POST', '/beauty/appointments', scope, {
      employeeId: w.ids.eBl1,
      serviceId: w.ids.svc,
      startsAt: almatyAt(nextMonday(weekN++), '10:00'),
      customerId,
    });

  const foodBook = (
    actor: string,
    customerId: unknown,
    scope: { businessId?: string; locationId?: string } = fl1(),
  ) =>
    call(
      base,
      actor,
      'POST',
      '/food-service/reservations',
      scope,
      {
        servicePeriodId: foodPeriod,
        // 12:00 по Алматы в понедельник; у каждой брони свой понедельник
        startsAt: almatyAt(nextMonday(weekN++), '12:00'),
        partySize: 2,
        customerId,
      },
      { 'idempotency-key': randomUUID() },
    );

  // ───────── Beauty ─────────

  it('Beauty ALLOW: клиент своего бизнеса принимается (администратор и владелец)', async () => {
    for (const actor of ['staffBl1', 'owner']) {
      const r = await beautyBook(actor, w.ids.cBz);
      expect(r.status, `${actor}: ${r.text}`).toBe(201);
    }
  });

  it('Beauty DENY: клиент чужой организации не принимается (404), связь с бизнесом не создаётся', async () => {
    for (const actor of ['staffBl1', 'owner']) {
      const r = await beautyBook(actor, w.ids.cForeign);
      expect(r.status, `${actor}: ${r.text}`).toBe(404);
    }
    expect(await linked(w.ids.cForeign!, w.ids.bz!)).toBe(0);
  });

  it('Beauty DENY: архивный клиент, несуществующий и не-UUID идентификатор: 404', async () => {
    for (const id of [w.ids.cArchived, randomUUID(), 'not-a-uuid']) {
      const r = await beautyBook('staffBl1', id);
      expect([404, 400], `${id}: ${r.text}`).toContain(r.status);
    }
  });

  it('Beauty DENY: администратор BL1 не записывает в неназначенный BL2 даже клиента своего бизнеса (403)', async () => {
    const r = await beautyBook('staffBl1', w.ids.cBz, bl2());
    expect(r.status, r.text).toBe(403);
  });

  it('Beauty DENY: владелец чужой организации не записывает в наш салон', async () => {
    const r = await beautyBook('foreignOwner', w.ids.cBz);
    expect([403, 404], r.text).toContain(r.status);
  });

  // ───────── Food ─────────

  it('Food ALLOW: клиент своего бизнеса принимается (администратор и владелец)', async () => {
    for (const actor of ['staffFl1', 'owner']) {
      const r = await foodBook(actor, w.ids.cFood);
      expect(r.status, `${actor}: ${r.text}`).toBe(201);
    }
  });

  it('Food DENY: клиент чужой организации не принимается (404), связь с бизнесом не создаётся', async () => {
    for (const actor of ['staffFl1', 'owner']) {
      const r = await foodBook(actor, w.ids.cForeign);
      expect(r.status, `${actor}: ${r.text}`).toBe(404);
    }
    expect(await linked(w.ids.cForeign!, w.ids.fb!)).toBe(0);
  });

  it('Food DENY: архивный клиент и несуществующий идентификатор: 404', async () => {
    const archived = await foodBook('staffFl1', foodArchived);
    expect(archived.status, archived.text).toBe(404);
    const missing = await foodBook('staffFl1', randomUUID());
    expect(missing.status, missing.text).toBe(404);
  });

  it('Food DENY: администратор FL1 не бронирует в неназначенном FL2 (403)', async () => {
    const r = await foodBook('staffFl1', w.ids.cFood, {
      businessId: w.ids.fb!,
      locationId: w.ids.fl2!,
    });
    expect(r.status, r.text).toBe(403);
  });

  it('Food DENY: владелец чужой организации не бронирует в нашем ресторане', async () => {
    const r = await foodBook('foreignOwner', w.ids.cFood);
    expect([403, 404], r.text).toContain(r.status);
  });

  // ───────── REQUIRED OWNER DECISION: клиент той же организации из другого бизнеса / вертикали ─────────

  it('PENDING OWNER DECISION (B-5): клиент ДРУГОГО Beauty-бизнеса той же организации сейчас принимается и получает связь', async () => {
    expect(await linked(w.ids.cBz2!, w.ids.bz!)).toBe(0);
    const r = await beautyBook('staffBl1', w.ids.cBz2);
    // сегодняшнее поведение, записанное в DATA_MODEL как «клиент сети». Выберет ли владелец «только со связью»,
    // этот тест надо перевернуть: ожидать 404 и 0 связей
    expect(r.status, r.text).toBe(201);
    expect(await linked(w.ids.cBz2!, w.ids.bz!)).toBe(1);
  });

  it('PENDING OWNER DECISION (F-3): клиент Beauty сейчас принимается бронью Food той же организации и получает связь', async () => {
    expect(await linked(w.ids.cBz!, w.ids.fb!)).toBe(0);
    const r = await foodBook('staffFl1', w.ids.cBz);
    expect(r.status, r.text).toBe(201);
    expect(await linked(w.ids.cBz!, w.ids.fb!)).toBe(1);
  });
});
