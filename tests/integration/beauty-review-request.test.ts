import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { reviewRequestDueAt } from '@pms/domain';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { BeautyScheduleService } from '../../apps/api/src/beauty/schedule';
import { BeautyAppointmentsService } from '../../apps/api/src/beauty/appointments';
import { BeautyRemindersService, ClientReminderWorker, syncAppointmentReminders } from '../../apps/api/src/beauty/reminders';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Просьба отзыва после «Выполнено» (docs/decisions/2026-10-21-salon-reminders-loyalty.md, «Просьба отзыва»):
 * строка REVIEW_REQUEST в очереди client_notifications пишется в транзакции смены состояния, воркер выпускает
 * приглашение на отзыв и отдаёт текст со ссылкой почтой или в список «Напомнить сегодня». Вымышленные данные (ADR-010).
 */
describe('салон: просьба отзыва после визита (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  const APP = 'https://app.review.test';
  let db: Db;
  let prisma: PrismaService;
  let service: BeautyAppointmentsService;
  let reminders: BeautyRemindersService;
  const own = { org: randomUUID(), business: randomUUID(), location: randomUUID(), user: randomUUID() };
  // понедельник не ближе чем через 22 дня: позже очередей соседнего набора beauty-loyalty, но в пределах 30 дней приглашения
  const DATE = (() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 22);
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const [y, mo, d] = DATE.split('-').map(Number);
    return new Date(Date.UTC(y as number, (mo as number) - 1, d, (h as number) - 5, m)).toISOString();
  };
  const as = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: own.user, organizationId: own.org, role: 'OWNER', scope: 'LOCATION', vertical: 'BEAUTY', businessId: own.business, locationId: own.location },
      fn,
    );
  let employeeId = '';
  let serviceId = '';
  let phone = 0;
  const previousAppUrl = process.env.PUBLIC_APP_URL;
  const previousSecret = process.env.SESSION_SECRET;

  beforeAll(async () => {
    process.env.PUBLIC_APP_URL = APP;
    process.env.SESSION_SECRET = 'local-review-request-key-not-production';
    db = createPrismaClient(url);
    prisma = { db } as unknown as PrismaService;
    const catalog = new BeautyCatalogService(prisma);
    service = new BeautyAppointmentsService(prisma);
    reminders = new BeautyRemindersService(prisma);
    await db.organization.create({ data: { id: own.org, name: `Отзывы ${own.org.slice(0, 8)}`, status: 'ACTIVE' } });
    await db.business.create({ data: { id: own.business, organizationId: own.org, name: 'Салон Ива', vertical: 'BEAUTY' } });
    await db.location.create({ data: { id: own.location, businessId: own.business, name: 'Филиал', address: 'ул. Сатпаева, 5', phone: '+7 727 000 00 01', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await db.user.create({ data: { id: own.user, email: `review-${own.user}@example.invalid`, name: 'Владелец' } });
    employeeId = (await as(() => catalog.createEmployee({ name: 'Камила' }))).id;
    serviceId = (await as(() => catalog.createService({ name: 'Стрижка', durationMinutes: 60, priceMinor: '500000', currency: 'KZT' }))).id;
    await as(() => catalog.setEmployeeServices(employeeId, { serviceIds: [serviceId] }));
    await as(() => catalog.setLocationService(serviceId, { enabled: true }));
    const schedule = new BeautyScheduleService(prisma);
    await as(async () => schedule.setWorkingHours(employeeId, { expectedRevision: (await schedule.overview(employeeId)).weekRevision, intervals: [{ weekday: 1, timeFrom: '08:00', timeTo: '20:00' }] }));
  });
  afterAll(async () => {
    if (previousAppUrl === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = previousAppUrl;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
    await db?.$disconnect();
  });

  const book = async (hhmm: string) => {
    const day = await as(() => service.create({ employeeId, serviceId, startsAt: at(hhmm), firstName: 'Жанар', phone: `+7 702 000 20 ${String(phone++).padStart(2, '0')}` }));
    return day.appointments.find((a) => a.startsAt === at(hhmm))!;
  };
  const reviewRows = (appointmentId: string) =>
    db.clientNotification.findMany({ where: { appointmentId, kind: 'REVIEW_REQUEST' }, orderBy: { createdAt: 'asc' }, select: { id: true, state: true, dueAt: true, channel: true, lastError: true } });
  const done = async (appointmentId: string) => {
    const before = new Date();
    await as(() => service.setStatus(appointmentId, { status: 'DONE' }));
    const after = new Date();
    const a = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId }, select: { endsAt: true } });
    return { before, after, endsAt: a.endsAt };
  };
  /** Сменить состояние в обход стойки (служебная правка): так запись уходит из «Выполнено» */
  const forceStatus = (appointmentId: string, status: 'CANCELLED' | 'BOOKED', sync = true) =>
    db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('wetop.appointment_lines_write','on',true)`;
      await tx.appointment.update({ where: { id: appointmentId }, data: { status } });
      if (sync) await syncAppointmentReminders(tx, appointmentId);
    });
  const dueDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(d);

  it('«Выполнено» ставит одну просьбу отзыва через 2 часа после визита; напоминания снимаются; повтор не дублирует', async () => {
    const a = await book('10:00');
    const { endsAt, before, after } = await done(a.id);
    const rows = await reviewRows(a.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe('PENDING');
    // визит в будущем: конец позже «Выполнено», значит конец + 2 часа (11:00 + 2 = 13:00 по Алматы)
    expect(rows[0]!.dueAt.toISOString()).toBe(reviewRequestDueAt({ endsAt, doneAt: after, timezone: 'Asia/Almaty' }).toISOString());
    expect(rows[0]!.dueAt.toISOString()).toBe(reviewRequestDueAt({ endsAt, doneAt: before, timezone: 'Asia/Almaty' }).toISOString());
    const reminderRows = await db.clientNotification.findMany({ where: { appointmentId: a.id, kind: 'REMINDER' } });
    expect(reminderRows.every((r) => r.state === 'CANCELLED')).toBe(true);
    await db.$transaction((tx) => syncAppointmentReminders(tx, a.id));
    await db.$transaction((tx) => syncAppointmentReminders(tx, a.id, { now: new Date(Date.now() + 3_600_000) }));
    expect(await reviewRows(a.id)).toHaveLength(1);
  });

  it('запись ушла из «Выполнено» до отправки: ждущая просьба отменяется; воркер тоже снимает такую строку', async () => {
    const a = await book('11:00');
    await done(a.id);
    await forceStatus(a.id, 'CANCELLED');
    expect((await reviewRows(a.id)).map((r) => r.state)).toEqual(['CANCELLED']);

    const b = await book('12:00');
    await done(b.id);
    const due = (await reviewRows(b.id))[0]!.dueAt;
    await forceStatus(b.id, 'BOOKED', false);
    const result = await new ClientReminderWorker(prisma, null).runOnce(new Date(due.getTime() + 60_000));
    expect(result.cancelled).toBeGreaterThanOrEqual(1);
    expect((await reviewRows(b.id)).map((r) => r.state)).toEqual(['CANCELLED']);
  });

  it('напоминания выключены в филиале: просьбы отзыва нет', async () => {
    const a = await book('13:00');
    await as(() => reminders.saveSettings({ expectedRevision: 0, enabled: false, hoursBefore: [24, 2], template: null, whatsappTemplateName: null }));
    try {
      await done(a.id);
      expect(await reviewRows(a.id)).toHaveLength(0);
    } finally {
      await as(() => reminders.saveSettings({ expectedRevision: 1, enabled: true, hoursBefore: [24, 2], template: null, whatsappTemplateName: null }));
    }
  });

  it('воркер без почты: «Вручную» со ссылкой на отзыв и wa.me; в списке «Попросить отзыв»; отметка выполнения', async () => {
    const a = await book('14:00');
    await done(a.id);
    const row = (await reviewRows(a.id))[0]!;
    const worker = new ClientReminderWorker(prisma, null);
    const first = await worker.runOnce(new Date(row.dueAt.getTime() + 60_000));
    expect(first.manual).toBeGreaterThanOrEqual(1);
    expect((await reviewRows(a.id))[0]).toMatchObject({ state: 'MANUAL', channel: 'MANUAL' });
    const invitation = await db.beautyReviewInvitation.findUniqueOrThrow({ where: { appointmentId: a.id } });
    expect(invitation.submittedAt).toBeNull();
    const list = await as(() => reminders.day(dueDay(row.dueAt)));
    const item = list.items.find((i) => i.appointmentId === a.id && i.kind === 'REVIEW_REQUEST')!;
    expect(item.kindLabel).toBe('Попросить отзыв');
    expect(item.text).toMatch(new RegExp(`^Спасибо, что были у нас, Жанар! Оцените визит: ${APP.replace(/\./g, '\\.')}/reviews/[A-Za-z0-9_-]{40,100}$`));
    expect(item.text).not.toContain('\u2014');
    // ключ в тексте соответствует приглашению в базе (в базе только хэш)
    const token = item.text!.split('/reviews/')[1]!;
    expect(createHash('sha256').update(token).digest('hex')).toBe(invitation.tokenHash);
    expect(item.whatsappUrl).toMatch(/^https:\/\/wa\.me\/7702000\d{4}\?text=/);
    expect(decodeURIComponent(item.whatsappUrl!.split('text=')[1]!)).toBe(item.text);
    // список перечитывается: ссылка та же, приглашение не перевыпускается на каждое открытие журнала
    const again = await as(() => reminders.day(dueDay(row.dueAt)));
    expect(again.items.find((i) => i.id === item.id)!.text).toBe(item.text);
    await as(() => reminders.done(item.id));
    expect((await db.clientNotification.findUniqueOrThrow({ where: { id: item.id } })).state).toBe('SENT');
    // напоминание о записи и просьба отзыва различимы
    const reminderItem = list.items.find((i) => i.kind === 'REMINDER');
    if (reminderItem) expect(reminderItem.kindLabel).toBe('Напомнить о записи');
  });

  it('воркер с почтой клиента: письмо «Как прошёл визит» со ссылкой на отзыв', async () => {
    const a = await book('15:00');
    const customerId = (await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).customerId;
    await db.customer.update({ where: { id: customerId }, data: { email: 'zhanar.review@example.invalid' } });
    await done(a.id);
    const row = (await reviewRows(a.id))[0]!;
    const letters: Array<{ to: string; subject: string; text: string }> = [];
    const sent = await new ClientReminderWorker(prisma, { send: async (m) => { letters.push(m); } }).runOnce(new Date(row.dueAt.getTime() + 60_000));
    expect(sent.sent).toBeGreaterThanOrEqual(1);
    const letter = letters.find((l) => l.to === 'zhanar.review@example.invalid')!;
    expect(letter.subject).toBe('Как прошёл визит');
    expect(letter.text).toContain(`${APP}/reviews/`);
    expect((await reviewRows(a.id))[0]).toMatchObject({ state: 'SENT', channel: 'EMAIL' });
  });

  it('приглашение не выпускается (отзыв уже оставлен): строка отменяется с причиной, воркер не падает', async () => {
    const a = await book('16:00');
    await done(a.id);
    const row = (await reviewRows(a.id))[0]!;
    await db.beautyReviewInvitation.create({ data: { appointmentId: a.id, tokenHash: createHash('sha256').update(randomUUID()).digest('hex'), expiresAt: new Date(Date.now() + 86_400_000), submittedAt: new Date() } });
    const result = await new ClientReminderWorker(prisma, null).runOnce(new Date(row.dueAt.getTime() + 60_000));
    expect(result.cancelled).toBeGreaterThanOrEqual(1);
    const after = (await reviewRows(a.id))[0]!;
    expect(after.state).toBe('CANCELLED');
    expect(after.lastError).toBe('Клиент отзыв уже оставил');
  });
});
