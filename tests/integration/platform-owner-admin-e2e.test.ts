import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PlatformModule } from '../../apps/api/src/platform/platform.module';
import { useApiBodyParsers } from '../../apps/api/src/body-parsers';
import { purgeAuditRows } from '../tools/audit-purge';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Кабинет владельцев WETOP (VTOP Owner Admin), сквозная цепочка на настоящей базе (ТЗ владельца 01.11.2026, Task 1):
 * Клиент → Подписка → Оплата → Доход → MRR/ARR → Комиссия партнёра → Финансы → Обзор.
 * Одно действие главного администратора (оплата подписки) должно сразу и согласованно поменять все разделы:
 * «Деньги», «Обзор WETOP», «Рост» (MRR), «Партнёры». Отмена оплаты возвращает все цифры назад.
 * Сравниваются приращения: в тестовой базе есть другие клиенты, их цифры тест не трогает. Всё вымышленное.
 */
const url = process.env.DATABASE_URL;

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!url)('VTOP Owner Admin: Клиент → Подписка → Оплата → Доход → MRR/ARR → Комиссия → Финансы → Обзор', () => {
  let db: Db, app: INestApplication, base: string;
  const adminId = randomUUID();
  const strangerId = randomUUID();
  const strangerOrg = randomUUID();
  const clientOrg = randomUUID();
  const mark = Date.now().toString(36);
  const made: { plan?: string; partner?: string; payments: string[]; expenses: string[] } = { payments: [], expenses: [] };
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  async function call(method: string, path: string, body?: unknown, as: 'admin' | 'stranger' = 'admin') {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'x-test-as': as,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as J, text };
  }
  const ok = async (method: string, path: string, body?: unknown) => {
    const r = await call(method, path, body);
    expect(r.status, `${method} ${path}: ${r.text.slice(0, 300)}`).toBeLessThan(300);
    return r.body;
  };

  /** Все цифры кабинета, которые должна сдвинуть оплата клиента */
  async function snapshot() {
    const [money, ceo, growth, partners] = await Promise.all([
      ok('GET', `/platform/money?month=${month}`),
      ok('GET', `/platform/ceo-overview?month=${month}`),
      ok('GET', `/platform/growth?month=${month}`),
      ok('GET', '/platform/partners'),
    ]);
    const partner = (partners['partners'] as J[]).find((p) => p['id'] === made.partner) ?? {};
    const client = (money['clients'] as J[]).find((c) => c['id'] === clientOrg) ?? {};
    const n = (v: unknown) => BigInt(String(v ?? '0'));
    return {
      income: n(money['summary']['month']['incomeCents']),
      expenses: n(money['summary']['month']['expensesCents']),
      profit: n(money['summary']['month']['profitCents']),
      paymentsListed: (money['payments'] as J[]).filter((p) => p['organizationId'] === clientOrg && !p['voided']).length,
      paidUntil: client['paidUntil'] as string | null,
      ceoThisMonth: n(ceo['revenue']['thisMonthCents']),
      ceoMrr: n(ceo['revenue']['mrrCents']),
      ceoArr: n(ceo['revenue']['arrCents']),
      ceoActiveSubs: Number(ceo['subscriptions']['active']),
      ceoCash: n(ceo['finance']['cashBalanceCents']),
      ceoIncome: n(ceo['finance']['incomeCents']),
      ceoExpenses: n(ceo['finance']['expensesCents']),
      ceoProfit: n(ceo['finance']['profitCents']),
      ceoPayable: n(ceo['finance']['payableCents']),
      ceoCommissions: n(ceo['partners']['commissionsCents']),
      ceoPartnerRevenue: n(ceo['partners']['revenueCents']),
      growthMrr: n(growth['kpi']['mrrCents']),
      partnerIncome: n(partner['incomeCents']),
      partnerAccrued: n(partner['accruedCents']),
      partnerPaid: n(partner['paidCents']),
      partnerDue: n(partner['dueCents']),
    };
  }
  type Snap = Awaited<ReturnType<typeof snapshot>>;
  const delta = (a: Snap, b: Snap) =>
    Object.fromEntries(
      (Object.keys(a) as Array<keyof Snap>).map((k) => {
        const x = a[k], y = b[k];
        return [k, typeof x === 'bigint' && typeof y === 'bigint' ? String(y - x) : typeof x === 'number' && typeof y === 'number' ? y - x : y];
      }),
    );

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    db = createPrismaClient(url);
    await db.user.create({ data: { id: adminId, email: `vtop-e2e-admin-${mark}@example.invalid`, passwordHash: 'x' } });
    await db.user.create({ data: { id: strangerId, email: `vtop-e2e-stranger-${mark}@example.invalid`, passwordHash: 'x' } });
    await db.organization.create({ data: { id: strangerOrg, name: `Посторонний ${mark} (synthetic)`, status: 'ACTIVE' } });
    // клиент пришёл с сайта на пробный период
    await db.organization.create({
      data: { id: clientOrg, name: `Салон Клиент ${mark} (synthetic)`, status: 'TRIAL', trialEndsAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    const module = await Test.createTestingModule({ imports: [PlatformModule] }).overrideProvider(PrismaService).useValue({ db }).compile();
    app = module.createNestApplication({ bodyParser: false });
    useApiBodyParsers(app);
    app.use((req: { user?: object; headers: Record<string, string> }, _res: unknown, next: () => void) => {
      const admin = req.headers['x-test-as'] === 'admin';
      // посторонний: владелец своей организации, но не главный администратор WETOP
      req.user = { id: admin ? adminId : strangerId, organizationId: strangerOrg, role: 'OWNER', platformAdmin: admin };
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor({ db } as PrismaService));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    if (!db) return;
    await db.platformPayment.deleteMany({ where: { organizationId: clientOrg } });
    if (made.partner) await db.platformExpense.deleteMany({ where: { partnerId: made.partner } });
    await db.platformClientPartner.deleteMany({ where: { organizationId: clientOrg } });
    await db.platformSubscription.deleteMany({ where: { organizationId: clientOrg } });
    if (made.partner) await db.platformPartner.deleteMany({ where: { id: made.partner } });
    if (made.plan) await db.platformPlan.deleteMany({ where: { id: made.plan } });
    await purgeAuditRows(db, { OR: [{ entityId: { in: [clientOrg, strangerOrg] } }, { userId: { in: [adminId, strangerId] } }] } as never);
    await db.organization.deleteMany({ where: { id: { in: [clientOrg, strangerOrg] } } });
    await db.user.deleteMany({ where: { id: { in: [adminId, strangerId] } } });
    await db.$disconnect();
  });

  it('посторонний пользователь не видит и не меняет ничего в кабинете владельцев', async () => {
    const routes: Array<[string, string, unknown?]> = [
      ['GET', '/platform/cabinet'],
      ['GET', `/platform/money?month=${month}`],
      ['GET', `/platform/ceo-overview?month=${month}`],
      ['GET', `/platform/growth?month=${month}`],
      ['GET', '/platform/rnp'],
      ['GET', '/platform/site'],
      ['GET', '/platform/countries'],
      ['GET', '/platform/partners'],
      ['GET', '/platform/organizations'],
      ['GET', '/platform/overview'],
      ['GET', `/platform/organizations/${clientOrg}/card`],
      ['POST', '/platform/plans', { name: 'x', price: '1' }],
      ['PUT', `/platform/subscriptions/${clientOrg}`, { monthly: '1' }],
      ['POST', '/platform/payments', { organizationId: clientOrg, amount: '1', paidOn: today }],
      ['POST', '/platform/expenses', { category: 'OTHER', amount: '1', spentOn: today }],
      ['POST', '/platform/team', { name: 'x' }],
      ['POST', '/platform/partners', { name: 'x', percent: '10' }],
      ['PUT', `/platform/clients/${clientOrg}/partner`, { partnerId: '' }],
      ['PUT', `/platform/organizations/${clientOrg}/status`, { status: 'ACTIVE' }],
    ];
    const leaks: string[] = [];
    for (const [method, path, body] of routes) {
      const r = await call(method, path, body, 'stranger');
      if (r.status !== 403) leaks.push(`${method} ${path} → ${r.status}`);
    }
    expect(leaks).toEqual([]);
    expect(await db.platformPayment.count({ where: { organizationId: clientOrg } })).toBe(0);
  });

  it('оплата подписки сразу и согласованно меняет Деньги, Обзор, MRR/ARR, комиссию партнёра; выплата и отмена тоже', async () => {
    // тариф с разовой выплатой партнёру и партнёр 20 %
    const plan = await ok('POST', '/platform/plans', { name: `E2E Pro ${mark}`, price: '100', periodMonths: 1, partnerPayout: '50' });
    made.plan = plan['id'];
    const partner = await ok('POST', '/platform/partners', { name: `Партнёр ${mark}`, percent: '20' });
    made.partner = partner['id'];
    await ok('PUT', `/platform/clients/${clientOrg}/partner`, { partnerId: made.partner });
    await ok('PUT', `/platform/subscriptions/${clientOrg}`, { planId: made.plan, monthly: '100' });

    const before = await snapshot();
    expect(before.paidUntil).toBeNull();

    // 1. Клиент оплатил подписку
    const pay = await ok('POST', '/platform/payments', { organizationId: clientOrg, amount: '100', paidOn: today, extendMonths: 1, kind: 'PLAN' });
    made.payments.push(pay['id']);
    const paid = await snapshot();
    const nextMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1));
    const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate();
    const until = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), Math.min(Number(today.slice(8, 10)), lastDay)))
      .toISOString()
      .slice(0, 10);
    expect(delta(before, paid)).toEqual({
      income: '10000',
      expenses: '0',
      profit: '10000',
      paymentsListed: 1,
      paidUntil: until,
      ceoThisMonth: '10000',
      ceoMrr: '10000',
      ceoArr: '120000',
      ceoActiveSubs: 1,
      ceoCash: '10000',
      ceoIncome: '10000',
      ceoExpenses: '0',
      ceoProfit: '10000',
      ceoPayable: '5000',
      ceoCommissions: '5000',
      ceoPartnerRevenue: '10000',
      growthMrr: '10000',
      partnerIncome: '10000',
      partnerAccrued: '5000',
      partnerPaid: '0',
      partnerDue: '5000',
    });
    // клиент заплатил: из пробного он стал работающим, и это видно в Обзоре и в карточке
    expect((await db.organization.findUniqueOrThrow({ where: { id: clientOrg } })).status).toBe('ACTIVE');

    // 2. Выплата партнёру: расход «Партнёрам», долг партнёру ноль, касса и прибыль меньше
    const payout = await ok('POST', `/platform/partners/${made.partner}/payouts`, { amount: '50', spentOn: today });
    made.expenses.push(payout['id']);
    const settled = await snapshot();
    expect(delta(paid, settled)).toMatchObject({
      income: '0',
      expenses: '5000',
      profit: '-5000',
      ceoCash: '-5000',
      ceoExpenses: '5000',
      ceoProfit: '-5000',
      ceoPayable: '-5000',
      partnerPaid: '5000',
      partnerDue: '-5000',
    });
    // больше начисленного не выплачивается
    expect((await call('POST', `/platform/partners/${made.partner}/payouts`, { amount: '1', spentOn: today })).status).toBe(400);

    // 3. Отмена ошибочной оплаты: все цифры, которые она сдвинула, возвращаются
    await ok('POST', `/platform/payments/${made.payments[0]}/void`);
    const voided = await snapshot();
    expect(delta(settled, voided)).toMatchObject({
      income: '-10000',
      profit: '-10000',
      paymentsListed: -1,
      paidUntil: null,
      ceoThisMonth: '-10000',
      ceoMrr: '-10000',
      ceoArr: '-120000',
      ceoActiveSubs: -1,
      ceoCash: '-10000',
      growthMrr: '-10000',
      partnerIncome: '-10000',
      partnerAccrued: '-5000',
    });
  });
});
