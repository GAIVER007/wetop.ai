import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { SiteFormsService } from '../../apps/api/src/site-forms/site-forms.service';
import { PrismaVoiceQuoteStore, VoiceBeautyService } from '../../apps/api/src/marketing-voice/voice-beauty.service';
import { PrismaVoiceIngestRepository } from '../../apps/api/src/marketing-voice/voice-ingest.repository';
import { almatyAt, makeClients, nextMonday, seedUser, url } from './core-security/harness';
import { seedBeautyFoodWorld, type BeautyFoodWorld } from './core-security/world';

/**
 * Запись в салон по телефону на настоящей базе (DATA_MODEL VOICE-BOOKING): салон BL1 (мастера eBl1 и eBl1b, пн 09:00-18:00,
 * услуга 60 мин) из мира проверок, агент голоса с включённой бронью, окна и запись считает тот же расчёт, что у формы сайта.
 */
describe.skipIf(!url)('голосовая запись в салон (integration, VOICE-BOOKING)', () => {
  let admin: Db;
  let tenant: Db;
  let w: BeautyFoodWorld;
  let service: VoiceBeautyService;
  let agent = '';
  let week = 70;
  const run = randomUUID().slice(0, 6);
  const phone = '+77025550101';
  const call = (n: string) => `call-${run}-${n}`;
  const day = () => nextMonday(week++);

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    w = await seedBeautyFoodWorld(admin);
    const user = await seedUser(admin, w.org, 'OWNER', `vb-${run}`);
    agent = (
      await admin.sellerAgent.create({
        data: { organizationId: w.org, createdBy: user, name: `Голос ${run}`, lifecycle: 'active', locationId: w.ids.bl1! },
        select: { id: true },
      })
    ).id;
    await admin.voiceProfile.create({
      data: { agentId: agent, organizationId: w.org, businessId: w.ids.bz!, bookingEnabled: true },
    });
    const adminPrisma = { db: admin } as unknown as PrismaService;
    const forms = new SiteFormsService({ db: tenant } as unknown as PrismaService, {} as never);
    service = new VoiceBeautyService(new PrismaVoiceIngestRepository(adminPrisma), forms, new PrismaVoiceQuoteStore(adminPrisma));
  }, 180_000);

  afterAll(async () => {
    await tenant?.$disconnect();
    await admin?.$disconnect();
  });

  const quoteFor = async (callId: string, d: string, employee: string | null = null, time = '10:00') =>
    service.quote({ agent, call: callId, service: w.ids.svc, employee, startsAt: almatyAt(d, time) });
  const guest = { name: 'Тест Гость', phone, comment: 'Короткая стрижка' };

  it('справочник: услуга с обоими мастерами', async () => {
    const out = await service.catalog({ agent, call: call('cat') });
    const svc = out.services.find((s) => s.id === w.ids.svc);
    expect(svc?.masters.map((m) => m.id).sort()).toEqual([w.ids.eBl1!, w.ids.eBl1b!].sort());
  });

  it('окна, котировка, подтверждение: запись BOOKED с источником VOICE, клиентом, комментарием и аудитом', async () => {
    const d = day();
    const c = call('ok');
    const slots = await service.slots({ agent, call: c, service: w.ids.svc, date: d });
    expect(slots.slots.some((s) => s.time === '10:00')).toBe(true);
    const q = await quoteFor(c, d);
    expect(q).toMatchObject({ time: '10:00', master: 'любой свободный' });
    const done = await service.confirm({ agent, call: c, quote: q.quote, consent: true, guest });
    expect(done).toMatchObject({ status: 'BOOKED', pendingApproval: true });
    const row = await admin.appointment.findFirstOrThrow({ where: { locationId: w.ids.bl1!, creationKey: `voice:${q.quote}` } });
    expect(row).toMatchObject({ source: 'VOICE', status: 'BOOKED', createdById: null });
    expect(row.notes).toContain('Бронь по телефону');
    expect(row.notes).toContain('Короткая стрижка');
    const quote = await admin.voiceBookingQuote.findUniqueOrThrow({ where: { id: q.quote } });
    expect(quote).toMatchObject({ state: 'CONFIRMED', resultId: row.id });
    const audit = await admin.auditLog.findFirst({ where: { entityId: row.id, action: 'beauty.appointment.created' } });
    expect((audit?.after as { source?: string }).source).toBe('VOICE');
  });

  it('повтор подтверждения той же котировки не плодит вторую запись', async () => {
    const d = day();
    const c = call('replay');
    const q = await quoteFor(c, d);
    await service.confirm({ agent, call: c, quote: q.quote, consent: true, guest });
    await service.confirm({ agent, call: c, quote: q.quote, consent: true, guest });
    expect(await admin.appointment.count({ where: { creationKey: `voice:${q.quote}` } })).toBe(1);
  });

  it('к названному мастеру: занятый мастер не получает запись, второй свободен', async () => {
    const d = day();
    const a = await quoteFor(call('m1'), d, w.ids.eBl1!);
    await service.confirm({ agent, call: call('m1'), quote: a.quote, consent: true, guest });
    // у eBl1 10:00 занято: котировка к нему отказывает, к eBl1b проходит
    await expect(quoteFor(call('m2'), d, w.ids.eBl1!)).rejects.toMatchObject({ status: 409 });
    const b = await quoteFor(call('m3'), d, w.ids.eBl1b!);
    expect(b.master).toBeTruthy();
  });

  it('время заняли между котировкой и подтверждением: отказ, котировка отклонена, записи нет', async () => {
    const d = day();
    const q1 = await quoteFor(call('race1'), d, w.ids.eBl1!);
    const q2 = await quoteFor(call('race2'), d, w.ids.eBl1!);
    await service.confirm({ agent, call: call('race1'), quote: q1.quote, consent: true, guest });
    await expect(service.confirm({ agent, call: call('race2'), quote: q2.quote, consent: true, guest: { ...guest, name: 'Другой' } })).rejects.toMatchObject({ status: 409 });
    expect((await admin.voiceBookingQuote.findUniqueOrThrow({ where: { id: q2.quote } })).state).toBe('REJECTED');
  });

  it('время вне графика или чужая котировка: котировки нет, подтверждение другого звонка 404', async () => {
    const d = day();
    await expect(quoteFor(call('late'), d, null, '23:00')).rejects.toMatchObject({ status: 409 });
    const q = await quoteFor(call('own'), d, w.ids.eBl1b!, '12:00');
    await expect(service.confirm({ agent, call: call('thief'), quote: q.quote, consent: true, guest })).rejects.toMatchObject({ status: 404 });
  });

  it('выключатель: пока выключен, справочник и котировка отказывают', async () => {
    await admin.voiceProfile.update({ where: { agentId: agent }, data: { bookingEnabled: false } });
    try {
      await expect(service.catalog({ agent, call: call('off') })).rejects.toMatchObject({ status: 409 });
      await expect(quoteFor(call('off'), day())).rejects.toMatchObject({ status: 409 });
    } finally {
      await admin.voiceProfile.update({ where: { agentId: agent }, data: { bookingEnabled: true } });
    }
  });

  it('лимит броней за звонок (3): четвёртая котировка отказывает', async () => {
    const c = call('limit');
    const d = day();
    for (const [i, time] of ['10:00', '11:00', '12:00'].entries()) {
      const q = await quoteFor(c, d, i === 0 ? w.ids.eBl1! : w.ids.eBl1b!, time);
      await service.confirm({ agent, call: c, quote: q.quote, consent: true, guest });
    }
    await expect(quoteFor(c, d, w.ids.eBl1!, '15:00')).rejects.toMatchObject({ status: 409 });
  });
});
