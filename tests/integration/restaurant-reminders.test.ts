import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import type { mail } from '@pms/integrations';
import { FoodService } from '../../apps/api/src/food-service/food.service';
import { FoodReminderWorker, FoodRemindersService } from '../../apps/api/src/food-service/reminders';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Напоминания гостям ресторана о брони (DATA_MODEL §61, миграция 152, «да» владельца 23.10.2026) на своей PostgreSQL:
 * очередь пишется в транзакции брони, перенос пересчитывает, отмена снимает, гость с улицы не получает; воркер шлёт
 * письмо (подставной почтовый ящик в памяти, настоящих писем нет), без почты кладёт в «Вручную» с текстом и wa.me;
 * «Напомнил»; настройки с версией; база не даёт строку чужой брони и бронь салона. Данные вымышленные (ADR-010).
 */
describe('напоминания гостям ресторана (integration, §61)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db, svc: FoodService, reminders: FoodRemindersService;
  const org = randomUUID(),
    user = randomUUID(),
    business = randomUUID(),
    location = randomUUID(),
    beautyBusiness = randomUUID(),
    beautyLocation = randomUUID();
  let period = '';
  const H = 3_600_000;
  const at = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, role: 'OWNER', scope: 'LOCATION', businessId: business, locationId: location, vertical: 'FOOD_SERVICE' },
      fn,
    );
  // полдень по Алматы через 3 суток: обе отметки (24 ч и 2 ч) в будущем
  const startsAt = (() => {
    const d = new Date(Date.now() + 3 * 86_400_000);
    return new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(d)}T12:00:00+05:00`);
  })();
  const book = (extra: Record<string, unknown> = {}) =>
    at(() =>
      svc.create(randomUUID(), {
        servicePeriodId: period,
        startsAt: startsAt.toISOString(),
        partySize: 3,
        customer: { firstName: 'Гость', lastName: 'Тестовый', phone: '+7 700 111 22 33' },
        ...extra,
      }),
    );
  const queue = (reservationId: string) =>
    db.restaurantReservationNotification.findMany({ where: { reservationId }, orderBy: [{ dueAt: 'asc' }] });

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    svc = new FoodService(prisma);
    reminders = new FoodRemindersService(prisma);
    await db.organization.create({ data: { id: org, name: 'Напоминания', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, name: 'Synthetic owner', email: `food-rem-${user}@example.invalid` } });
    await db.business.createMany({
      data: [
        { id: business, organizationId: org, name: 'Ресторан у гор', vertical: 'FOOD_SERVICE' as const },
        { id: beautyBusiness, organizationId: org, name: 'Салон', vertical: 'BEAUTY' as const },
      ],
    });
    await db.location.createMany({
      data: [
        { id: location, businessId: business, name: 'Филиал', timezone: 'Asia/Almaty', currency: 'KZT', address: 'ул. Абая, 1' },
        { id: beautyLocation, businessId: beautyBusiness, name: 'Салон', timezone: 'Asia/Almaty', currency: 'KZT' },
      ],
    });
    const weekday = new Date(startsAt.getTime() + 5 * H).getUTCDay();
    period = (
      await db.servicePeriod.create({
        data: { locationId: location, name: 'Весь день', weekday, timeFrom: new Date('1970-01-01T00:00:00Z'), timeTo: new Date('1970-01-01T23:59:00Z'), defaultDurationMinutes: 90 },
      })
    ).id;
  });
  afterAll(async () => db?.$disconnect());

  it('бронь со стойки: два напоминания (за 24 и 2 часа) своей организации и филиала', async () => {
    const r = await book();
    const rows = await queue(r.id);
    expect(rows.map((x) => [x.kind, x.state, startsAt.getTime() - x.dueAt.getTime()])).toEqual([
      ['REMINDER', 'PENDING', 24 * H],
      ['REMINDER', 'PENDING', 2 * H],
    ]);
    expect(rows.every((x) => x.organizationId === org && x.locationId === location)).toBe(true);
  });

  it('перенос пересчитывает, отмена снимает всё ждущее', async () => {
    const r = await book();
    const later = new Date(startsAt.getTime() + H);
    const moved = await at(() =>
      svc.update(r.id, { expectedStatus: r.status, expectedUpdatedAt: new Date(r.updatedAt).toISOString(), startsAt: later.toISOString(), servicePeriodId: period, partySize: 3 }),
    );
    const rows = await queue(r.id);
    expect(rows.filter((x) => x.state === 'PENDING').map((x) => later.getTime() - x.dueAt.getTime())).toEqual([24 * H, 2 * H]);
    expect(rows.filter((x) => x.state === 'CANCELLED')).toHaveLength(2);
    await at(() => svc.status(r.id, { expectedStatus: moved.status, expectedUpdatedAt: new Date(moved.updatedAt).toISOString(), status: 'CANCELLED' }));
    expect((await queue(r.id)).filter((x) => x.state === 'PENDING')).toEqual([]);
  });

  it('воркер: письмо гостю с почтой, без почты «Вручную» с текстом и wa.me; «Напомнил»', async () => {
    // почта гостя хранится в карточке клиента (в форме брони её нет)
    const withMail = await book({ customer: { firstName: 'Айгуль', phone: '+7 700 333 44 55' } });
    await db.customer.update({ where: { id: withMail.customerId }, data: { email: 'aigul.guest@example.invalid' } });
    const noMail = await book({ customer: { firstName: 'Ерлан', phone: '+7 700 555 66 77' } });
    const letters: mail.MailMessage[] = [];
    const worker = new FoodReminderWorker({ db } as unknown as PrismaService, { send: async (m) => void letters.push(m) });
    const due = new Date(startsAt.getTime() - 24 * H + 60_000);
    const first = await worker.runOnce(due);
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(first.manual).toBeGreaterThanOrEqual(1);
    const letter = letters.find((m) => m.to === 'aigul.guest@example.invalid')!;
    expect(letter.subject).toBe('Напоминание о брони');
    expect(letter.text).toContain('Здравствуйте, Айгуль! Напоминаем о брони в Ресторан у гор');
    expect(letter.text).toContain('3 гостя. Адрес: ул. Абая, 1.');
    expect(await worker.runOnce(due)).toEqual({ sent: 0, manual: 0, retried: 0, failed: 0, cancelled: 0 });

    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(due);
    const list = await at(() => reminders.day(day));
    const manual = list.items.find((x) => x.reservationId === noMail.id && x.state === 'MANUAL')!;
    expect(manual).toMatchObject({ kindLabel: 'Напомнить о брони', stateLabel: 'Вручную', customerName: 'Ерлан', partySize: 3 });
    expect(manual.whatsappUrl).toMatch(/^https:\/\/wa\.me\/77005556677\?text=/);
    expect(list.items.find((x) => x.reservationId === withMail.id)).toMatchObject({ state: 'SENT', channel: 'EMAIL', text: null });
    await at(() => reminders.done(manual.id));
    expect((await db.restaurantReservationNotification.findUniqueOrThrow({ where: { id: manual.id } })).state).toBe('SENT');
    // ждущее (за 2 часа) отмечать руками нельзя: оно уйдёт само
    const waiting = (await queue(noMail.id)).find((x) => x.state === 'PENDING')!;
    await expect(at(() => reminders.done(waiting.id))).rejects.toThrow('отправляется само');
  });

  it('настройки: версия, выключение снимает ждущие у будущих броней, устаревшая версия отказ', async () => {
    const r = await book();
    expect(await at(() => reminders.settings())).toMatchObject({ configured: false, revision: 0, enabled: true, hoursBefore: [24, 2] });
    await at(() => reminders.saveSettings({ expectedRevision: 0, enabled: true, hoursBefore: [3], template: null, whatsappTemplateName: null }));
    expect((await queue(r.id)).filter((x) => x.state === 'PENDING').map((x) => startsAt.getTime() - x.dueAt.getTime())).toEqual([3 * H]);
    await expect(
      at(() => reminders.saveSettings({ expectedRevision: 0, enabled: false, hoursBefore: [3], template: null, whatsappTemplateName: null })),
    ).rejects.toThrow('изменены');
    const off = await at(() => reminders.saveSettings({ expectedRevision: 1, enabled: false, hoursBefore: [3], template: null, whatsappTemplateName: null }));
    expect(off).toMatchObject({ enabled: false, revision: 2 });
    expect((await queue(r.id)).filter((x) => x.state === 'PENDING')).toEqual([]);
    await at(() => reminders.saveSettings({ expectedRevision: 2, enabled: true, hoursBefore: [24, 2], template: null, whatsappTemplateName: null }));
  });

  it('база: строка на чужую организацию или на филиал салона не ложится; удалить строку нельзя по ключу', async () => {
    const r = await book();
    const row = (await queue(r.id))[0]!;
    await expect(
      db.restaurantReservationNotification.create({
        data: { organizationId: org, locationId: beautyLocation, reservationId: r.id, customerId: row.customerId, kind: 'REMINDER', dueAt: new Date(Date.now() + H) },
      }),
    ).rejects.toThrow(/another reservation/);
    await expect(db.restaurantReservationNotification.update({ where: { id: row.id }, data: { dueAt: new Date() } })).rejects.toThrow(/immutable/);
    await expect(db.foodReminderSettings.create({ data: { locationId: beautyLocation } })).rejects.toThrow(/Food Service location/);
    await expect(
      db.restaurantReservationNotification.create({
        data: { organizationId: org, locationId: location, reservationId: r.id, customerId: row.customerId, kind: 'REVIEW_REQUEST', dueAt: new Date(Date.now() + H) },
      }),
    ).rejects.toThrow(/restaurant_reservation_notifications_values/);
  });
});
