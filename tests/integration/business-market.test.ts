import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { BusinessMarketService } from '../../apps/api/src/market/business-market.service';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * «Конкуренты» салона и ресторана через API-сервис (DATA_MODEL §60, миграция 150): филиал из проверенного указателя,
 * гостиница и чужой филиал отказ, снимок дня правится в тот же день, доска собирает уровни по дням. Всё вымышленное.
 */
describe('business-market: соседи и снимки салона (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const service = new BusinessMarketService(prisma as never);
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const org = randomUUID(), otherOrg = randomUUID();
  const salon = randomUUID(), salonLoc = randomUUID();
  const hotel = randomUUID(), hotelLoc = randomUUID();
  const foreign = randomUUID(), foreignLoc = randomUUID();
  const actor = (businessId: string, locationId: string, vertical: 'BEAUTY' | 'HOSPITALITY', organizationId = org) => ({
    userId: user,
    organizationId,
    role: 'OWNER' as const,
    scope: 'LOCATION' as const,
    businessId,
    locationId,
    vertical,
  });
  const asSalon = <T>(fn: () => Promise<T>) => withSignedInUser(actor(salon, salonLoc, 'BEAUTY'), fn);
  beforeAll(async () => {
    await prisma.db.user.create({ data: { id: user, email: `bm-${tag}@example.invalid` } });
    await prisma.db.organization.create({ data: { id: org, name: `Конкуренты ${tag}`, status: 'ACTIVE' } });
    await prisma.db.organization.create({ data: { id: otherOrg, name: `Чужие ${tag}`, status: 'ACTIVE' } });
    await prisma.db.business.create({ data: { id: salon, organizationId: org, name: `Салон ${tag}`, vertical: 'BEAUTY' } });
    await prisma.db.business.create({ data: { id: hotel, organizationId: org, name: `Отель ${tag}`, vertical: 'HOSPITALITY' } });
    await prisma.db.business.create({ data: { id: foreign, organizationId: otherOrg, name: `Чужой ${tag}`, vertical: 'BEAUTY' } });
    await prisma.db.location.create({ data: { id: salonLoc, businessId: salon, name: `Салон ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
    await prisma.db.location.create({ data: { id: hotelLoc, businessId: hotel, name: `Отель ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
    await prisma.db.location.create({ data: { id: foreignLoc, businessId: foreign, name: `Чужой ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
  });
  afterAll(async () => prisma.onModuleDestroy());

  it('сосед добавляется в свой филиал, повтор имени — конфликт, доска пустая без выдумки', async () => {
    const c = await asSalon(() => service.createCompetitor({ name: `Салон рядом ${tag}`, url: 'https://dikidi.net/ru/record/1', distanceM: 120 }));
    expect(c).toMatchObject({ name: `Салон рядом ${tag}`, distanceM: 120, active: true });
    await expect(asSalon(() => service.createCompetitor({ name: ` салон РЯДОМ ${tag} ` }))).rejects.toThrow(/уже есть/);
    const view = await asSalon(() => service.board({ days: '3' }));
    expect(view.board.days).toHaveLength(3);
    expect(view.board.competitors[0]).toMatchObject({ platform: 'Dikidi' });
    expect(view.board.competitors[0]!.cells.every((x) => x.level === null)).toBe(true);
    expect(view.board.summary.withData).toBe(0);
  });

  it('снимок дня: число окон задаёт уровень, повтор в тот же день правит, на доске виден', async () => {
    const view = await asSalon(() => service.board({ days: '2' }));
    const id = view.competitors[0]!.id;
    const today = view.today;
    expect(await asSalon(() => service.putSnapshot(id, { day: today, freeSlots: 2 }))).toEqual({ day: today, level: 'FEW_LEFT', freeSlots: 2 });
    await asSalon(() => service.putSnapshot(id, { day: today, level: 'SOLD_OUT' }));
    const rows = await prisma.db.locationCompetitorSnapshot.findMany({ where: { competitorId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ level: 'SOLD_OUT', source: 'MANUAL', freeSlots: null });
    const after = await asSalon(() => service.board({ days: '2' }));
    expect(after.board.competitors[0]!.cells[0]).toMatchObject({ level: 'SOLD_OUT', source: 'MANUAL' });
    expect(after.board.market[0]).toMatchObject({ withData: 1, tight: 1, full: true });
    await expect(asSalon(() => service.putSnapshot(id, { day: '2000-01-01', level: 'AVAILABLE' }))).rejects.toThrow(/не раньше/);
    const audit = await prisma.db.auditLog.count({ where: { entityType: 'location_competitor', entityId: id } });
    expect(audit).toBeGreaterThanOrEqual(3);
  });

  it('гостиница сюда не ходит, чужой филиал недоступен, чужого соседа не правят', async () => {
    await expect(withSignedInUser(actor(hotel, hotelLoc, 'HOSPITALITY'), () => service.board({}))).rejects.toThrow(/салона и ресторана/);
    // указатель на чужой филиал под своей организацией
    await expect(withSignedInUser(actor(salon, foreignLoc, 'BEAUTY'), () => service.board({}))).rejects.toThrow(/недоступен/);
    const own = (await asSalon(() => service.board({}))).competitors[0]!.id;
    const foreignActor = actor(foreign, foreignLoc, 'BEAUTY', otherOrg);
    await expect(withSignedInUser(foreignActor, () => service.updateCompetitor(own, { name: 'Подлог' }))).rejects.toThrow(/не найден/);
    await expect(withSignedInUser(foreignActor, () => service.putSnapshot(own, { day: '2099-01-01', level: 'AVAILABLE' }))).rejects.toThrow(/не найден/);
    expect((await withSignedInUser(foreignActor, () => service.board({}))).competitors).toEqual([]);
  });

  it('в архив: с доски уходит, в списке остаётся, снимок архивному не пишется', async () => {
    const id = (await asSalon(() => service.board({}))).competitors[0]!.id;
    await asSalon(() => service.updateCompetitor(id, { active: false }));
    const view = await asSalon(() => service.board({}));
    expect(view.board.competitors).toEqual([]);
    expect(view.competitors.find((c) => c.id === id)).toMatchObject({ active: false });
    await expect(asSalon(() => service.putSnapshot(id, { day: view.today, level: 'AVAILABLE' }))).rejects.toThrow(/не найден/);
  });
});
