import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { SiteFormsService } from '../../apps/api/src/site-forms/site-forms.service';
import { PrismaVoiceQuoteStore } from '../../apps/api/src/marketing-voice/voice-beauty.service';
import { VoiceFoodService } from '../../apps/api/src/marketing-voice/voice-food.service';
import { PrismaVoiceIngestRepository } from '../../apps/api/src/marketing-voice/voice-ingest.repository';
import { almatyAt, makeClients, nextMonday, seedUser, url } from './core-security/harness';
import { seedBeautyFoodWorld, type BeautyFoodWorld } from './core-security/world';

/**
 * Бронь стола по телефону на настоящей базе (DATA_MODEL VOICE-BOOKING): ресторан FL1 из мира проверок, ужин по понедельникам
 * 12:00-23:00 на 120 минут, предел 6 гостей, два стола (на 4 и на 8). Свободный стол считается без названия стола и без назначения.
 */
describe.skipIf(!url)('голосовая бронь стола (integration, VOICE-BOOKING)', () => {
  let admin: Db;
  let tenant: Db;
  let w: BeautyFoodWorld;
  let service: VoiceFoodService;
  let agent = '';
  let area = '';
  let customer = '';
  let week = 90;
  const run = randomUUID().slice(0, 6);
  const phone = '+77025550202';
  const call = (n: string) => `call-${run}-${n}`;
  const guest = { name: 'Тест Гость', phone, comment: 'у окна, детский стул' };
  let periodId = '';

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    w = await seedBeautyFoodWorld(admin);
    const user = await seedUser(admin, w.org, 'OWNER', `vf-${run}`);
    agent = (
      await admin.sellerAgent.create({
        data: { organizationId: w.org, createdBy: user, name: `Голос ${run}`, lifecycle: 'active', locationId: w.ids.fl1! },
        select: { id: true },
      })
    ).id;
    await admin.voiceProfile.create({ data: { agentId: agent, organizationId: w.org, businessId: w.ids.fb!, bookingEnabled: true } });
    periodId = (
      await admin.servicePeriod.create({
        data: {
          locationId: w.ids.fl1!, name: 'Ужин', weekday: 1,
          timeFrom: new Date('1970-01-01T12:00:00Z'), timeTo: new Date('1970-01-01T23:00:00Z'), defaultDurationMinutes: 120,
        },
      })
    ).id;
    await admin.foodBookingRules.create({ data: { locationId: w.ids.fl1!, maxPartySize: 6, bufferMinutes: 15 } });
    area = (await admin.diningArea.create({ data: { locationId: w.ids.fl1!, name: 'Зал' } })).id;
    await admin.diningTable.create({ data: { areaId: area, name: 'Стол 1', capacity: 4 } });
    await admin.diningTable.create({ data: { areaId: area, name: 'Большой', capacity: 8 } });
    customer = (await admin.customer.create({ data: { organizationId: w.org, firstName: 'Старый', phone: '+77025550999' } as never })).id;
    const adminPrisma = { db: admin } as unknown as PrismaService;
    const forms = new SiteFormsService({ db: tenant } as unknown as PrismaService, {} as never);
    service = new VoiceFoodService(new PrismaVoiceIngestRepository(adminPrisma), forms, new PrismaVoiceQuoteStore(adminPrisma));
  }, 180_000);

  afterAll(async () => {
    await tenant?.$disconnect();
    await admin?.$disconnect();
  });

  const day = () => nextMonday(week++);
  const q = (d: string, time: string, party: number, c: string) => ({ agent, call: c, date: d, time, party });
  const seed = (d: string, time: string, party: number, tableId: string | null) =>
    admin.restaurantReservation
      .create({
        data: {
          locationId: w.ids.fl1!, customerId: customer, servicePeriodId: periodId,
          startsAt: new Date(almatyAt(d, time)), endsAt: new Date(new Date(almatyAt(d, time)).getTime() + 120 * 60_000),
          partySize: party, status: 'BOOKED', source: 'DESK', creationKey: `seed-${randomUUID()}`, creationFingerprint: 'x'.repeat(64),
        },
      })
      .then(async (r) => {
        if (tableId) await admin.tableAssignment.create({ data: { reservationId: r.id, tableId } });
        return r;
      });

  it('есть стол: проверка, котировка, бронь BOOKED с источником VOICE, клиентом и комментарием, стол не назначен', async () => {
    const d = day();
    const c = call('ok');
    expect(await service.check(q(d, '19:00', 4, c))).toMatchObject({ ok: true, period: 'Ужин' });
    const quote = await service.quote(q(d, '19:00', 4, c));
    const done = await service.confirm({ agent, call: c, quote: quote.quote, consent: true, guest });
    expect(done).toMatchObject({ status: 'BOOKED', partySize: 4, pendingApproval: true });
    const row = await admin.restaurantReservation.findFirstOrThrow({
      where: { locationId: w.ids.fl1!, creationKey: `voice:${quote.quote}` },
      include: { tableAssignment: true, customer: true },
    });
    expect(row).toMatchObject({ source: 'VOICE', status: 'BOOKED', createdById: null, partySize: 4 });
    expect(row.tableAssignment).toBeNull();
    expect(row.notes).toContain('Бронь по телефону');
    expect(row.notes).toContain('детский стул');
    expect((await admin.voiceBookingQuote.findUniqueOrThrow({ where: { id: quote.quote } })).state).toBe('CONFIRMED');
    const audit = await admin.auditLog.findFirst({ where: { entityId: row.id, action: 'food.reservation.created' } });
    expect((audit?.after as { source?: string }).source).toBe('VOICE');
  });

  it('повтор подтверждения не плодит вторую бронь', async () => {
    const d = day();
    const c = call('replay');
    const quote = await service.quote(q(d, '19:00', 2, c));
    await service.confirm({ agent, call: c, quote: quote.quote, consent: true, guest });
    await service.confirm({ agent, call: c, quote: quote.quote, consent: true, guest });
    expect(await admin.restaurantReservation.count({ where: { creationKey: `voice:${quote.quote}` } })).toBe(1);
  });

  it('вместимость: на 6 гостей подходит только большой стол; заняли его с буфером: мест нет', async () => {
    const d = day();
    const big = (await admin.diningTable.findFirstOrThrow({ where: { areaId: area, name: 'Большой' } })).id;
    expect(await service.check(q(d, '12:00', 6, call('cap')))).toMatchObject({ ok: true });
    await seed(d, '12:00', 6, big);
    // бронь 12:00-14:00 с буфером 15 минут держит большой стол до 14:15: в 14:00 мест на шестерых нет, в 14:15 есть
    expect(await service.check(q(d, '14:00', 6, call('cap')))).toMatchObject({ ok: false });
    expect(await service.check(q(d, '14:15', 6, call('cap')))).toMatchObject({ ok: true });
  });

  it('брони без назначенного стола занимают места: один стол на четверых и одна непосаженная бронь', async () => {
    const d = day();
    const big = (await admin.diningTable.findFirstOrThrow({ where: { areaId: area, name: 'Большой' } })).id;
    await seed(d, '19:00', 8, big);
    // свободен только «Стол 1» на 4, но на это время уже есть непосаженная бронь: честно отказываем
    await seed(d, '19:00', 2, null);
    expect(await service.check(q(d, '19:00', 4, call('unassigned')))).toMatchObject({ ok: false });
  });

  it('правила: больше предела, вне периода, закрытый день и прошедшее время', async () => {
    const d = day();
    expect(await service.check(q(d, '19:00', 7, call('rules')))).toMatchObject({ ok: false });
    expect(await service.check(q(d, '08:00', 2, call('rules')))).toMatchObject({ ok: false, reason: expect.stringContaining('не принимает брони') });
    await admin.foodClosedDay.create({ data: { locationId: w.ids.fl1!, day: new Date(`${d}T00:00:00Z`) } });
    expect(await service.check(q(d, '19:00', 2, call('rules')))).toMatchObject({ ok: false });
    expect(await service.check(q('2020-01-06', '19:00', 2, call('past')))).toMatchObject({ ok: false });
  });

  it('последний стол заняли между котировкой и подтверждением: отказ, котировка отклонена, брони нет', async () => {
    const d = day();
    const big = (await admin.diningTable.findFirstOrThrow({ where: { areaId: area, name: 'Большой' } })).id;
    await seed(d, '19:00', 8, big);
    const q1 = await service.quote(q(d, '19:00', 4, call('race1')));
    const q2 = await service.quote(q(d, '19:00', 4, call('race2')));
    await service.confirm({ agent, call: call('race1'), quote: q1.quote, consent: true, guest });
    await expect(service.confirm({ agent, call: call('race2'), quote: q2.quote, consent: true, guest: { ...guest, name: 'Другой' } })).rejects.toMatchObject({ status: 409 });
    expect((await admin.voiceBookingQuote.findUniqueOrThrow({ where: { id: q2.quote } })).state).toBe('REJECTED');
  });

  it('чужая котировка другого звонка 404; выключатель отказывает; лимит 3 брони за звонок', async () => {
    const d = day();
    const quote = await service.quote(q(d, '14:00', 2, call('own')));
    await expect(service.confirm({ agent, call: call('thief'), quote: quote.quote, consent: true, guest })).rejects.toMatchObject({ status: 404 });
    await admin.voiceProfile.update({ where: { agentId: agent }, data: { bookingEnabled: false } });
    try {
      await expect(service.check(q(d, '14:00', 2, call('off')))).rejects.toMatchObject({ status: 409 });
    } finally {
      await admin.voiceProfile.update({ where: { agentId: agent }, data: { bookingEnabled: true } });
    }
    const c = call('limit');
    const d2 = day();
    for (const time of ['12:00', '15:00', '18:00']) {
      const one = await service.quote(q(d2, time, 2, c));
      await service.confirm({ agent, call: c, quote: one.quote, consent: true, guest });
    }
    await expect(service.quote(q(d2, '21:00', 2, c))).rejects.toMatchObject({ status: 409 });
  });
});
