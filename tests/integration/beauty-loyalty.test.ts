import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { BeautyScheduleService } from '../../apps/api/src/beauty/schedule';
import { BeautyAppointmentsService } from '../../apps/api/src/beauty/appointments';
import { BeautyRemindersService, ClientReminderWorker, syncAppointmentReminders } from '../../apps/api/src/beauty/reminders';
import { BeautyLoyaltyService } from '../../apps/api/src/beauty/loyalty';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Напоминания клиентам, бонусы и подарочные сертификаты салона (docs/decisions/2026-10-21-salon-reminders-loyalty.md,
 * миграции 140-141) на настоящей базе. Вымышленные данные (ADR-010).
 */
describe('салон: напоминания, бонусы, сертификаты (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db;
  let prisma: PrismaService;
  let catalog: BeautyCatalogService;
  let service: BeautyAppointmentsService;
  let reminders: BeautyRemindersService;
  let loyalty: BeautyLoyaltyService;
  let cash: RestaurantService;
  const own = { org: randomUUID(), business: randomUUID(), location: randomUUID(), user: randomUUID() };
  const other = { org: randomUUID(), business: randomUUID(), location: randomUUID() };
  // понедельник не ближе чем через 8 дней: напоминание за 24 часа ещё впереди
  const DATE = (() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 8);
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const at = (hhmm: string, date = DATE) => {
    const [h, m] = hhmm.split(':').map(Number);
    const [y, mo, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y as number, (mo as number) - 1, d, (h as number) - 5, m)).toISOString();
  };
  const H = 3_600_000;
  const as = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: own.user, organizationId: own.org, role: 'OWNER', scope: 'LOCATION', vertical: 'BEAUTY', businessId: own.business, locationId: own.location },
      fn,
    );
  let employeeId = '';
  let pricey = '';
  let cheap = '';
  let phone = 0;

  beforeAll(async () => {
    db = createPrismaClient(url);
    prisma = { db } as unknown as PrismaService;
    catalog = new BeautyCatalogService(prisma);
    service = new BeautyAppointmentsService(prisma);
    reminders = new BeautyRemindersService(prisma);
    loyalty = new BeautyLoyaltyService(prisma);
    cash = new RestaurantService(prisma, null, new StockService(prisma));
    await db.organization.create({ data: { id: own.org, name: `Лояльность ${own.org.slice(0, 8)}`, status: 'ACTIVE' } });
    await db.business.create({ data: { id: own.business, organizationId: own.org, name: 'Салон Лён', vertical: 'BEAUTY' } });
    await db.location.create({ data: { id: own.location, businessId: own.business, name: 'Филиал', address: 'ул. Абая, 10', phone: '+7 727 000 00 00', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await db.user.create({ data: { id: own.user, email: `loyal-${own.user}@example.invalid`, name: 'Владелец' } });
    await db.organization.create({ data: { id: other.org, name: `Чужая ${other.org.slice(0, 8)}`, status: 'ACTIVE' } });
    await db.business.create({ data: { id: other.business, organizationId: other.org, name: 'Чужой салон', vertical: 'BEAUTY' } });
    await db.location.create({ data: { id: other.location, businessId: other.business, name: 'Чужой филиал', timezone: 'Asia/Almaty', currency: 'KZT' } });
    employeeId = (await as(() => catalog.createEmployee({ name: 'Дина' }))).id;
    pricey = (await as(() => catalog.createService({ name: 'Окрашивание', durationMinutes: 60, priceMinor: '800000', currency: 'KZT' }))).id;
    cheap = (await as(() => catalog.createService({ name: 'Чёлка', durationMinutes: 60, priceMinor: '200000', currency: 'KZT' }))).id;
    await as(() => catalog.setEmployeeServices(employeeId, { serviceIds: [pricey, cheap] }));
    for (const s of [pricey, cheap]) await as(() => catalog.setLocationService(s, { enabled: true }));
    const schedule = new BeautyScheduleService(prisma);
    await as(async () => schedule.setWorkingHours(employeeId, { expectedRevision: (await schedule.overview(employeeId)).weekRevision, intervals: [{ weekday: 1, timeFrom: '08:00', timeTo: '20:00' }] }));
  });
  afterAll(async () => db?.$disconnect());

  const book = async (hhmm: string, serviceId = pricey, date = DATE) => {
    const day = await as(() => service.create({ employeeId, serviceId, startsAt: at(hhmm, date), firstName: 'Айгуль', phone: `+7 701 000 10 ${String(phone++).padStart(2, '0')}` }));
    return day.appointments.find((a) => a.startsAt === at(hhmm, date))!;
  };
  const queue = (appointmentId: string) =>
    db.clientNotification.findMany({ where: { appointmentId }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }], select: { id: true, kind: true, state: true, dueAt: true, channel: true, attempts: true, lastError: true } });
  const pay = (id: string, amount: number, method = 'CASH', extra: Record<string, unknown> = {}) =>
    as(() => service.pay(id, { amount, method, idempotencyKey: randomUUID(), ...extra }));
  const refund = (id: string, amount: number, method = 'CASH') =>
    as(() => service.refund(id, { amount, method, reason: 'Клиент недоволен', idempotencyKey: randomUUID() }));
  const balance = async (customerId: string) => (await as(() => loyalty.customerBonuses(customerId))).balanceMinor;
  const customerOf = async (appointmentId: string) => (await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } })).customerId;

  describe('напоминания', () => {
    it('создаются с записью, пересчитываются при переносе, отменяются при отмене', async () => {
      const a = await book('10:00');
      const created = await queue(a.id);
      expect(created.map((q) => [q.kind, q.state, q.dueAt.toISOString()])).toEqual([
        ['REMINDER', 'PENDING', new Date(Date.parse(at('10:00')) - 24 * H).toISOString()],
        ['REMINDER', 'PENDING', new Date(Date.parse(at('10:00')) - 2 * H).toISOString()],
      ]);
      await as(() => service.move(a.id, { startsAt: at('12:00') }));
      const moved = await queue(a.id);
      expect(moved.filter((q) => q.state === 'PENDING').map((q) => q.dueAt.toISOString())).toEqual([
        new Date(Date.parse(at('12:00')) - 24 * H).toISOString(),
        new Date(Date.parse(at('12:00')) - 2 * H).toISOString(),
      ]);
      expect(moved.filter((q) => q.state === 'CANCELLED')).toHaveLength(2);
      // перенос обратно возвращает прежние строки, а не создаёт дубли (натуральный ключ)
      await as(() => service.move(a.id, { startsAt: at('10:00') }));
      const back = await queue(a.id);
      expect(back).toHaveLength(4);
      expect(back.filter((q) => q.state === 'PENDING').map((q) => q.dueAt.toISOString())).toEqual(created.map((q) => q.dueAt.toISOString()));
      await as(() => service.setStatus(a.id, { status: 'CANCELLED' }));
      expect((await queue(a.id)).every((q) => q.state === 'CANCELLED')).toBe(true);
    });

    it('повтор пересчёта ничего не дублирует; база не даёт удалить строку и сменить ключ', async () => {
      const a = await book('13:00');
      await db.$transaction((tx) => syncAppointmentReminders(tx, a.id));
      await db.$transaction((tx) => syncAppointmentReminders(tx, a.id));
      const rows = await queue(a.id);
      expect(rows).toHaveLength(2);
      await expect(db.clientNotification.delete({ where: { id: rows[0]!.id } })).rejects.toThrow(/cancel instead of delete/);
      await expect(db.clientNotification.update({ where: { id: rows[0]!.id }, data: { dueAt: new Date() } })).rejects.toThrow(/immutable/);
      await expect(db.clientNotification.create({ data: {
        organizationId: other.org, locationId: own.location, appointmentId: a.id, customerId: await customerOf(a.id), kind: 'REMINDER', dueAt: new Date(),
      } })).rejects.toThrow(/another appointment, location or organization/);
    });

    it('воркер: без почты и WhatsApp строка уходит в «Вручную» с готовым текстом и ссылкой; второй проход ничего не делает', async () => {
      const a = await book('15:00');
      const due = new Date(Date.parse(at('15:00')) - 2 * H + 60_000);
      const worker = new ClientReminderWorker(prisma, null);
      const first = await worker.runOnce(due);
      expect(first.manual).toBeGreaterThanOrEqual(2);
      expect((await queue(a.id)).map((q) => [q.state, q.channel])).toEqual([['MANUAL', 'MANUAL'], ['MANUAL', 'MANUAL']]);
      const again = await worker.runOnce(due);
      expect(again).toEqual({ sent: 0, manual: 0, retried: 0, failed: 0, cancelled: 0 });
      const dueDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date(Date.parse(at('15:00')) - 2 * H));
      const list = await as(() => reminders.day(dueDay));
      const item = list.items.find((i) => i.appointmentId === a.id && i.state === 'MANUAL')!;
      expect(item.text).toContain('Айгуль');
      expect(item.text).toContain('Окрашивание');
      expect(item.text).toContain('ул. Абая, 10');
      expect(item.whatsappUrl).toMatch(/^https:\/\/wa\.me\/7701000\d{4}\?text=/);
      await as(() => reminders.done(item.id));
      expect((await db.clientNotification.findUniqueOrThrow({ where: { id: item.id } })).state).toBe('SENT');
      // повтор «Напомнил» безвреден
      await expect(as(() => reminders.done(item.id))).resolves.toMatchObject({ state: 'SENT' });
    });

    it('воркер: почта клиента отправляет письмо, ошибки повторяются с паузой и после 5 попыток «Ошибка»', async () => {
      const ok = await book('16:00');
      await db.customer.update({ where: { id: await customerOf(ok.id) }, data: { email: 'aigul.test@example.invalid' } });
      const letters: Array<{ to: string; subject: string; text: string }> = [];
      const due = new Date(Date.parse(at('16:00')) - 24 * H + 60_000);
      const sent = await new ClientReminderWorker(prisma, { send: async (m) => { letters.push(m); } }).runOnce(due);
      expect(sent.sent).toBeGreaterThanOrEqual(1);
      expect(letters.find((l) => l.to === 'aigul.test@example.invalid')?.text).toContain('Окрашивание');
      expect((await queue(ok.id))[0]).toMatchObject({ state: 'SENT', channel: 'EMAIL' });

      const bad = await book('17:00');
      await db.customer.update({ where: { id: await customerOf(bad.id) }, data: { email: 'broken.test@example.invalid' } });
      const failing = new ClientReminderWorker(prisma, { send: async (m) => { if (m.to.startsWith('broken')) throw new Error('mail down'); } });
      let now = new Date(Date.parse(at('17:00')) - 24 * H + 60_000);
      for (let i = 0; i < 5; i++) {
        await failing.runOnce(now);
        now = new Date(now.getTime() + 7 * H);
        if (now.getTime() >= Date.parse(at('17:00')) - 2 * H) break;
      }
      const row = (await queue(bad.id))[0]!;
      expect(row.attempts).toBeGreaterThanOrEqual(3);
      expect(row.lastError).toContain('mail down');
      // доводим до пяти попыток, двигая паузу вручную
      while ((await db.clientNotification.findUniqueOrThrow({ where: { id: row.id } })).state === 'PENDING') {
        await db.clientNotification.update({ where: { id: row.id }, data: { nextAttemptAt: null } });
        await failing.runOnce(new Date(Date.parse(at('17:00')) - 24 * H + 60_000));
      }
      expect(await db.clientNotification.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ state: 'FAILED', attempts: 5 });
    });

    it('настройки филиала: выключение снимает будущие напоминания, версия защищает от двойного сохранения', async () => {
      const a = await book('18:00');
      const s0 = await as(() => reminders.settings());
      expect(s0).toMatchObject({ configured: false, enabled: true, hoursBefore: [24, 2], whatsappConnected: false });
      await as(() => reminders.saveSettings({ expectedRevision: 0, enabled: true, hoursBefore: [48], template: 'Ждём вас, {имя}!', whatsappTemplateName: 'salon_reminder' }));
      expect((await queue(a.id)).filter((q) => q.state === 'PENDING').map((q) => q.dueAt.toISOString())).toEqual([
        new Date(Date.parse(at('18:00')) - 48 * H).toISOString(),
      ]);
      await expect(as(() => reminders.saveSettings({ expectedRevision: 0, enabled: false, hoursBefore: [24], template: null, whatsappTemplateName: null }))).rejects.toThrow('изменены');
      await as(() => reminders.saveSettings({ expectedRevision: 1, enabled: true, hoursBefore: [24, 2], template: null, whatsappTemplateName: null }));
      expect((await queue(a.id)).filter((q) => q.state === 'PENDING')).toHaveLength(2);
    });
  });

  describe('бонусы', () => {
    it('начисление с живых денег, списание до доли чека и баланса, возврат возвращает и снимает', async () => {
      await as(() => loyalty.saveProgram({ expectedRevision: 0, enabled: true, accrualPercent: 10, maxRedeemPercent: 30, expiresDays: null }));
      const a = await book('09:00', pricey, nextMonday(1));
      const customerId = await customerOf(a.id);
      await pay(a.id, 800000, 'CASH');
      expect(await balance(customerId)).toBe('80000');
      // та же клиентка, вторая запись
      const b = (await as(() => service.create({ employeeId, serviceId: cheap, startsAt: at('11:00', nextMonday(1)), customerId }))).appointments.find((r) => r.startsAt === at('11:00', nextMonday(1)))!;
      await expect(pay(b.id, 60001, 'BONUS')).rejects.toThrow('Бонусами можно оплатить не больше 60000');
      await pay(b.id, 60000, 'BONUS');
      await expect(pay(b.id, 1, 'BONUS')).rejects.toThrow('не больше 0');
      expect(await balance(customerId)).toBe('20000');
      const day = await pay(b.id, 140000, 'KASPI');
      expect(day.appointments.find((r) => r.id === b.id)).toMatchObject({ paidMinor: '200000', paidLoyaltyMinor: '60000', paidNonCashMinor: '140000' });
      expect(await balance(customerId)).toBe('34000');
      // бонусы не деньги в кассе
      const balances = (await as(() => cash.cash())).balances.map((x) => x.method);
      expect(balances).not.toContain('BONUS');
      expect(balances).not.toContain('GIFT_CERTIFICATE');
      await as(() => service.setStatus(b.id, { status: 'DONE' }));
      await expect(refund(b.id, 60001, 'BONUS')).rejects.toThrow('Бонусами по записи оплачено меньше');
      await refund(b.id, 60000, 'BONUS');
      await refund(b.id, 70000, 'KASPI');
      // 34000 + 60000 назад - 7000 (половина начисленного с 140000)
      expect(await balance(customerId)).toBe('87000');
      const kinds = (await as(() => loyalty.customerBonuses(customerId))).entries.map((e) => [e.kind, e.amountMinor]);
      expect(kinds).toEqual(expect.arrayContaining([['ACCRUAL', '80000'], ['REDEEM', '-60000'], ['ACCRUAL', '14000'], ['REVERSAL', '60000'], ['REVERSAL', '-7000']]));
    });

    it('аннулирование оплаты снимает начисление; ручная правка с причиной и не в минус; журнал не меняется', async () => {
      const a = await book('14:00', pricey, nextMonday(1));
      const customerId = await customerOf(a.id);
      await pay(a.id, 100000, 'CASH');
      expect(await balance(customerId)).toBe('10000');
      const op = await db.restaurantCashOperation.findFirstOrThrow({ where: { appointmentId: a.id } });
      await as(() => cash.voidCashOperation(op.id));
      expect(await balance(customerId)).toBe('0');
      await expect(as(() => loyalty.adjust(customerId, { amountMinor: '-1', reason: 'Проверка' }))).rejects.toThrow('не больше баланса');
      await expect(as(() => loyalty.adjust(customerId, { amountMinor: '500', reason: ' ' }))).rejects.toThrow('причину');
      const after = await as(() => loyalty.adjust(customerId, { amountMinor: '500', reason: 'Подарок на день рождения' }));
      expect(after.balanceMinor).toBe('500');
      const entry = await db.customerBonusEntry.findFirstOrThrow({ where: { customerId, kind: 'ADJUSTMENT', reason: 'Подарок на день рождения' } });
      await expect(db.customerBonusEntry.update({ where: { id: entry.id }, data: { reason: 'x' } })).rejects.toThrow(/append-only/);
      await expect(db.customerBonusEntry.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
    });

    it('выключенная программа: бонусами не платят и не начисляют', async () => {
      const program = await as(() => loyalty.program());
      await as(() => loyalty.saveProgram({ expectedRevision: program.revision, enabled: false, accrualPercent: 10, maxRedeemPercent: 30, expiresDays: null }));
      const a = await book('16:00', pricey, nextMonday(1));
      await pay(a.id, 100000, 'CASH');
      expect(await balance(await customerOf(a.id))).toBe('0');
      await expect(pay(a.id, 1000, 'BONUS')).rejects.toThrow('Бонусная программа выключена');
      await as(() => loyalty.saveProgram({ expectedRevision: program.revision + 1, enabled: true, accrualPercent: 10, maxRedeemPercent: 30, expiresDays: null }));
    });
  });

  describe('сертификаты', () => {
    it('продажа: сертификат, приход кассы живыми деньгами, повтор по ключу; поиск по коду', async () => {
      const before = (await as(() => cash.cash())).balances.find((x) => x.method === 'CASH')!.balanceMinor;
      const key = randomUUID();
      const sold = await as(() => loyalty.sell({ amountMinor: 300000, method: 'CASH', idempotencyKey: key }));
      expect(sold).toMatchObject({ initialMinor: '300000', balanceMinor: '300000', status: 'ACTIVE', currency: 'KZT' });
      expect(sold.code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
      const replay = await as(() => loyalty.sell({ amountMinor: 300000, method: 'CASH', idempotencyKey: key }));
      expect(replay.id).toBe(sold.id);
      const after = (await as(() => cash.cash())).balances.find((x) => x.method === 'CASH')!.balanceMinor;
      expect(BigInt(after) - BigInt(before)).toBe(300000n);
      const code = `${sold.code.slice(0, 4).toLowerCase()}-${sold.code.slice(4)}`;
      expect(await as(() => loyalty.lookup(code))).toMatchObject({ id: sold.id, balanceMinor: '300000' });
      await expect(as(() => loyalty.sell({ amountMinor: 1000, method: 'BONUS', idempotencyKey: randomUUID() }))).rejects.toThrow('за деньги');
      expect((await as(() => loyalty.certificates())).items.map((c) => c.id)).toContain(sold.id);
    });

    it('погашение частично, просроченный и чужой не принимаются, возврат возвращает остаток', async () => {
      const cert = await as(() => loyalty.sell({ amountMinor: 300000, method: 'KASPI', idempotencyKey: randomUUID() }));
      const a = await book('09:00', pricey, nextMonday(2));
      // просили 500 000, на сертификате 300 000: проведено 300 000, остаток платят другим способом
      const day = await pay(a.id, 500000, 'GIFT_CERTIFICATE', { certificateCode: cert.code });
      expect(day.appointments.find((r) => r.id === a.id)).toMatchObject({ paidMinor: '300000', paidLoyaltyMinor: '300000' });
      expect(await as(() => loyalty.lookup(cert.code))).toMatchObject({ balanceMinor: '0', status: 'USED' });
      await expect(pay(a.id, 1000, 'GIFT_CERTIFICATE', { certificateCode: cert.code })).rejects.toThrow('Сертификат уже использован');
      await expect(pay(a.id, 1000, 'GIFT_CERTIFICATE')).rejects.toThrow('Введите код сертификата');

      const old = await as(() => loyalty.sell({ amountMinor: 100000, method: 'CASH', idempotencyKey: randomUUID() }));
      await db.giftCertificate.update({ where: { id: old.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await expect(pay(a.id, 1000, 'GIFT_CERTIFICATE', { certificateCode: old.code })).rejects.toThrow('Срок сертификата истёк');

      const foreign = await db.giftCertificate.create({ data: {
        organizationId: other.org, businessId: other.business, code: 'ZZZZ2222', initialMinor: 500000n, balanceMinor: 500000n,
        currency: 'KZT', expiresAt: new Date(Date.now() + 30 * 86_400_000),
      } });
      await expect(pay(a.id, 1000, 'GIFT_CERTIFICATE', { certificateCode: foreign.code })).rejects.toThrow('Сертификат не найден');
      await expect(as(() => loyalty.lookup(foreign.code))).rejects.toThrow('Сертификат не найден');

      await as(() => service.setStatus(a.id, { status: 'DONE' }));
      await refund(a.id, 100000, 'GIFT_CERTIFICATE');
      expect(await as(() => loyalty.lookup(cert.code))).toMatchObject({ balanceMinor: '100000', status: 'ACTIVE' });
      await expect(db.giftCertificate.update({ where: { id: cert.id }, data: { balanceMinor: -1n } })).rejects.toThrow(/gift_certificates_values/);
      await expect(db.giftCertificate.delete({ where: { id: cert.id } })).rejects.toThrow(/append-only/);
      // способ лояльности в кассе гостиницы и ресторана база не пускает
      await expect(db.restaurantCashOperation.create({ data: { locationId: own.location, kind: 'INCOME', method: 'BONUS', amount: 1n, currency: 'KZT' } }))
        .rejects.toThrow(/restaurant_cash_operations_loyalty_method/);
    });
  });

  it('RLS: чужая организация не видит очередь, бонусы и сертификаты; своя видит', async () => {
    const client = new pg.Client({ connectionString: url, options: `-c search_path=${process.env.DATABASE_SCHEMA?.trim() || 'public'},public` });
    await client.connect();
    try {
      const tables = ['client_notifications', 'customer_bonus_entries', 'gift_certificates', 'gift_certificate_entries', 'bonus_programs', 'beauty_reminder_settings'];
      const count = async (org: string) => {
        await client.query('BEGIN');
        try {
          await client.query('SET LOCAL ROLE wetop_app');
          await client.query(`SELECT set_config('app.org_id', $1, true)`, [org]);
          const out: Record<string, number> = {};
          for (const t of tables) out[t] = Number((await client.query(`SELECT count(*) FROM ${t}`)).rows[0].count);
          return out;
        } finally {
          await client.query('ROLLBACK');
        }
      };
      const mine = await count(own.org);
      for (const t of tables) expect(mine[t], t).toBeGreaterThan(0);
      const theirs = await count(randomUUID());
      for (const t of tables) expect(theirs[t], t).toBe(0);
      // чужая организация не может записать движение бонусов от имени нашей организации
      const ownCustomer = (await db.customerBonusEntry.findFirstOrThrow({ where: { organizationId: own.org } })).customerId;
      await client.query('BEGIN');
      try {
        await client.query('SET LOCAL ROLE wetop_app');
        await client.query(`SELECT set_config('app.org_id', $1, true)`, [other.org]);
        await expect(client.query(`INSERT INTO customer_bonus_entries (organization_id, business_id, customer_id, kind, amount_minor, currency, reason)
          VALUES ($1, $2, $3, 'ADJUSTMENT', 1, 'KZT', 'x')`, [own.org, own.business, ownCustomer])).rejects.toThrow(/row-level security|requires a Beauty business/);
      } finally {
        await client.query('ROLLBACK');
      }
    } finally {
      await client.end();
    }
  });

  function nextMonday(weeks: number): string {
    const d = new Date(`${DATE}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7 * weeks);
    return d.toISOString().slice(0, 10);
  }
});
