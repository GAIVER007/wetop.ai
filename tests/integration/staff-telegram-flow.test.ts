import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@pms/database';
import { telegram } from '@pms/integrations';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { INCIDENTS_REPOSITORY } from '../../apps/api/src/guard/incidents.repository';
import { enqueueStaffNotifications } from '../../apps/api/src/staff-telegram/recipients';
import { StaffNotifyWorker } from '../../apps/api/src/staff-telegram/staff-notify.worker';
import { StaffTelegramModule } from '../../apps/api/src/staff-telegram/staff-telegram.module';
import { STAFF_BOT, StaffTelegramService, type StaffBot } from '../../apps/api/src/staff-telegram/staff-telegram.service';
import { actorOf, makeClients, seedUser, url, type Actor } from './core-security/harness';
import { seedBeautyFoodWorld, type BeautyFoodWorld } from './core-security/world';

/**
 * STAFF-TG-20261020 на настоящей базе и под RLS: экран «Уведомления» (код, статус, переключатель, отключение,
 * «Проверить»), вебхук бота (/start <код>, /stop, секрет) и отправщик очереди (повторы, 403, права при отправке,
 * FAILED и неисправность). Telegram подменён fetch-заглушкой: сети нет, токен вымышленный.
 */
const TOKEN = '777000:synthetic-staff-bot-token';
const SECRET = 'synthetic_webhook-secret';

describe.skipIf(!url)('STAFF-TG: подключение Telegram, вебхук бота и отправщик (integration)', () => {
  let admin: Db;
  let tenant: Db;
  let app: INestApplication;
  let base = '';
  let w: BeautyFoodWorld;
  let service: StaffTelegramService;
  let worker: StaffNotifyWorker;
  const actors = new Map<string, Actor>();
  const run = randomBytes(4).toString('hex');
  const users = { staff: '', other: '', foreign: '' };
  const incidents: Array<Record<string, unknown>> = [];
  /** Ответы Telegram по очереди; пусто: 200 ok */
  let answers: Array<{ status: number; body: Record<string, unknown> }> = [];
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const method = input.split('/').pop();
    if (method === 'getMe') return Response.json({ ok: true, result: { id: 1, is_bot: true, username: 'wetop_staff_test_bot' } });
    const next = answers.shift() ?? { status: 200, body: { ok: true, result: { message_id: 1 } } };
    void init;
    return Response.json(next.body, { status: next.status });
  });
  const bot: StaffBot = { client: new telegram.StaffBotClient({ token: TOKEN, fetch: fetchMock as never }), webhookSecret: SECRET };
  const sends = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/sendMessage'));

  async function http(method: string, path: string, actor?: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(actor ? { 'x-test-actor': actor } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
  const start = (chatId: number, text: string, secret = SECRET) =>
    http('POST', '/telegram/staff/webhook', undefined, { update_id: 1, message: { message_id: 1, chat: { id: chatId, type: 'private', username: 'synthetic_staff' }, text } }, { 'x-telegram-bot-api-secret-token': secret });

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    w = await seedBeautyFoodWorld(admin);
    users.staff = await seedUser(admin, w.org, 'STAFF', `tg-s-${run}`);
    users.other = await seedUser(admin, w.org, 'STAFF', `tg-o-${run}`);
    users.foreign = await seedUser(admin, w.foreignOrg, 'STAFF', `tg-f-${run}`);
    actors.set('staff', actorOf(users.staff, w.org, 'STAFF'));
    actors.set('other', actorOf(users.other, w.org, 'STAFF'));
    actors.set('foreign', actorOf(users.foreign, w.foreignOrg, 'STAFF'));
    const prisma = { db: tenant } as unknown as PrismaService;
    const mod = await Test.createTestingModule({ imports: [StaffTelegramModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(STAFF_BOT)
      .useValue(bot)
      .overrideProvider(INCIDENTS_REPOSITORY)
      .useValue({ record: async (o: Record<string, unknown>) => void incidents.push(o) })
      .compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string | undefined>; user?: object }, _res: unknown, next: () => void) => {
      const key = req.headers['x-test-actor'];
      const actor = key ? actors.get(key) : undefined;
      if (actor) req.user = actor;
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor(prisma));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    service = app.get(StaffTelegramService);
    worker = app.get(StaffNotifyWorker);
  }, 120_000);

  afterAll(async () => {
    await admin?.$executeRawUnsafe(`DELETE FROM staff_notifications WHERE recipient_user_id = ANY($1::uuid[])`, Object.values(users));
    await admin?.$executeRawUnsafe(`DELETE FROM staff_telegram_link_codes WHERE user_id = ANY($1::uuid[])`, Object.values(users));
    await admin?.$executeRawUnsafe(`DELETE FROM staff_telegram_links WHERE user_id = ANY($1::uuid[])`, Object.values(users));
    await app?.close();
    await tenant?.$disconnect();
    await admin?.$disconnect();
  });

  beforeEach(() => {
    answers = [];
    fetchMock.mockClear();
    incidents.length = 0;
  });

  describe('экран и вебхук', () => {
    it('без входа экран закрыт; статус до подключения: бот есть, привязки нет', async () => {
      expect((await http('GET', '/profile/telegram')).status).toBe(401);
      const s = await http('GET', '/profile/telegram', 'staff');
      expect(s.status, s.text).toBe(200);
      expect(s.json).toEqual({ botConfigured: true, botUsername: 'wetop_staff_test_bot', link: null });
    });

    it('код: 8 знаков, ссылка t.me, в базе только хэш, новый код гасит прежний', async () => {
      const a = await http('POST', '/profile/telegram/code', 'staff');
      expect(a.status, a.text).toBe(201);
      const code = a.json['code'] as string;
      expect(code).toMatch(/^[A-Z2-9]{8}$/);
      expect(a.json['link']).toBe(`https://t.me/wetop_staff_test_bot?start=${code}`);
      const rows = await admin.$queryRawUnsafe<Array<{ code_hash: string }>>(
        `SELECT code_hash FROM staff_telegram_link_codes WHERE user_id = $1::uuid`,
        users.staff,
      );
      expect(rows.length).toBe(1);
      expect(rows[0]!.code_hash).not.toContain(code);
      const b = await http('POST', '/profile/telegram/code', 'staff');
      // прежний код больше не подходит
      const old = await start(4100001, `/start ${code}`);
      expect(old.json['text']).toMatch(/не подошёл/);
      const ok = await start(4100001, `/start ${b.json['code'] as string}`);
      expect(ok.status, ok.text).toBe(200);
      expect(ok.json).toEqual({ method: 'sendMessage', chat_id: '4100001', text: 'Готово, сюда будут приходить брони с сайта.' });
      // повтор того же кода не проходит
      expect((await start(4100002, `/start ${b.json['code'] as string}`)).json['text']).toMatch(/не подошёл/);
      const s = await http('GET', '/profile/telegram', 'staff');
      expect(s.json['link']).toMatchObject({ username: 'synthetic_staff', siteBookings: true });
    });

    it('вебхук: без секрета 401, чужой секрет 401; группы и прочее молча 200', async () => {
      expect((await start(4100001, '/stop', '')).status).toBe(401);
      expect((await start(4100001, '/stop', 'wrong-secret')).status).toBe(401);
      const group = await http(
        'POST',
        '/telegram/staff/webhook',
        undefined,
        { update_id: 2, message: { chat: { id: -100500, type: 'group' }, text: '/start ABCDEFGH' } },
        { 'x-telegram-bot-api-secret-token': SECRET },
      );
      expect([group.status, group.json]).toEqual([200, {}]);
    });

    it('чужая организация не видит чужую привязку (RLS по членству)', async () => {
      const s = await http('GET', '/profile/telegram', 'foreign');
      expect(s.json['link']).toBeNull();
      const visible = await http('GET', '/profile/telegram', 'other');
      expect(visible.json['link']).toBeNull();
    });

    it('переключатель «Брони с сайта», «Проверить» шлёт в свой чат, «Отключить» и /stop', async () => {
      const off = await http('PATCH', '/profile/telegram', 'staff', { siteBookings: false });
      expect(off.status, off.text).toBe(200);
      expect((off.json['link'] as Record<string, unknown>)['siteBookings']).toBe(false);
      expect((await http('PATCH', '/profile/telegram', 'staff', { siteBookings: 'yes' })).status).toBe(400);
      await http('PATCH', '/profile/telegram', 'staff', { siteBookings: true });
      const t = await http('POST', '/profile/telegram/test', 'staff');
      expect(t.status, t.text).toBe(200);
      expect(JSON.parse(String((sends()[0]![1] as RequestInit).body))).toMatchObject({ chat_id: '4100001' });
      const stop = await start(4100001, '/stop');
      expect(stop.json['text']).toMatch(/отключены/);
      expect((await http('GET', '/profile/telegram', 'staff')).json['link']).toBeNull();
      expect((await http('POST', '/profile/telegram/test', 'staff')).status).toBe(404);
      // снова подключиться тем же путём
      const code = (await http('POST', '/profile/telegram/code', 'staff')).json['code'] as string;
      await start(4100001, `/start ${code}`);
      const del = await http('DELETE', '/profile/telegram', 'staff');
      expect(del.json['link']).toBeNull();
      const again = (await http('POST', '/profile/telegram/code', 'staff')).json['code'] as string;
      await start(4100001, `/start ${again}`);
      expect((await http('GET', '/profile/telegram', 'staff')).json['link']).not.toBeNull();
    });

    it('«Проверить» при 403: привязка отключается, ответ 409', async () => {
      answers = [{ status: 403, body: { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' } }];
      expect((await http('POST', '/profile/telegram/test', 'staff')).status).toBe(409);
      expect((await http('GET', '/profile/telegram', 'staff')).json['link']).toBeNull();
      const code = (await http('POST', '/profile/telegram/code', 'staff')).json['code'] as string;
      await start(4100001, `/start ${code}`);
    });
  });

  describe('отправщик очереди', () => {
    let customerId = '';
    let slot = 0;
    const appointmentSource = async () => {
      const id = randomUUID();
      // свой час на каждую запись: мастер не занят дважды
      const startsAt = new Date(Date.UTC(2040, 0, 2 + slot++, 5, 0));
      customerId ||= (await admin.customer.create({ data: { organizationId: w.org, firstName: 'Айгерим', phone: `+7701${run.replace(/\D/g, '1').slice(0, 3).padEnd(3, '1')}0001` } })).id;
      const customer = { id: customerId };
      await admin.appointment.create({
        data: {
          id,
          locationId: w.ids.bl1!,
          customerId: customer.id,
          employeeId: w.ids.eBl1!,
          serviceId: w.ids.svc!,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 3_600_000),
          price: 900_000n,
          currency: 'KZT',
          source: 'WEBSITE',
        },
      });
      return id;
    };
    const target = async () => {
      const loc = await admin.location.findUniqueOrThrow({ where: { id: w.ids.bl1! } });
      return { organizationId: w.org, businessId: loc.businessId, locationId: loc.id, vertical: 'BEAUTY' as const, kind: 'SITE_APPOINTMENT' as const };
    };
    const row = (sourceId: string) =>
      admin.$queryRawUnsafe<Array<{ status: string; attempts: number; last_error: string | null; next_attempt_at: Date }>>(
        `SELECT status::text, attempts, last_error, next_attempt_at FROM staff_notifications WHERE source_id = $1::uuid AND recipient_user_id = $2::uuid`,
        sourceId,
        users.staff,
      );
    // очередь общая для всех тестов базы: свои строки ставим в начало пачки, чужие не мешают
    const due = (sourceId: string) =>
      admin.$executeRawUnsafe(`UPDATE staff_notifications SET next_attempt_at = timestamptz '2000-01-01' WHERE source_id = $1::uuid`, sourceId);

    it('без токена бота строка пишется сразу SKIPPED, отправщик не тратит попыток', async () => {
      const sourceId = await appointmentSource();
      const n = await enqueueStaffNotifications(admin, { ...(await target()), sourceId }, {});
      expect(n).toBeGreaterThanOrEqual(1);
      expect((await row(sourceId))[0]).toMatchObject({ status: 'SKIPPED', attempts: 0, last_error: 'bot-not-configured' });
      const idle = new StaffNotifyWorker({ db: admin } as never, null, null);
      expect(await idle.tick()).toEqual({ sent: 0, skipped: 0, retried: 0, failed: 0 });
    });

    it('отправка: текст собирается из записи при отправке, кнопка ведёт в журнал дня; SENT', async () => {
      const sourceId = await appointmentSource();
      await enqueueStaffNotifications(admin, { ...(await target()), sourceId }, { TELEGRAM_STAFF_BOT_TOKEN: TOKEN });
      const before = await row(sourceId);
      expect(before[0]).toMatchObject({ status: 'PENDING', attempts: 0 });
      // в очереди нет ни имени, ни телефона гостя
      const raw = await admin.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM staff_notifications WHERE source_id = $1::uuid`, sourceId);
      expect(JSON.stringify(raw)).not.toMatch(/Айгерим|\+7701/);
      await due(sourceId);
      const tick = await worker.tick();
      expect(tick.sent).toBeGreaterThanOrEqual(1);
      const sent = sends().map(([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>);
      const mine = sent.find((b) => b['chat_id'] === '4100001')!;
      expect(mine['text']).toContain('Новая запись с сайта');
      expect(mine['text']).toMatch(/Гость: Айгерим, \+7 701 \d{3} 00 01/);
      expect(JSON.stringify(mine['reply_markup'])).toContain('/appointments?date=');
      expect((await row(sourceId))[0]).toMatchObject({ status: 'SENT', attempts: 1, last_error: null });
    });

    it('ошибка Telegram: повтор с нарастающей паузой, шестая неудача: FAILED и неисправность', async () => {
      const sourceId = await appointmentSource();
      await enqueueStaffNotifications(admin, { ...(await target()), sourceId }, { TELEGRAM_STAFF_BOT_TOKEN: TOKEN });
      const gaps: number[] = [];
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        answers = Array.from({ length: 10 }, () => ({ status: 502, body: { ok: false, error_code: 502, description: 'Bad Gateway' } }));
        await due(sourceId);
        const t0 = Date.now();
        await worker.tick();
        const [r] = await row(sourceId);
        expect(r!.attempts).toBe(attempt);
        if (attempt < 6) {
          expect(r!.status).toBe('PENDING');
          expect(r!.last_error).toBe('telegram-502');
          gaps.push(r!.next_attempt_at.getTime() - t0);
        } else expect(r!.status).toBe('FAILED');
      }
      for (let i = 1; i < gaps.length; i += 1) expect(gaps[i]!).toBeGreaterThan(gaps[i - 1]!);
      expect(incidents.some((o) => o['kind'] === 'staff.notify.failed' && o['subjectId'] === w.ids.bl1)).toBe(true);
      expect(JSON.stringify(incidents)).not.toMatch(/Айгерим|\+7701/);
    });

    it('права проверяются при отправке: сотрудника перевели в другой филиал, строка SKIPPED без отправки', async () => {
      const sourceId = await appointmentSource();
      await enqueueStaffNotifications(admin, { ...(await target()), sourceId }, { TELEGRAM_STAFF_BOT_TOKEN: TOKEN });
      const bl3 = await admin.location.findUniqueOrThrow({ where: { id: w.ids.bl3! } });
      const scope = await admin.membershipScope.create({
        data: { organizationId: w.org, userId: users.staff, role: 'STAFF', businessId: bl3.businessId, locationId: bl3.id },
      });
      try {
        await due(sourceId);
        await worker.tick();
        expect((await row(sourceId))[0]).toMatchObject({ status: 'SKIPPED', last_error: 'not-recipient', attempts: 0 });
        expect(sends().some(([, init]) => String((init as RequestInit).body).includes('4100001'))).toBe(false);
      } finally {
        await admin.membershipScope.delete({ where: { id: scope.id } });
      }
    });

    it('403 при отправке: привязка отключается, строка SKIPPED, повторов нет', async () => {
      const sourceId = await appointmentSource();
      await enqueueStaffNotifications(admin, { ...(await target()), sourceId }, { TELEGRAM_STAFF_BOT_TOKEN: TOKEN });
      answers = Array.from({ length: 10 }, () => ({ status: 403, body: { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' } }));
      await due(sourceId);
      await worker.tick();
      expect((await row(sourceId))[0]).toMatchObject({ status: 'SKIPPED', last_error: 'telegram-403', attempts: 1 });
      const [link] = await admin.$queryRawUnsafe<Array<{ disabled: boolean }>>(
        `SELECT disabled_at IS NOT NULL AS disabled FROM staff_telegram_links WHERE user_id = $1::uuid`,
        users.staff,
      );
      expect(link!.disabled).toBe(true);
      void service;
    });
  });
});
