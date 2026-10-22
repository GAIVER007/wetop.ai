import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import { withOrganizationScope } from '../../apps/api/src/auth/request-context';
import { SiteFormsModule } from '../../apps/api/src/site-forms/site-forms.module';
import { SiteFormsService } from '../../apps/api/src/site-forms/site-forms.service';
import { TurnstileService } from '../../apps/api/src/web-booking/turnstile';
import { almatyAt, actorOf, call, makeClients, nextMonday, seedHotel, seedUser, url } from './core-security/harness';
import { seedBeautyFoodWorld, type BeautyFoodWorld } from './core-security/world';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';

/**
 * SITE-3/4/5 (ADR-185, plans/site-seo-flow-2026-10-15.md §2): формы управляемого сайта на настоящей базе и под RLS.
 *
 * Салон BL1 (мастера eBl1 и eBl1b, пн 09:00-18:00, услуга 60 мин) и ресторан FL1 организации `org` получают сайты
 * счётчика по филиалу, без объекта гостиницы (SITE-3). Гостиница той же организации: свой сайт с объектом. Чужая
 * организация: свой салон и сайт. Запросы идут через настоящий Nest с `RoleGuard` и `AuthorInterceptor`, публичные
 * без входа; Turnstile подменён одноразовой проверкой, как в web-booking-exact-property.
 */
describe.skipIf(!url)('формы сайта салона и ресторана, заявки без слота (SITE-3/4/5, integration)', () => {
  let admin: Db;
  let tenant: Db;
  let app: INestApplication;
  let base = '';
  let w: BeautyFoodWorld;
  let forms: SiteFormsService;
  const run = randomBytes(4).toString('hex');
  const site = { salon: '', food: '', hotel: '', foreign: '', paused: '' };
  const siteId = { salon: '', food: '', hotel: '', foreign: '' };
  const host = (label: string) => `site3-${label}-${run}.example`;
  let periodId = '';
  let week = 60;
  let phoneSeq = 0;
  const phone = () => `+7702${run.slice(0, 4).replace(/\D/g, '1')}${String(++phoneSeq).padStart(3, '0')}`.slice(0, 13);

  // одноразовая проверка Turnstile: «bad» не проходит, повтор токена тоже
  const used = new Set<string>();
  const turnstile = {
    enabled: () => true,
    siteKey: () => 'test-site-key',
    verify: async (token: unknown) => {
      if (typeof token !== 'string' || !token) return { ok: false as const, reason: 'missing' as const };
      if (token === 'bad' || used.has(token)) return { ok: false as const, reason: 'invalid' as const };
      used.add(token);
      return { ok: true as const };
    },
  };
  const token = () => `ok-${randomUUID()}`;

  async function post(path: string, body: Record<string, unknown>, origin: string) {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: `https://${origin}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* not json */
    }
    return { status: res.status, json, text };
  }
  async function get(path: string, origin: string) {
    const res = await fetch(`${base}${path}`, { headers: { origin: `https://${origin}` } });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    w = await seedBeautyFoodWorld(admin);
    // сайты счётчика по филиалу (SITE-3): объекта у салона и ресторана нет
    const mk = async (label: string, locationId: string | null, propertyId: string | null, status: 'ACTIVE' | 'PAUSED' = 'ACTIVE') => {
      const publicKey = `pms_${randomBytes(6).toString('hex')}`;
      const s = await admin.trackedSite.create({
        data: { ...(locationId ? { locationId } : {}), ...(propertyId ? { propertyId } : {}), name: `Сайт ${label}`, hosts: [host(label)], publicKey, status },
      });
      return { key: publicKey, id: s.id };
    };
    const salon = await mk('salon', w.ids.bl1!, null);
    const food = await mk('food', w.ids.fl1!, null);
    const hotel = await seedHotel(admin, w.org, `SITE3 Hotel ${run}`);
    // гостиничный путь: только объект, филиал заполняет триггер
    const hotelSite = await mk('hotel', null, hotel.propertyId);
    const foreign = await mk('foreign', w.ids.fbl1!, null);
    const paused = await mk('paused', w.ids.bl1!, null, 'PAUSED');
    Object.assign(site, { salon: salon.key, food: food.key, hotel: hotelSite.key, foreign: foreign.key, paused: paused.key });
    Object.assign(siteId, { salon: salon.id, food: food.id, hotel: hotelSite.id, foreign: foreign.id });
    // ресторан FL1: ужин по понедельникам 12:00-23:00, бронь 120 минут; правило: не больше 6 гостей
    const period = await admin.servicePeriod.create({
      data: {
        locationId: w.ids.fl1!,
        name: 'Ужин',
        weekday: 1,
        timeFrom: new Date('1970-01-01T12:00:00Z'),
        timeTo: new Date('1970-01-01T23:00:00Z'),
        defaultDurationMinutes: 120,
      },
    });
    periodId = period.id;
    await admin.foodBookingRules.create({ data: { locationId: w.ids.fl1!, maxPartySize: 6 } });

    // стойка: владелец организации и администратор салона BL1; владелец чужой организации
    w.actors.set('foreignStaff', actorOf(await seedUser(admin, w.foreignOrg, 'STAFF', `f-${run}`), w.foreignOrg, 'STAFF'));
    // администратор без назначений: право `dialogs` у него есть (STAFF), область вся организация
    w.actors.set('staff', actorOf(await seedUser(admin, w.org, 'STAFF', `s-${run}`), w.org, 'STAFF'));

    const prisma = { db: tenant } as unknown as PrismaService;
    const mod = await Test.createTestingModule({ imports: [SiteFormsModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(TurnstileService)
      .useValue(turnstile)
      .compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string | undefined>; user?: object }, _res: unknown, next: () => void) => {
      const key = req.headers['x-test-actor'];
      const actor = key ? w.actors.get(key) : undefined;
      if (actor) req.user = actor;
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor(prisma));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    forms = app.get(SiteFormsService);
  }, 180_000);

  beforeEach(() => forms?.resetLimits());

  afterAll(async () => {
    await app?.close();
    await tenant?.$disconnect();
    await admin?.$disconnect();
  });

  const beautyBody = (over: Record<string, unknown> = {}) => ({
    k: site.salon,
    name: 'Айгерим',
    phone: phone(),
    serviceId: w.ids.svc,
    startsAt: almatyAt(nextMonday(week++), '10:00'),
    requestKey: randomUUID(),
    turnstileToken: token(),
    ...over,
  });

  // ───────── SITE-3: база ─────────

  describe('SITE-3: сайт счётчика по филиалу, лицензия всех направлений', () => {
    it('сайт без объекта и без филиала база не принимает; объект заполняет филиал; объект чужого филиала отказ', async () => {
      await expect(
        admin.trackedSite.create({ data: { name: 'x', hosts: [], publicKey: `pms_${randomBytes(6).toString('hex')}` } }),
      ).rejects.toThrow(/tracked_sites_location_required/);
      const hotelRow = await admin.trackedSite.findUniqueOrThrow({ where: { id: siteId.hotel }, include: { property: true } });
      expect(hotelRow.locationId).toBe(hotelRow.property!.locationId);
      await expect(
        admin.trackedSite.create({
          data: { name: 'x', hosts: [], publicKey: `pms_${randomBytes(6).toString('hex')}`, propertyId: hotelRow.propertyId!, locationId: w.ids.bl1! },
        }),
      ).rejects.toThrow(/другому филиалу/);
      await expect(admin.trackedSite.update({ where: { id: siteId.salon }, data: { locationId: w.ids.bl2! } })).rejects.toThrow(
        /филиал сайта не меняется/,
      );
    });

    it('лицензия конструктора: салон и ресторан принимаются, филиал лицензии не меняется', async () => {
      for (const locationId of [w.ids.bl2!, w.ids.fl2!])
        await admin.siteBuilderEntitlement.create({ data: { locationId, status: 'ACTIVE', updatedAt: new Date() } });
      expect(await admin.siteBuilderEntitlement.count({ where: { locationId: { in: [w.ids.bl2!, w.ids.fl2!] } } })).toBe(2);
      await expect(
        admin.siteBuilderEntitlement.update({ where: { locationId: w.ids.bl2! }, data: { locationId: w.ids.fl2! } }),
      ).rejects.toThrow(/не меняется/);
    });

    it('управляемый сайт салона связывается с сайтом счётчика своего филиала, чужого нет', async () => {
      const ms = await admin.marketingSite.create({ data: { locationId: w.ids.bl1!, name: 'Salon', slug: `salon-${run}` } });
      await admin.marketingSite.update({ where: { id: ms.id }, data: { trackedSiteId: siteId.salon } });
      await expect(admin.marketingSite.update({ where: { id: ms.id }, data: { trackedSiteId: siteId.food } })).rejects.toThrow(
        /другого филиала/,
      );
      await admin.marketingSite.update({ where: { id: ms.id }, data: { trackedSiteId: null } });
    });

    it('RLS: сайт счётчика салона видит своя организация, чужая нет', async () => {
      const own = await withOrganizationScope(w.org, () => tenant.trackedSite.count({ where: { id: siteId.salon } }));
      const other = await withOrganizationScope(w.foreignOrg, () => tenant.trackedSite.count({ where: { id: siteId.salon } }));
      expect([own, other]).toEqual([1, 0]);
    });
  });

  // ───────── SITE-4: салон ─────────

  describe('SITE-4: запись к мастеру с сайта', () => {
    it('свободные окна по графику мастеров; занятое время пропадает', async () => {
      const day = nextMonday(week++);
      const r = await get(`/w/beauty/slots?k=${site.salon}&service=${w.ids.svc}&date=${day}`, host('salon'));
      expect(r.status, JSON.stringify(r.json)).toBe(200);
      const slots = r.json['slots'] as Array<{ time: string; employeeIds: string[] }>;
      expect(slots[0]).toMatchObject({ time: '09:00' });
      expect(slots.at(-1)).toMatchObject({ time: '17:00' });
      expect(slots[0]!.employeeIds.sort()).toEqual([w.ids.eBl1!, w.ids.eBl1b!].sort());
      expect(r.json['service']).toMatchObject({ durationMinutes: 60, priceMinor: '800000', currency: 'KZT' });
      const booked = await post('/w/beauty/book', beautyBody({ employeeId: w.ids.eBl1, startsAt: almatyAt(day, '10:00') }), host('salon'));
      expect(booked.status, booked.text).toBe(201);
      const after = await get(`/w/beauty/slots?k=${site.salon}&service=${w.ids.svc}&employee=${w.ids.eBl1}&date=${day}`, host('salon'));
      const times = (after.json['slots'] as Array<{ time: string }>).map((s) => s.time);
      expect(times).not.toContain('10:00');
      expect(times).not.toContain('09:15');
      expect(times).toContain('11:00');
      // напоминания клиенту (решение 21.10.2026 §1): подтверждение сразу и напоминания за 24 и 2 часа в той же транзакции
      const queue = await admin.clientNotification.findMany({
        where: { appointmentId: booked.json['appointmentId'] as string },
        orderBy: { dueAt: 'asc' },
        select: { kind: true, state: true, dueAt: true },
      });
      expect(queue.map((q) => q.kind).sort()).toEqual(['CONFIRMATION', 'REMINDER', 'REMINDER']);
      expect(queue.filter((q) => q.kind === 'REMINDER').map((q) => q.dueAt.toISOString())).toEqual([
        new Date(new Date(almatyAt(day, '10:00')).getTime() - 24 * 3_600_000).toISOString(),
        new Date(new Date(almatyAt(day, '10:00')).getTime() - 2 * 3_600_000).toISOString(),
      ]);
    });

    it('свободные окна учитывают мастера второй строки многострочного визита', async () => {
      const day = nextMonday(week++);
      const booked = await post(
        '/w/beauty/book',
        beautyBody({ employeeId: w.ids.eBl1b, startsAt: almatyAt(day, '10:00') }),
        host('salon'),
      );
      expect(booked.status, booked.text).toBe(201);
      const appointmentId = booked.json['appointmentId'] as string;
      await admin.$transaction(async (tx) => {
        await tx.$queryRawUnsafe(`SELECT set_config('wetop.appointment_lines_write','on',true)`);
        await tx.appointment.update({
          where: { id: appointmentId },
          data: { endsAt: new Date(almatyAt(day, '12:00')), price: 1_600_000n },
        });
        await tx.appointmentLine.create({
          data: {
            appointmentId,
            position: 1,
            employeeId: w.ids.eBl1!,
            serviceId: w.ids.svc!,
            startsAt: new Date(almatyAt(day, '11:00')),
            endsAt: new Date(almatyAt(day, '12:00')),
            basePriceMinor: 800_000n,
            discountMinor: 0n,
            surchargeMinor: 0n,
            priceMinor: 800_000n,
            currency: 'KZT',
          },
        });
      });

      const result = await get(
        `/w/beauty/slots?k=${site.salon}&service=${w.ids.svc}&employee=${w.ids.eBl1}&date=${day}`,
        host('salon'),
      );
      expect(result.status, JSON.stringify(result.json)).toBe(200);
      const times = (result.json['slots'] as Array<{ time: string }>).map((slot) => slot.time);
      expect(times).not.toContain('11:00');
      expect(times).not.toContain('10:15');
      expect(times).toContain('12:00');
    });

    it('запись встаёт в календарь мастера: Записан, источник WEBSITE, клиент по телефону, без автора', async () => {
      const p = phone();
      const body = beautyBody({ phone: p, employeeId: w.ids.eBl1, comment: 'Короткий маникюр' });
      const r = await post('/w/beauty/book', body, host('salon'));
      expect(r.status, r.text).toBe(201);
      expect(r.json).toMatchObject({ status: 'BOOKED', employee: { id: w.ids.eBl1 }, service: { id: w.ids.svc }, priceMinor: '800000', currency: 'KZT' });
      const row = await admin.appointment.findUniqueOrThrow({ where: { id: r.json['appointmentId'] as string }, include: { customer: true } });
      expect(row).toMatchObject({ locationId: w.ids.bl1, source: 'WEBSITE', status: 'BOOKED', createdById: null });
      expect(row.creationKey).toBe(`site:${siteId.salon}:${body.requestKey}`);
      expect(row.customer).toMatchObject({ organizationId: w.org, phone: p, firstName: 'Айгерим' });
      expect(row.notes).toContain('Короткий маникюр');
      expect(await admin.customerBusiness.count({ where: { customerId: row.customerId, businessId: w.ids.bz! } })).toBe(1);
      expect(await admin.appointmentLine.findMany({
        where: { appointmentId: row.id },
        select: { position: true, employeeId: true, serviceId: true, startsAt: true, endsAt: true, priceMinor: true, currency: true },
      })).toEqual([{
        position: 0,
        employeeId: w.ids.eBl1,
        serviceId: w.ids.svc,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        priceMinor: row.price,
        currency: row.currency,
      }]);
      // тот же телефон второй раз: тот же клиент
      const again = await post('/w/beauty/book', beautyBody({ phone: p, employeeId: w.ids.eBl1 }), host('salon'));
      expect(again.status, again.text).toBe(201);
      expect(await admin.customer.count({ where: { organizationId: w.org, phone: p } })).toBe(1);
    });

    it('несколько услуг подряд к одному мастеру: строки визита по порядку, цена суммой, время концом последней', async () => {
      // вторая услуга салона (30 мин, 3000 ₸), её оказывает только eBl1
      const svc2 = await admin.beautyService.create({
        data: { businessId: w.ids.bz!, name: `Брови ${run}`, price: 300000n, currency: 'KZT', durationMinutes: 30 },
      });
      await admin.locationService.create({ data: { locationId: w.ids.bl1!, serviceId: svc2.id, enabled: true } });
      await admin.employeeService.create({ data: { employeeId: w.ids.eBl1!, serviceId: svc2.id } });
      const startsAt = almatyAt(nextMonday(week++), '11:00');
      const body = beautyBody({ startsAt, serviceIds: [w.ids.svc, svc2.id] });
      const r = await post('/w/beauty/book', body, host('salon'));
      expect(r.status, r.text).toBe(201);
      // «любой мастер»: вторую услугу оказывает только eBl1, его и выбрали
      expect(r.json).toMatchObject({ status: 'BOOKED', employee: { id: w.ids.eBl1 }, priceMinor: '1100000', currency: 'KZT' });
      const row = await admin.appointment.findUniqueOrThrow({ where: { id: r.json['appointmentId'] as string } });
      expect(row.endsAt.getTime() - row.startsAt.getTime()).toBe(90 * 60_000);
      const lines = await admin.appointmentLine.findMany({
        where: { appointmentId: row.id },
        orderBy: { position: 'asc' },
        select: { position: true, employeeId: true, serviceId: true, startsAt: true, endsAt: true, priceMinor: true },
      });
      expect(lines.map((l) => [l.position, l.serviceId, l.employeeId, l.priceMinor])).toEqual([
        [0, w.ids.svc, w.ids.eBl1, 800000n],
        [1, svc2.id, w.ids.eBl1, 300000n],
      ]);
      expect(lines[1]!.startsAt).toEqual(lines[0]!.endsAt);
      // повтор того же запроса: та же запись; тот же ключ с другим составом: отказ
      const again = await post('/w/beauty/book', { ...body, turnstileToken: token() }, host('salon'));
      expect(again.status, again.text).toBe(201);
      expect(again.json['appointmentId']).toBe(row.id);
      const other = await post('/w/beauty/book', { ...body, serviceIds: [w.ids.svc], turnstileToken: token() }, host('salon'));
      expect(other.status).toBe(409);
      // мастер не оказывает вторую услугу: 409 словами, записи нет
      const before = await admin.appointment.count({ where: { locationId: w.ids.bl1! } });
      const bad = await post(
        '/w/beauty/book',
        beautyBody({ startsAt: almatyAt(nextMonday(week++), '11:00'), employeeId: w.ids.eBl1b, serviceIds: [w.ids.svc, svc2.id] }),
        host('salon'),
      );
      expect(bad.status, bad.text).toBe(409);
      expect(bad.json['message']).toBe('Мастер эту услугу не оказывает');
      expect(await admin.appointment.count({ where: { locationId: w.ids.bl1! } })).toBe(before);
    });

    it('«любой мастер»: первый свободный по имени; оба заняты: 409', async () => {
      const startsAt = almatyAt(nextMonday(week++), '12:00');
      const a = await post('/w/beauty/book', beautyBody({ startsAt }), host('salon'));
      const b = await post('/w/beauty/book', beautyBody({ startsAt }), host('salon'));
      const c = await post('/w/beauty/book', beautyBody({ startsAt }), host('salon'));
      expect([a.status, b.status, c.status], `${a.text} | ${b.text} | ${c.text}`).toEqual([201, 201, 409]);
      expect(new Set([(a.json['employee'] as { id: string }).id, (b.json['employee'] as { id: string }).id])).toEqual(
        new Set([w.ids.eBl1!, w.ids.eBl1b!]),
      );
    });

    it('занятый слот выбранного мастера: 409, записи нет', async () => {
      const startsAt = almatyAt(nextMonday(week++), '14:00');
      const first = await post('/w/beauty/book', beautyBody({ employeeId: w.ids.eBl1, startsAt }), host('salon'));
      expect(first.status, first.text).toBe(201);
      const p = phone();
      const second = await post('/w/beauty/book', beautyBody({ phone: p, employeeId: w.ids.eBl1, startsAt }), host('salon'));
      expect(second.status, second.text).toBe(409);
      expect(await admin.customer.count({ where: { organizationId: w.org, phone: p } })).toBe(0);
    });

    it('вне графика мастера: 409 словами стойки', async () => {
      const r = await post('/w/beauty/book', beautyBody({ employeeId: w.ids.eBl1, startsAt: almatyAt(nextMonday(week++), '19:00') }), host('salon'));
      expect(r.status).toBe(409);
      expect(r.json['message']).toBe('Мастер в это время не работает');
    });

    it('идемпотентность: повтор с тем же requestKey отдаёт ту же запись без дубля и без Turnstile; другой запрос с тем же ключом 409', async () => {
      const body = beautyBody({ employeeId: w.ids.eBl1b });
      const a = await post('/w/beauty/book', body, host('salon'));
      expect(a.status, a.text).toBe(201);
      // повтор: токен уже использован (одноразовый), но ранний повтор проверку не зовёт
      const b = await post('/w/beauty/book', body, host('salon'));
      expect(b.status, b.text).toBe(201);
      expect(b.json['appointmentId']).toBe(a.json['appointmentId']);
      expect(await admin.appointment.count({ where: { creationKey: `site:${siteId.salon}:${body.requestKey}` } })).toBe(1);
      const other = await post('/w/beauty/book', { ...body, comment: 'другое', turnstileToken: token() }, host('salon'));
      expect(other.status).toBe(409);
    });

    it('одновременная двойная отправка (тот же ключ): одна запись, оба ответа об одной записи', async () => {
      for (let i = 0; i < 3; i++) {
        const body = beautyBody({ employeeId: w.ids.eBl1 });
        const [a, b] = await Promise.all([
          post('/w/beauty/book', { ...body, turnstileToken: token() }, host('salon')),
          post('/w/beauty/book', { ...body, turnstileToken: token() }, host('salon')),
        ]);
        expect([a.status, b.status], `${a.text} | ${b.text}`).toEqual([201, 201]);
        expect(a.json['appointmentId']).toBe(b.json['appointmentId']);
        expect(await admin.appointment.count({ where: { creationKey: `site:${siteId.salon}:${body.requestKey}` } })).toBe(1);
      }
    }, 60_000);

    it('гонка одного нового телефона на два слота: без 500, клиент один', async () => {
      const day = nextMonday(week++);
      const p = phone();
      const [a, b] = await Promise.all([
        post('/w/beauty/book', beautyBody({ phone: p, employeeId: w.ids.eBl1, startsAt: almatyAt(day, '10:00') }), host('salon')),
        post('/w/beauty/book', beautyBody({ phone: p, employeeId: w.ids.eBl1b, startsAt: almatyAt(day, '10:00') }), host('salon')),
      ]);
      expect(['201+201', '201+409']).toContain([a.status, b.status].sort().join('+'));
      expect(await admin.customer.count({ where: { organizationId: w.org, phone: p } })).toBe(1);
    }, 60_000);

    it('Turnstile: неверный токен 403, без токена 400; записи нет', async () => {
      const bad = beautyBody({ turnstileToken: 'bad' });
      expect((await post('/w/beauty/book', bad, host('salon'))).status).toBe(403);
      const none = beautyBody({ turnstileToken: undefined });
      expect((await post('/w/beauty/book', none, host('salon'))).status).toBe(400);
      expect(
        await admin.appointment.count({ where: { creationKey: { in: [bad.requestKey, none.requestKey].map((k) => `site:${siteId.salon}:${k}`) } } }),
      ).toBe(0);
    });

    it('сайт другой вертикали, чужой домен, пауза, неизвестный ключ: отказ без записи', async () => {
      // ресторанный сайт не принимает запись к мастеру, салонный не принимает бронь стола, гостиница ни то ни другое
      expect((await post('/w/beauty/book', beautyBody({ k: site.food }), host('food'))).status).toBe(404);
      expect((await post('/w/beauty/book', beautyBody({ k: site.hotel }), host('hotel'))).status).toBe(404);
      expect((await get(`/w/beauty/slots?k=${site.food}&service=${w.ids.svc}&date=${nextMonday(0)}`, host('food'))).status).toBe(404);
      expect((await post('/w/beauty/book', beautyBody(), host('food'))).status).toBe(403);
      expect((await post('/w/beauty/book', beautyBody({ k: site.paused }), host('paused'))).status).toBe(404);
      expect((await post('/w/beauty/book', beautyBody({ k: 'pms_000000000000' }), host('salon'))).status).toBe(404);
      // мастер чужой организации на сайте своего салона: мастер не найден
      expect((await post('/w/beauty/book', beautyBody({ employeeId: w.ids.eForeign }), host('salon'))).status).toBe(404);
    });

    it('лимит адреса: шестая заявка за час с одного адреса 429', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await fetch(`${base}/w/lead`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: `https://${host('salon')}` },
          body: JSON.stringify({ k: site.salon, name: 'Лимит', phone: phone(), requestKey: randomUUID(), turnstileToken: token() }),
        });
        statuses.push(r.status);
      }
      expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
    });
  });

  // ───────── SITE-4: ресторан ─────────

  describe('SITE-4: бронь стола с сайта', () => {
    const foodBody = (over: Record<string, unknown> = {}) => ({
      k: site.food,
      date: nextMonday(week++),
      time: '19:00',
      partySize: 4,
      name: 'Бауыржан',
      phone: phone(),
      requestKey: randomUUID(),
      turnstileToken: token(),
      ...over,
    });

    it('бронь в период обслуживания: Забронирован, WEBSITE, конец по длительности периода', async () => {
      const body = foodBody({ comment: 'У окна' });
      const r = await post('/w/food/reserve', body, host('food'));
      expect(r.status, r.text).toBe(201);
      expect(r.json).toMatchObject({ status: 'BOOKED', date: body.date, time: '19:00', partySize: 4 });
      const row = await admin.restaurantReservation.findUniqueOrThrow({ where: { id: r.json['reservationId'] as string } });
      expect(row).toMatchObject({ locationId: w.ids.fl1, servicePeriodId: periodId, source: 'WEBSITE', status: 'BOOKED', createdById: null });
      expect(row.endsAt.getTime() - row.startsAt.getTime()).toBe(120 * 60_000);
      expect(row.startsAt.toISOString()).toBe(almatyAt(body.date as string, '19:00'));
    });

    it('правила брони филиала: больше 6 гостей 409; вне периода 409; закрытый день 409', async () => {
      const big = await post('/w/food/reserve', foodBody({ partySize: 7 }), host('food'));
      expect(big.status).toBe(409);
      expect(big.json['message']).toMatch(/не больше 6/);
      const late = await post('/w/food/reserve', foodBody({ time: '22:00' }), host('food'));
      expect(late.status).toBe(409);
      const day = nextMonday(week++);
      await admin.foodClosedDay.create({ data: { locationId: w.ids.fl1!, day: new Date(`${day}T00:00:00Z`) } });
      const closed = await post('/w/food/reserve', foodBody({ date: day }), host('food'));
      expect(closed.status).toBe(409);
      expect(closed.json['message']).toBe('В этот день заведение не принимает брони');
    });

    it('идемпотентность: тот же requestKey отдаёт ту же бронь; другая форма с тем же ключом 409', async () => {
      const body = foodBody();
      const a = await post('/w/food/reserve', body, host('food'));
      const b = await post('/w/food/reserve', body, host('food'));
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(b.json['reservationId']).toBe(a.json['reservationId']);
      expect(await admin.restaurantReservation.count({ where: { creationKey: `site:${siteId.food}:${body.requestKey}` } })).toBe(1);
      expect((await post('/w/food/reserve', { ...body, partySize: 2, turnstileToken: token() }, host('food'))).status).toBe(409);
    });

    it('сайт салона бронь стола не принимает; Turnstile неверный 403', async () => {
      expect((await post('/w/food/reserve', foodBody({ k: site.salon }), host('salon'))).status).toBe(404);
      expect((await post('/w/food/reserve', foodBody({ turnstileToken: 'bad' }), host('food'))).status).toBe(403);
    });
  });

  // ───────── SITE-5: заявки ─────────

  describe('SITE-5: заявка без слота и «Входящие»', () => {
    it('заявка с любого сайта: строка NEW в филиале сайта, метки перехода; повтор без дубля', async () => {
      const body = {
        k: site.hotel,
        name: 'Ержан',
        phone: '8 (701) 000-00-11',
        comment: 'Перезвоните после 18:00',
        source: { utm_source: 'instagram', page: '/rooms' },
        requestKey: randomUUID(),
        turnstileToken: token(),
      };
      const a = await post('/w/lead', body, host('hotel'));
      expect(a.status, a.text).toBe(201);
      expect(a.json).toMatchObject({ status: 'NEW' });
      const b = await post('/w/lead', body, host('hotel'));
      expect(b.json['leadId']).toBe(a.json['leadId']);
      const row = await admin.siteLead.findUniqueOrThrow({ where: { id: a.json['leadId'] as string } });
      const hotelSite = await admin.trackedSite.findUniqueOrThrow({ where: { id: siteId.hotel } });
      expect(row).toMatchObject({
        organizationId: w.org,
        locationId: hotelSite.locationId,
        trackedSiteId: siteId.hotel,
        phone: '+77010000011',
        kind: 'CALLBACK',
        status: 'NEW',
        source: { utm_source: 'instagram', page: '/rooms' },
      });
      expect(await admin.siteLead.count({ where: { trackedSiteId: siteId.hotel, requestKey: body.requestKey } })).toBe(1);
      expect((await post('/w/lead', { ...body, name: 'Другой', turnstileToken: token() }, host('hotel'))).status).toBe(409);
      expect((await post('/w/lead', { ...body, requestKey: randomUUID(), turnstileToken: 'bad' }, host('hotel'))).status).toBe(403);
      expect((await post('/w/lead', { ...body, requestKey: randomUUID(), website: 'spam' }, host('hotel'))).status).toBe(400);
    });

    it('стойка: список заявок филиала и смена статуса (право dialogs), журнал; чужая организация не видит', async () => {
      // `dialogs` организационное право (ORGANIZATION_LEVEL_PERMISSIONS): сотруднику с назначением на филиал закрыто
      const r = await post('/w/lead', { k: site.salon, name: 'Сауле', phone: phone(), requestKey: randomUUID(), turnstileToken: token() }, host('salon'));
      expect(r.status, r.text).toBe(201);
      const leadId = r.json['leadId'] as string;
      const scope = { businessId: w.ids.bz!, locationId: w.ids.bl1! };
      expect((await call(base, 'staffBl1', 'GET', '/marketing/site/leads', scope)).status).toBe(403);
      const list = await call(base, 'staff', 'GET', '/marketing/site/leads', scope);
      expect(list.status, list.text).toBe(200);
      expect((list.json.items as Array<{ id: string }>).map((i) => i.id)).toContain(leadId);
      expect(list.json.newCount).toBeGreaterThan(0);
      const patched = await call(base, 'staff', 'PATCH', `/marketing/site/leads/${leadId}`, scope, { status: 'IN_PROGRESS' });
      expect(patched.status, patched.text).toBe(200);
      expect(patched.json).toMatchObject({ id: leadId, status: 'IN_PROGRESS', site: { id: siteId.salon } });
      expect(await admin.auditLog.count({ where: { entityId: leadId, action: 'site.lead.status' } })).toBe(1);
      expect((await call(base, 'staff', 'PATCH', `/marketing/site/leads/${leadId}`, scope, { status: 'LOST' })).status).toBe(400);
      expect((await call(base, 'staff', 'PATCH', `/marketing/site/leads/${leadId}`, scope, { name: 'x', status: 'DONE' })).status).toBe(400);
      const log = await admin.auditLog.findFirstOrThrow({ where: { entityId: leadId, action: 'site.lead.status' } });
      expect(log.userId).toBe(w.actors.get('staff')!.id);
      // другой филиал той же организации заявку не видит
      const otherLoc = await call(base, 'owner', 'GET', '/marketing/site/leads', { businessId: w.ids.bz!, locationId: w.ids.bl2! });
      expect((otherLoc.json.items as Array<{ id: string }>).map((i) => i.id)).not.toContain(leadId);
      expect((await call(base, 'owner', 'PATCH', `/marketing/site/leads/${leadId}`, { businessId: w.ids.bz!, locationId: w.ids.bl2! }, { status: 'DONE' })).status).toBe(404);
      // чужая организация: её указатель на наш филиал отклоняется, по id заявки не найти
      expect((await call(base, 'foreignStaff', 'GET', '/marketing/site/leads', scope)).status).toBe(403);
      const foreignOwn = await call(base, 'foreignStaff', 'PATCH', `/marketing/site/leads/${leadId}`, { businessId: w.ids.fbz!, locationId: w.ids.fbl1! }, { status: 'SPAM' });
      expect(foreignOwn.status).toBe(404);
      expect((await admin.siteLead.findUniqueOrThrow({ where: { id: leadId } })).status).toBe('IN_PROGRESS');
    });

    it('RLS: чужая организация не видит и не меняет заявку на уровне базы; у заявки меняется только статус', async () => {
      const r = await post('/w/lead', { k: site.salon, name: 'Асель', phone: phone(), requestKey: randomUUID(), turnstileToken: token() }, host('salon'));
      const leadId = r.json['leadId'] as string;
      const own = await withOrganizationScope(w.org, () => tenant.siteLead.count({ where: { id: leadId } }));
      const other = await withOrganizationScope(w.foreignOrg, () => tenant.siteLead.count({ where: { id: leadId } }));
      expect([own, other]).toEqual([1, 0]);
      const changed = await withOrganizationScope(w.foreignOrg, () =>
        tenant.siteLead.updateMany({ where: { id: leadId }, data: { status: 'SPAM' } }),
      );
      expect(changed.count).toBe(0);
      // чужая организация не может завести заявку на наш сайт даже с правильным филиалом
      await expect(
        withOrganizationScope(w.foreignOrg, () =>
          tenant.siteLead.create({
            data: {
              organizationId: w.org,
              locationId: w.ids.bl1!,
              trackedSiteId: siteId.salon,
              name: 'x',
              phone: '+77000000000',
              requestKey: randomUUID(),
              requestFingerprint: 'f'.repeat(64),
            },
          }),
        ),
      ).rejects.toThrow();
      await expect(admin.siteLead.update({ where: { id: leadId }, data: { phone: '+77009999999' } })).rejects.toThrow(/только статус/);
      // заявка на сайт чужого филиала: триггер
      await expect(
        admin.siteLead.create({
          data: {
            organizationId: w.org,
            locationId: w.ids.bl2!,
            trackedSiteId: siteId.salon,
            name: 'x',
            phone: '+77000000000',
            requestKey: randomUUID(),
            requestFingerprint: 'f'.repeat(64),
          },
        }),
      ).rejects.toThrow(/другому филиалу/);
      // удаления у приложения нет (гранты)
      await expect(withOrganizationScope(w.org, () => tenant.siteLead.deleteMany({ where: { id: leadId } }))).rejects.toThrow(/permission denied/);
    });

    it('сайт чужой организации пишет заявку в свою организацию, а не в нашу', async () => {
      const r = await post('/w/lead', { k: site.foreign, name: 'Чужой', phone: phone(), requestKey: randomUUID(), turnstileToken: token() }, host('foreign'));
      expect(r.status, r.text).toBe(201);
      const row = await admin.siteLead.findUniqueOrThrow({ where: { id: r.json['leadId'] as string } });
      expect(row).toMatchObject({ organizationId: w.foreignOrg, locationId: w.ids.fbl1 });
    });
  });
});
