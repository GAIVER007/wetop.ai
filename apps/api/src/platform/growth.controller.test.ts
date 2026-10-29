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
import { GROWTH_REPOSITORY, GrowthController, WETOP_SITE_HOSTS } from './growth.controller';

/**
 * Посетители wetop.ai в пути клиента (владелец 29.10.2026, срез 2 плана кабинета): счётчик WETOP на своём сайте,
 * уникальные посетители месяца по сайту с адресом wetop.ai. Только главному администратору.
 */
const OWN = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const asked: Array<{ hosts: readonly string[]; from: string; to: string }> = [];
let visitors: number | null = 200;
const repo = {
  async source() {
    return {
      organizations: [{ id: 'c1', name: 'Клиент', status: 'TRIAL' as const, createdAt: new Date(), trialEndsAt: null }],
      registrations: [new Date(), new Date(), new Date(), new Date(), new Date(), new Date(), new Date(), new Date(), new Date(), new Date()],
      payments: [],
      subscriptions: [],
    };
  },
  async visitors(hosts: readonly string[], from: Date, to: Date) {
    asked.push({ hosts, from: from.toISOString(), to: to.toISOString() });
    return visitors;
  },
  async siteActivity(hosts: readonly string[], from: Date, to: Date) {
    asked.push({ hosts, from: from.toISOString(), to: to.toISOString() });
    if (visitors === null) return null;
    return {
      timezone: 'Asia/Almaty',
      sessions: [{ visitorKey: 'v1', sessionKey: 's1', startedAt: new Date('2026-10-05T08:00:00Z'), sourceKind: 'SEARCH' as const, source: 'google', device: 'MOBILE' as const }],
      events: [{ name: 'signup_open', sessionKey: 's1' }],
      pageviews: [{ path: '/' }],
    };
  },
};

let app: INestApplication;
beforeAll(async () => {
  const users: Record<string, { id: string; role: 'OWNER'; platformAdmin: boolean }> = {
    'session-admin': { id: '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11', role: 'OWNER', platformAdmin: true },
    'session-owner': { id: '1c7d4d2f-5a5f-4b64-8c8f-3a2e8b0d1b22', role: 'OWNER', platformAdmin: false },
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
    controllers: [GrowthController],
    providers: [
      { provide: GROWTH_REPOSITORY, useValue: repo },
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
  asked.length = 0;
  visitors = 200;
});
const api = () => request(app.getHttpServer());
const as = (s: string) => ({ 'x-wetop-session': s });

describe('GET /platform/growth: посетители wetop.ai', () => {
  it('без отметки главного администратора: 403', async () => {
    const res = await api().get('/platform/growth').set(as('session-owner')).expect(403);
    expect(res.body.message).toBe(PLATFORM_ADMIN_ONLY);
  });

  it('уникальные посетители месяца по сайту wetop.ai и конверсия в регистрацию', async () => {
    const month = new Date().toISOString().slice(0, 7);
    const res = await api().get(`/platform/growth?month=${month}`).set(as('session-admin')).expect(200);
    expect(WETOP_SITE_HOSTS).toEqual(['wetop.ai', 'www.wetop.ai']);
    expect(asked).toHaveLength(1);
    expect(asked[0]!.hosts).toEqual(WETOP_SITE_HOSTS);
    // границы месяца по UTC: с 1-го числа до 1-го следующего
    expect(asked[0]!.from).toBe(`${month}-01T00:00:00.000Z`);
    expect(new Date(asked[0]!.to).getUTCDate()).toBe(1);
    expect(res.body.funnel.visitors).toBe(200);
    // 10 регистраций из 200 посетителей: 5,0%
    expect(res.body.funnel.conversion.visitorToRegistration).toBe(50);
  });

  it('счётчик на wetop.ai ещё не заведён: посетителей нет, а не ноль', async () => {
    visitors = null;
    const res = await api().get('/platform/growth').set(as('session-admin')).expect(200);
    expect(res.body.funnel.visitors).toBeNull();
    expect(res.body.funnel.conversion.visitorToRegistration).toBeNull();
  });
});

describe('сайт wetop.ai в кабинете (GET /platform/site)', () => {
  it('месяц по адресам wetop.ai: посетители, путь к регистрации, источники', async () => {
    const res = await api().get('/platform/site?month=2026-10').set(as('session-admin'));
    expect(res.status).toBe(200);
    expect(asked[0]).toEqual({ hosts: WETOP_SITE_HOSTS, from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' });
    expect(res.body.report).toMatchObject({ visitors: 1, path: { signupOpen: 1 }, sources: [{ kind: 'SEARCH', source: 'google' }] });
    expect(res.body.report.daily).toHaveLength(31);
  });
  it('счётчик не заведён: report null', async () => {
    visitors = null;
    const res = await api().get('/platform/site?month=2026-10').set(as('session-admin'));
    expect(res.body).toEqual({ month: '2026-10', report: null });
  });
  it('не главному администратору закрыто', async () => {
    const res = await api().get('/platform/site').set(as('session-owner'));
    expect(res.status).toBe(403);
  });
});
