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
};
const cabinet = {
  source: async () => ({
    organizations: [
      { id: OWN, name: 'WETOP', status: 'TRIAL' as const, trialEndsAt: null, createdAt: new Date(), verticals: [], locations: 0, members: [] },
      { id: LUXX, name: 'Luxx', status: 'ACTIVE' as const, trialEndsAt: null, createdAt: new Date(), verticals: [], locations: 2, members: [] },
    ],
    records30d: [],
    ownOrganizationId: OWN,
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

describe('«оплачено до» после оплаты', () => {
  it('от большего из прежнего срока и дня оплаты; конец месяца не перескакивает', () => {
    expect(extendPaidUntil(null, '2026-10-28', 1)).toBe('2026-11-28');
    expect(extendPaidUntil('2026-11-15', '2026-10-28', 1)).toBe('2026-12-15');
    expect(extendPaidUntil('2026-10-01', '2026-10-28', 1)).toBe('2026-11-28');
    expect(extendPaidUntil(null, '2026-01-31', 1)).toBe('2026-02-28');
    expect(extendPaidUntil(null, '2026-10-28', 12)).toBe('2027-10-28');
  });
});
