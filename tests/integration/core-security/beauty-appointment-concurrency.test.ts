import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import { BeautyModule } from '../../../apps/api/src/beauty/beauty.module';
import { almatyAt, bootApp, call, makeClients, nextMonday, url } from './harness';
import { seedBeautyFoodWorld, type BeautyFoodWorld } from './world';

/**
 * CORE-SECURITY-FIX-01, U3-b и U5 (CORE-01): две записи Beauty одновременно с НОВЫМ клиентом и одним телефоном давали
 * 201 и 500: проигравшая транзакция падала на уникальном индексе `customers_organization_id_phone_key` (Prisma P2002),
 * который не перехватывался. Двойная отправка формы с новым клиентом и телефоном тоже заканчивалась 500.
 *
 * Правило после правки: проигравший получает управляемый 409, его транзакция откатывается целиком (ни «сироты»-клиента,
 * ни записи), клиент по телефону один, запись одна. Повтор после этого находит клиента по телефону, как обычно.
 */
describe.skipIf(!url)('U3-b: гонка нового телефона и двойная отправка записи Beauty', () => {
  let admin: Db;
  let tenant: Db;
  let app: INestApplication;
  let base = '';
  let w: BeautyFoodWorld;
  let week = 40; // у каждой гонки свой понедельник: слоты мастера не пересекаются между тестами
  let phoneSeq = 0;
  const phone = () =>
    `+7701${Date.now().toString().slice(-4)}${String(++phoneSeq).padStart(3, '0')}`;
  const bl1 = () => ({ businessId: w.ids.bz!, locationId: w.ids.bl1! });

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    w = await seedBeautyFoodWorld(admin);
    ({ app, base } = await bootApp([BeautyModule], tenant, w.actors));
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await tenant?.$disconnect();
    await admin?.$disconnect();
  });

  const book = (
    actor: string,
    day: string,
    at: string,
    employeeId: string,
    customer: Record<string, unknown>,
    scope = bl1(),
  ) =>
    call(base, actor, 'POST', '/beauty/appointments', scope, {
      employeeId,
      serviceId: w.ids.svc,
      startsAt: almatyAt(day, at),
      ...customer,
    });
  const customersWith = (p: string) =>
    admin.customer.findMany({ where: { organizationId: w.org, phone: p } });
  const appointmentsOf = (customerId: string) => admin.appointment.count({ where: { customerId } });
  const sorted = (...rs: Array<{ status: number }>) => rs.map((r) => r.status).sort();

  // ───────── разрешено, как раньше ─────────

  it('ALLOW: запись с новым клиентом и телефоном создаётся (201), клиент один и виден бизнесу', async () => {
    const p = phone();
    const r = await book('staffBl1', nextMonday(week++), '10:00', w.ids.eBl1!, {
      firstName: 'Aida',
      phone: p,
    });
    expect(r.status, r.text).toBe(201);
    const rows = await customersWith(p);
    expect(rows).toHaveLength(1);
    expect(
      await admin.customerBusiness.count({
        where: { customerId: rows[0]!.id, businessId: w.ids.bz! },
      }),
    ).toBe(1);
  });

  it('ALLOW: тот же телефон последовательно находит того же клиента (find-or-create), не создаёт второго', async () => {
    const p = phone();
    const a = await book('mgrBl1', nextMonday(week++), '10:00', w.ids.eBl1!, {
      firstName: 'A',
      phone: p,
    });
    const b = await book('mgrBl1', nextMonday(week++), '10:00', w.ids.eBl1!, {
      firstName: 'A',
      phone: p,
    });
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(await customersWith(p)).toHaveLength(1);
  });

  // ───────── гонка нового телефона ─────────

  it('U3-b: два одновременных запроса с одним новым телефоном (разные мастера, то же время): без 500, клиент один', async () => {
    // PR 532: beautyTransaction берёт строки бизнеса и филиала FOR UPDATE, поэтому записи Beauty одного филиала идут
    // по очереди: второй запрос находит клиента по телефону и проходит (201 и 201). Прежний исход 201 и 409 (проигравший
    // падал на уникальном индексе телефона) тоже допустим, если блокировку когда-нибудь снимут. Недопустим 500, второй
    // клиент и «сирота» после отката.
    for (let i = 0; i < 5; i++) {
      const day = nextMonday(week++);
      const p = phone();
      const [a, b] = await Promise.all([
        book('staffBl1', day, '10:00', w.ids.eBl1!, { firstName: 'Race', phone: p }),
        book('staffBl1', day, '10:00', w.ids.eBl1b!, { firstName: 'Race', phone: p }),
      ]);
      const outcome = sorted(a, b).join('+');
      expect(['201+201', '201+409'], `${i}: ${a.text} | ${b.text}`).toContain(outcome);
      const loser = [a, b].find((r) => r.status !== 201);
      if (loser) expect(typeof loser.json?.message).toBe('string');
      // клиент один; записей столько, сколько вернули 201 (проигравший откатился целиком); связь с бизнесом одна
      const rows = await customersWith(p);
      expect(rows).toHaveLength(1);
      expect(await appointmentsOf(rows[0]!.id)).toBe(outcome === '201+201' ? 2 : 1);
      expect(
        await admin.customerBusiness.count({
          where: { customerId: rows[0]!.id, businessId: w.ids.bz! },
        }),
      ).toBe(1);
    }
  }, 120_000);

  it('U5: двойная отправка формы (два одинаковых запроса одновременно, новый клиент с телефоном): 201 и 409, не 500', async () => {
    for (let i = 0; i < 5; i++) {
      const day = nextMonday(week++);
      const p = phone();
      const body = { firstName: 'Twice', phone: p };
      const [a, b] = await Promise.all([
        book('staffBl1', day, '11:00', w.ids.eBl1!, body),
        book('staffBl1', day, '11:00', w.ids.eBl1!, body),
      ]);
      expect(sorted(a, b), `${i}: ${a.text} | ${b.text}`).toEqual([201, 409]);
      const rows = await customersWith(p);
      expect(rows).toHaveLength(1);
      expect(await appointmentsOf(rows[0]!.id)).toBe(1);
    }
  }, 120_000);

  it('U5: повтор уже выполненной отправки (последовательно): 409 «Мастер уже занят», запись одна', async () => {
    const day = nextMonday(week++);
    const p = phone();
    const body = { firstName: 'Retry', phone: p };
    const a = await book('staffBl1', day, '12:00', w.ids.eBl1!, body);
    const b = await book('staffBl1', day, '12:00', w.ids.eBl1!, body);
    expect(a.status, a.text).toBe(201);
    expect(b.status, b.text).toBe(409);
    const rows = await customersWith(p);
    expect(rows).toHaveLength(1);
    expect(await appointmentsOf(rows[0]!.id)).toBe(1);
  });

  it('после гонки за нового клиента повтор второго запроса (если он проиграл) проходит и находит того же клиента', async () => {
    const day = nextMonday(week++);
    const p = phone();
    const [a, b] = await Promise.all([
      book('staffBl1', day, '13:00', w.ids.eBl1!, { firstName: 'Loser', phone: p }),
      book('staffBl1', day, '13:00', w.ids.eBl1b!, { firstName: 'Loser', phone: p }),
    ]);
    expect(['201+201', '201+409'], `${a.text} | ${b.text}`).toContain(sorted(a, b).join('+'));
    const lostAny = a.status !== 201 || b.status !== 201;
    if (lostAny) {
      const loserMaster = a.status === 201 ? w.ids.eBl1b! : w.ids.eBl1!;
      const again = await book('staffBl1', day, '13:00', loserMaster, {
        firstName: 'Loser',
        phone: p,
      });
      expect(again.status, again.text).toBe(201);
    }
    const rows = await customersWith(p);
    expect(rows).toHaveLength(1);
    expect(await appointmentsOf(rows[0]!.id)).toBe(2);
  });

  // ───────── запрещено: область и организация ─────────

  it('DENY: администратор BL1 не записывает клиента в неназначенный BL2 (403)', async () => {
    const r = await book(
      'staffBl1',
      nextMonday(week++),
      '10:00',
      w.ids.eBl2!,
      { firstName: 'X', phone: phone() },
      { businessId: w.ids.bz!, locationId: w.ids.bl2! },
    );
    expect(r.status, r.text).toBe(403);
  });

  it('DENY: владелец чужой организации не записывает в наш салон', async () => {
    const r = await book('foreignOwner', nextMonday(week++), '10:00', w.ids.eBl1!, {
      firstName: 'X',
      phone: phone(),
    });
    expect([403, 404], r.text).toContain(r.status);
  });
});
