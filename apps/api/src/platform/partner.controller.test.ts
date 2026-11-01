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
import {
  PARTNER_CABINET_REPOSITORY,
  PARTNER_INVITE_INVALID,
  PARTNER_JOIN_PASSWORD_MISMATCH,
  PARTNER_JOIN_PHONE,
  PARTNER_NOT_PARTNER,
  PartnerController,
  type PartnerCabinetRepository,
} from './partner.controller';

/** Кабинет партнёра (DATA_MODEL §63.3): приглашение только главным администратором, кабинет только своему партнёру */
const ADMIN = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const PARTNER_USER = '2d8e5e3a-6b6a-4c75-9d9a-4b3f9c1e2c33';
const STRANGER = '3e9f6f4b-7c7b-4d86-ae0b-5c4a0d2f3d44';
const PARTNER = '7f4b3c1a-0e9d-4a5c-b3b2-111111111111';

const calls: Array<[string, unknown]> = [];
const repo: PartnerCabinetRepository = {
  invite: async (input) => {
    calls.push(['invite', input]);
    return input.partnerId === PARTNER ? { token: 'tok-123', email: 'aidar@example.invalid', code: 'P001' } : null;
  },
  preview: async (token) => (token === 'tok-123' ? { partnerName: 'Айдар', email: 'aidar@example.invalid' } : null),
  join: async (token, input) => {
    calls.push(['join', { token, ...input }]);
    if (token !== 'tok-123') return { ok: false, reason: 'invalid' };
    return { ok: true, email: input.email, sent: true };
  },
  cabinet: async (userId) =>
    userId === PARTNER_USER
      ? {
          partner: { name: 'Айдар', code: 'P001', percentBp: 3000 },
          links: { client: 'https://app.wetop.ai/start?p=P001' },
          view: {
            clients: [],
            money: { accruedCents: '0', paidCents: '0', balanceCents: '0' },
            payouts: [],
            stats: { clients: 0, trial: 0, paid: 0, trialEnded: 0, conversion: null },
            rating: { place: 1, of: 1 },
          },
        }
      : null,
};

let app: INestApplication;
beforeAll(async () => {
  const users: Record<string, { id: string; platformAdmin: boolean }> = {
    'session-admin': { id: ADMIN, platformAdmin: true },
    'session-partner': { id: PARTNER_USER, platformAdmin: false },
    'session-stranger': { id: STRANGER, platformAdmin: false },
  };
  const auth = {
    whoami: vi.fn(async (token: string) => {
      const who = users[token];
      return who
        ? { user: { ...who, role: 'OWNER', organizationId: '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00', email: 'x@example.invalid', name: null }, organization: null, expiresAt: '2026-12-26T00:00:00.000Z' }
        : null;
    }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [PartnerController],
    providers: [
      { provide: PARTNER_CABINET_REPOSITORY, useValue: repo },
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
  calls.length = 0;
});
const api = () => request(app.getHttpServer());

describe('приглашение партнёра', () => {
  it('выдаёт только главный администратор; в ответе ссылка /partner/invite/<токен> (ТЗ 01.11.2026) и Partner ID', async () => {
    const no = await api().post(`/platform/partners/${PARTNER}/invite`).set({ 'x-wetop-session': 'session-stranger' }).expect(403);
    expect(no.body.message).toBe(PLATFORM_ADMIN_ONLY);
    const ok = await api().post(`/platform/partners/${PARTNER}/invite`).set({ 'x-wetop-session': 'session-admin' }).expect(201);
    expect(ok.body).toMatchObject({ email: 'aidar@example.invalid', code: 'P001' });
    expect(ok.body.link).toMatch(/^https?:\/\/[^/]+\/partner\/invite\/tok-123$/);
    expect(calls[0]).toEqual(['invite', { partnerId: PARTNER, by: ADMIN }]);
  });

  it('без входа: просмотр и принятие приглашения; неверный токен 404 словами', async () => {
    expect((await api().get('/partner/join/tok-123').expect(200)).body).toEqual({ partnerName: 'Айдар', email: 'aidar@example.invalid' });
    expect((await api().get('/partner/join/bad').expect(404)).body.message).toBe(PARTNER_INVITE_INVALID);
    const ok = await api()
      .post('/partner/join/tok-123')
      .send({ name: 'Айдар Сериков', email: 'aidar@example.invalid', password: 'Длинный-пароль-2026', privacyAccepted: true })
      .expect(201);
    expect(ok.body).toEqual({ pendingVerification: true, email: 'aidar@example.invalid', sent: true });
    expect((await api().post('/partner/join/bad').send({ name: 'А', email: 'a@b.c', password: 'x', privacyAccepted: true }).expect(404)).body.message).toBe(PARTNER_INVITE_INVALID);
  });
});

describe('регистрация партнёра (ТЗ 01.11.2026): телефон и повтор пароля', () => {
  const good = { name: 'Айдар Сериков', email: 'aidar@example.invalid', password: 'Длинный-пароль-2026', privacyAccepted: true };
  it('пароли не совпали: 400 словами, учётка не создаётся', async () => {
    const r = await api().post('/partner/join/tok-123').send({ ...good, passwordConfirm: 'Другой-пароль-2026' }).expect(400);
    expect(r.body.message).toBe(PARTNER_JOIN_PASSWORD_MISMATCH);
    expect(calls.filter((c) => c[0] === 'join')).toHaveLength(0);
  });
  it('телефон кривой: 400 словами; верный уходит в учётку партнёра цифрами с плюсом', async () => {
    expect((await api().post('/partner/join/tok-123').send({ ...good, passwordConfirm: good.password, phone: 'abc' }).expect(400)).body.message).toBe(PARTNER_JOIN_PHONE);
    await api().post('/partner/join/tok-123').send({ ...good, passwordConfirm: good.password, phone: '+7 (701) 000-00-01' }).expect(201);
    expect(calls.find((c) => c[0] === 'join')![1]).toMatchObject({ phone: '+77010000001' });
  });
  it('слабый пароль: 400 «Пароль не годится»', async () => {
    const r = await api().post('/partner/join/tok-123').send({ ...good, password: '123', passwordConfirm: '123' }).expect(400);
    expect(r.body.message).toMatch(/^Пароль не годится/);
  });
  it('без телефона и повтора (старая форма) регистрация проходит', async () => {
    await api().post('/partner/join/tok-123').send(good).expect(201);
    expect(calls.find((c) => c[0] === 'join')![1]).toMatchObject({ phone: null });
  });
});

describe('кабинет партнёра', () => {
  it('только свой партнёр по пользователю сессии; не партнёр: 403 словами; без входа 401', async () => {
    await api().get('/partner/me').expect(401);
    const no = await api().get('/partner/me').set({ 'x-wetop-session': 'session-stranger' }).expect(403);
    expect(no.body.message).toBe(PARTNER_NOT_PARTNER);
    const ok = await api().get('/partner/me').set({ 'x-wetop-session': 'session-partner' }).expect(200);
    expect(ok.body.partner).toEqual({ name: 'Айдар', code: 'P001', percentBp: 3000 });
    expect(ok.body.links.client).toBe('https://app.wetop.ai/start?p=P001');
  });
});
