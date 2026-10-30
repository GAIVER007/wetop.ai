import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthorInterceptor } from '../auth/author.interceptor';
import { PLATFORM_ADMIN_ONLY } from './admin';
import { CABINET_REPOSITORY } from './cabinet.repository';
import {
  MONEY_AMOUNT,
  MONEY_CATEGORY,
  MONEY_DATE,
  MONEY_NO_CLIENT,
  MONEY_NOT_READY,
  MoneyController,
  MONEY_PARTNERS_CATEGORY,
  PARTNER_NAME,
  PARTNER_PERCENT,
  PARTNERS_NOT_READY,
} from './money.controller';
import { MONEY_REPOSITORY, extendPaidUntil, type MoneyRepository } from './money.repository';

/** Деньги компании WETOP (DATA_MODEL §63): только главный администратор, суммы центами строкой, проверка полей */
const OWN = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const LUXX = '6e3a2b0f-9d8c-4f4b-b2a1-7c0d3e5f9a11';
const ADMIN = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const OWNER = '1c7d4d2f-5a5f-4b64-8c8f-3a2e8b0d1b22';

let ready = true;
const added: Array<Record<string, unknown>> = [];
const money: Partial<MoneyRepository> = {
  ready: async () => ready,
  source: async () => ({
    payments: [{ organizationId: LUXX, amountCents: 9900n, paidOn: new Date().toISOString().slice(0, 10), voided: false }],
    expenses: [{ category: 'SERVER', amountCents: 2000n, spentOn: new Date().toISOString().slice(0, 10), voided: false }],
    subscriptions: [{ organizationId: LUXX, monthlyCents: 9900n, paidUntil: '2026-01-01' }],
  }),
  plans: async () => [],
  subscriptions: async () => [{ organizationId: LUXX, planId: null, monthlyCents: 9900n, paidUntil: '2026-01-01', note: null }],
  payments: async () => [],
  expenses: async () => [],
  team: async () => [],
  organizationExists: async (id: string) => id === LUXX,
  addPayment: async (input) => {
    added.push(input);
    return { id: 'p1', organizationId: input.organizationId, amountCents: input.amountCents, paidOn: input.paidOn, note: input.note, voided: false };
  },
  addExpense: async (input) => {
    added.push(input);
    return { id: 'e1', category: input.category, amountCents: input.amountCents, spentOn: input.spentOn, note: input.note, voided: false };
  },
  saveTeamMember: async (input) => {
    added.push(input);
    return { ...input, id: input.id ?? 't1' };
  },
  partnersReady: async () => partnersReady,
  partnersSource: async () => ({
    partners: [{ id: PARTNER, name: 'Айдар', phone: null, email: null, percentBp: 2000, active: true }],
    links: [{ organizationId: LUXX, partnerId: PARTNER }],
    payments: [{ organizationId: LUXX, amountCents: 9900n, voided: false }],
    payouts: [],
  }),
  savePartner: async (input) => {
    added.push(input);
    return { ...input, id: input.id ?? PARTNER };
  },
  partnerExists: async (id: string) => id === PARTNER,
  setClientPartner: async (input) => {
    added.push(input);
  },
  payPartner: async (input) => {
    added.push(input);
    return { id: 'e2', category: 'PARTNERS', amountCents: input.amountCents, spentOn: input.spentOn, note: input.note, voided: false };
  },
};
const PARTNER = '7f4b3c1a-0e9d-4a5c-b3b2-8d1e4f6a0b22';
let partnersReady = true;
/** null: запись компании WETOP есть (миграция 170), репозиторий уже убрал её; смотрящий не исключается */
let cabinetOwn: string | null = OWN;
const cabinet = {
  source: async () => ({
    organizations: [
      { id: OWN, name: 'WETOP', status: 'TRIAL' as const, trialEndsAt: null, createdAt: new Date(), verticals: [], locations: 0, members: [] },
      { id: LUXX, name: 'Luxx', status: 'ACTIVE' as const, trialEndsAt: null, createdAt: new Date(), verticals: [], locations: 2, members: [] },
    ],
    records30d: [],
    ownOrganizationId: cabinetOwn,
  }),
};

let app: INestApplication;
beforeAll(async () => {
  const users: Record<string, { id: string; role: 'OWNER'; platformAdmin: boolean }> = {
    'session-admin': { id: ADMIN, role: 'OWNER', platformAdmin: true },
    'session-owner': { id: OWNER, role: 'OWNER', platformAdmin: false },
  };
  const auth = {
    whoami: vi.fn(async (token: string) => {
      const who = users[token];
      return who
        ? { user: { ...who, organizationId: OWN, email: 'x@example.invalid', name: null }, organization: null, expiresAt: '2026-12-26T00:00:00.000Z' }
        : null;
    }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [MoneyController],
    providers: [
      { provide: MONEY_REPOSITORY, useValue: money },
      { provide: CABINET_REPOSITORY, useValue: cabinet },
      { provide: AuthService, useValue: auth },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_INTERCEPTOR, useClass: AuthorInterceptor },
    ],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  vi.stubEnv('AUTH_REQUIRED', '1');
  ready = true;
  added.length = 0;
  cabinetOwn = OWN;
  partnersReady = true;
});

const api = () => request(app.getHttpServer());
const admin = { 'x-wetop-session': 'session-admin' };

describe('деньги компании WETOP: API', () => {
  it('без отметки главного администратора 403 на чтение и запись', async () => {
    const res = await api().get('/platform/money').set({ 'x-wetop-session': 'session-owner' }).expect(403);
    expect(res.body.message).toBe(PLATFORM_ADMIN_ONLY);
    await api().post('/platform/payments').set({ 'x-wetop-session': 'session-owner' }).send({}).expect(403);
  });

  it('таблиц ещё нет: чтение говорит ready=false, запись 503 со словами', async () => {
    ready = false;
    const res = await api().get('/platform/money').set(admin).expect(200);
    expect(res.body).toMatchObject({ ready: false });
    const w = await api().post('/platform/expenses').set(admin).send({}).expect(503);
    expect(w.body.message).toBe(MONEY_NOT_READY);
  });

  it('сводка: центы строкой, своя организация не клиент, должник по «оплачено до»', async () => {
    const res = await api().get('/platform/money').set(admin).expect(200);
    expect(res.body.summary.month).toMatchObject({ incomeCents: '9900', expensesCents: '2000', profitCents: '7900' });
    expect(res.body.clients.map((c: { name: string }) => c.name)).toEqual(['Luxx']);
    expect(res.body.clients[0]).toMatchObject({ monthlyCents: '9900', paidUntil: '2026-01-01' });
    expect(res.body.summary.overdue).toEqual([{ organizationId: LUXX, paidUntil: '2026-01-01', monthlyCents: '9900', name: 'Luxx' }]);
  });

  it('запись компании WETOP есть: организация смотрящего остаётся клиентом (один кабинет у Юрия и Вячеслава)', async () => {
    cabinetOwn = null;
    const res = await api().get('/platform/money').set(admin).expect(200);
    expect(res.body.clients.map((c: { name: string }) => c.name)).toEqual(['WETOP', 'Luxx']);
  });

  it('оплата: клиент, сумма, дата проверяются; запись с автором и продлением на месяц', async () => {
    expect((await api().post('/platform/payments').set(admin).send({ organizationId: OWNER, amount: '10', paidOn: '2026-10-28' }).expect(400)).body.message).toBe(MONEY_NO_CLIENT);
    expect((await api().post('/platform/payments').set(admin).send({ organizationId: LUXX, amount: '-1', paidOn: '2026-10-28' }).expect(400)).body.message).toBe(MONEY_AMOUNT);
    expect((await api().post('/platform/payments').set(admin).send({ organizationId: LUXX, amount: '10', paidOn: '2026-13-01' }).expect(400)).body.message).toBe(MONEY_DATE);
    const ok = await api().post('/platform/payments').set(admin).send({ organizationId: LUXX, amount: '99.5', paidOn: '2026-10-28' }).expect(201);
    expect(ok.body.amountCents).toBe('9950');
    expect(added[0]).toMatchObject({ organizationId: LUXX, amountCents: 9950n, by: ADMIN, extendMonths: 1 });
  });

  it('расход: статья только из списка', async () => {
    expect((await api().post('/platform/expenses').set(admin).send({ category: 'CAR', amount: '5', spentOn: '2026-10-28' }).expect(400)).body.message).toBe(MONEY_CATEGORY);
    const ok = await api().post('/platform/expenses').set(admin).send({ category: 'SERVER', amount: '20', spentOn: '2026-10-28' }).expect(201);
    expect(ok.body).toMatchObject({ category: 'SERVER', amountCents: '2000' });
  });
});

/** Команда и партнёры WETOP (владелец 30.10.2026, миграция 172) */
describe('команда: цифровой сотрудник; партнёры', () => {
  const api = () => request(app.getHttpServer());
  const admin = { 'x-wetop-session': 'session-admin' };

  it('цифровой сотрудник: имя и зарплата, должность, почта и телефон не пишутся; человек с телефоном', async () => {
    await api().post('/platform/team').set(admin).send({ kind: 'DIGITAL', name: 'ИИ-продавец', role: 'x', email: 'a@b.c', phone: '1', salary: '30' }).expect(201);
    expect(added[0]).toMatchObject({ kind: 'DIGITAL', name: 'ИИ-продавец', role: null, email: null, phone: null, monthlySalaryCents: 3000n });
    await api().post('/platform/team').set(admin).send({ name: 'Айгуль Тестова', role: 'Поддержка', phone: '+974 5500 0002', salary: '800' }).expect(201);
    expect(added[1]).toMatchObject({ kind: 'PERSON', role: 'Поддержка', phone: '+974 5500 0002', monthlySalaryCents: 80000n });
  });

  it('партнёры: список с начисленным и к выплате; без миграции 172 «не подключено»; только главному администратору', async () => {
    await api().get('/platform/partners').set({ 'x-wetop-session': 'session-owner' }).expect(403);
    const res = await api().get('/platform/partners').set(admin).expect(200);
    expect(res.body.partners[0]).toMatchObject({ name: 'Айдар', trials: 1, connected: 1, incomeCents: '9900', accruedCents: '1980', dueCents: '1980' });
    expect(res.body.clients).toEqual([{ organizationId: LUXX, partnerId: PARTNER, name: 'Luxx' }]);
    partnersReady = false;
    expect((await api().get('/platform/partners').set(admin).expect(200)).body).toEqual({ ready: false });
    expect((await api().post('/platform/partners').set(admin).send({ name: 'X', percent: '10' }).expect(503)).body.message).toBe(PARTNERS_NOT_READY);
  });

  it('партнёр: имя и процент 0..100; выплата пишет расход «Партнёрам»; чей клиент ставится и снимается', async () => {
    expect((await api().post('/platform/partners').set(admin).send({ name: 'X', percent: '120' }).expect(400)).body.message).toBe(PARTNER_PERCENT);
    expect((await api().post('/platform/partners').set(admin).send({ percent: '10' }).expect(400)).body.message).toBe(PARTNER_NAME);
    await api().post('/platform/partners').set(admin).send({ name: 'Студия Маркет', percent: '12,5', phone: '+974 5500 0003' }).expect(201);
    expect(added[0]).toMatchObject({ name: 'Студия Маркет', percentBp: 1250, phone: '+974 5500 0003', active: true });
    const pay = await api().post(`/platform/partners/${PARTNER}/payouts`).set(admin).send({ amount: '19.80', spentOn: '2026-10-30' }).expect(201);
    expect(pay.body).toMatchObject({ category: 'PARTNERS', amountCents: '1980' });
    expect(added[1]).toMatchObject({ partnerId: PARTNER, amountCents: 1980n, by: ADMIN });
    await api().post('/platform/partners/7f4b3c1a-0e9d-4a5c-b3b2-000000000000/payouts').set(admin).send({ amount: '1', spentOn: '2026-10-30' }).expect(404);
    await api().put(`/platform/clients/${LUXX}/partner`).set(admin).send({ partnerId: PARTNER }).expect(200);
    await api().put(`/platform/clients/${LUXX}/partner`).set(admin).send({ partnerId: '' }).expect(200);
    expect(added.slice(2)).toEqual([
      { organizationId: LUXX, partnerId: PARTNER, by: ADMIN },
      { organizationId: LUXX, partnerId: null, by: ADMIN },
    ]);
    await api().put(`/platform/clients/${LUXX}/partner`).set(admin).send({ partnerId: OWNER }).expect(400);
  });

  it('выплату партнёру через обычный расход записать нельзя: у неё нет отметки партнёра', async () => {
    const res = await api().post('/platform/expenses').set(admin).send({ category: 'PARTNERS', amount: '5', spentOn: '2026-10-30' }).expect(400);
    expect(res.body.message).toBe(MONEY_PARTNERS_CATEGORY);
  });
});

describe('«оплачено до» после оплаты', () => {
  it('от большего из прежнего срока и дня оплаты; конец месяца не перескакивает', () => {
    expect(extendPaidUntil(null, '2026-10-28', 1)).toBe('2026-11-28');
    expect(extendPaidUntil('2026-11-15', '2026-10-28', 1)).toBe('2026-12-15');
    expect(extendPaidUntil('2026-10-01', '2026-10-28', 1)).toBe('2026-11-28');
    expect(extendPaidUntil(null, '2026-01-31', 1)).toBe('2026-02-28');
    expect(extendPaidUntil(null, '2026-10-28', 12)).toBe('2027-10-28');
  });
});
