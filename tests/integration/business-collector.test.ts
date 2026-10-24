import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { BusinessCollectorService } from '../../apps/api/src/market/business-collector';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Сборщик загрузки соседей салона и ресторана (DATA_MODEL §60, срез 2): служебная запись без пользователя. Список
 * только живых соседей со ссылкой на площадку записи; «сегодня» по поясу филиала соседа; день, который человек сегодня
 * ввёл вручную, остаётся за человеком; повторный прогон того же дня правит прежний снимок. Всё вымышленное.
 */
describe('business-market: служебный сборщик соседей (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const service = new BusinessCollectorService(prisma as never);
  const tag = randomUUID().slice(0, 8);
  const org = randomUUID();
  const salon = randomUUID(), salonLoc = randomUUID();
  const closed = randomUUID(), closedLoc = randomUUID();
  let dikidi = '', manualOnly = '', archived = '', closedSosed = '';
  // 20:30 UTC 23.10 — в Алматы (UTC+5) уже 24.10
  const now = new Date('2026-10-23T20:30:00Z');

  const competitor = (locationId: string, businessId: string, name: string, url: string | null, active = true) =>
    prisma.db.locationCompetitor
      .create({ data: { organizationId: org, businessId, locationId, name: `${name} ${tag}`, url, active } })
      .then((r) => r.id);

  beforeAll(async () => {
    await prisma.db.organization.create({ data: { id: org, name: `Сборщик ${tag}`, status: 'ACTIVE' } });
    await prisma.db.business.create({ data: { id: salon, organizationId: org, name: `Салон ${tag}`, vertical: 'BEAUTY' } });
    await prisma.db.business.create({ data: { id: closed, organizationId: org, name: `Закрытый ${tag}`, vertical: 'BEAUTY', status: 'ARCHIVED' } });
    await prisma.db.location.create({ data: { id: salonLoc, businessId: salon, name: 'Центр', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await prisma.db.location.create({ data: { id: closedLoc, businessId: closed, name: 'Старый', timezone: 'Asia/Almaty', currency: 'KZT' } });
    dikidi = await competitor(salonLoc, salon, 'Студия Dikidi', 'https://dikidi.net/ru/record/2091353');
    manualOnly = await competitor(salonLoc, salon, 'Без площадки', 'https://example.invalid/sosed');
    archived = await competitor(salonLoc, salon, 'Убранный', 'https://dikidi.net/ru/record/555', false);
    closedSosed = await competitor(closedLoc, closed, 'У закрытого', 'https://dikidi.net/ru/record/777');
    // человек сегодня (24.10 по Алматы) сам записал «нет мест» на 25.10
    await prisma.db.locationCompetitorSnapshot.create({
      data: { organizationId: org, locationId: salonLoc, competitorId: dikidi, day: new Date('2026-10-25T00:00:00Z'), observedOn: new Date('2026-10-24T00:00:00Z'), level: 'SOLD_OUT', source: 'MANUAL' },
    });
  });
  afterAll(async () => prisma.onModuleDestroy());

  it('список: только живые соседи со ссылкой на площадку записи, с поясом филиала', async () => {
    const mine = (await service.targets()).filter((t) => t.name.endsWith(tag));
    expect(mine).toEqual([
      { id: dikidi, name: `Студия Dikidi ${tag}`, url: 'https://dikidi.net/ru/record/2091353', platform: 'Dikidi', locationId: salonLoc, timezone: 'Asia/Almaty' },
    ]);
    for (const id of [manualOnly, archived, closedSosed]) expect(mine.map((t) => t.id)).not.toContain(id);
  });

  it('пишет дни «ИИ» от сегодня филиала, день человека не трогает, повтор правит тот же снимок', async () => {
    const entries = [
      { day: '2026-10-24', freeSlots: 0 },
      { day: '2026-10-25', freeSlots: 7 },
      { day: '2026-10-26', freeSlots: 2 },
    ];
    expect(await service.collect(dikidi, { entries }, now)).toEqual({ saved: 2, kept: 1, observedOn: '2026-10-24' });
    expect(await service.collect(dikidi, { entries: [{ day: '2026-10-26', freeSlots: 9 }] }, now)).toMatchObject({ saved: 1 });
    const rows = await prisma.db.locationCompetitorSnapshot.findMany({
      where: { competitorId: dikidi },
      orderBy: { day: 'asc' },
      select: { day: true, level: true, freeSlots: true, source: true, observedOn: true, createdById: true },
    });
    expect(rows.map((r) => [r.day.toISOString().slice(0, 10), r.level, r.freeSlots, r.source])).toEqual([
      ['2026-10-24', 'SOLD_OUT', 0, 'AI_AGENT'],
      ['2026-10-25', 'SOLD_OUT', null, 'MANUAL'],
      ['2026-10-26', 'AVAILABLE', 9, 'AI_AGENT'],
    ]);
    expect(rows.every((r) => r.observedOn.toISOString().startsWith('2026-10-24') && r.createdById === null)).toBe(true);
    const audit = await prisma.db.auditLog.findMany({ where: { entityId: dikidi, action: 'location_competitor.collected' } });
    expect(audit).toHaveLength(2);
    expect(audit[0]!.userId).toBeNull();
  });

  it('убранный сосед, сосед без площадки, у закрытого бизнеса и чужой id: «не найден»; вчерашний день: 400', async () => {
    for (const id of [archived, manualOnly, closedSosed, randomUUID()])
      await expect(service.collect(id, { entries: [{ day: '2026-10-24', freeSlots: 1 }] }, now)).rejects.toThrow(/не найден/);
    await expect(service.collect(dikidi, { entries: [{ day: '2026-10-23', freeSlots: 1 }] }, now)).rejects.toThrow(/можно от 2026-10-24/);
    expect(await prisma.db.locationCompetitorSnapshot.count({ where: { competitorId: { in: [archived, manualOnly, closedSosed] } } })).toBe(0);
  });
});
