import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import type { AnalyticsRepository, SiteRecord } from '../analytics/analytics.repository';
import { WidgetCorsMiddleware } from './web-booking.module';

const site = (id: string, hosts: string[], over: Partial<SiteRecord> = {}): SiteRecord => ({
  id,
  propertyId: `property-${id}`,
  name: id,
  hosts,
  publicKey: `pms_${id.padEnd(12, '0')}`,
  status: 'ACTIVE',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  timezone: 'Asia/Almaty',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  bookingEnabled: true,
  bookingRatePlan: { id: `rate-${id}`, code: 'BASE', name: 'Базовый' },
  organizationId: `org-${id}`,
  ...over,
});

/**
 * MKT1B BOOK-1: CORS виджета брони — список доменов всех действующих сайтов с бронью во ВСЕХ организациях. Публичный
 * путь не знает вошедшего, и прежний `sites()` возвращал только сайты объекта установки: браузер на домене второй
 * гостиницы не получал `Access-Control-Allow-Origin` и форма брони не работала. Подделка разводит два ответа:
 * `sites()` видит только объект установки (как служебный путь без человека), `allSites()` видит все.
 */
function middleware() {
  const tenantA = site('a', ['a.example']);
  const tenantB = site('b', ['b.example']);
  const paused = site('p', ['paused.example'], { status: 'PAUSED' });
  const off = site('o', ['off.example'], { bookingEnabled: false });
  const repo = {
    sites: async () => [tenantA],
    allSites: async () => [tenantA, tenantB, paused, off],
  } as unknown as AnalyticsRepository;
  return new WidgetCorsMiddleware(repo);
}

async function corsFor(mw: WidgetCorsMiddleware, origin: string, method = 'OPTIONS') {
  const headers = new Map<string, string>();
  let status: number | null = null;
  let passed = false;
  const res = {
    setHeader: (k: string, v: string) => headers.set(k, v),
    status: (s: number) => {
      status = s;
      return { end: () => undefined };
    },
  } as unknown as Response;
  const req = { method, headers: { origin, host: 'api.wetop.ai' } } as unknown as Request;
  await mw.use(req, res, () => {
    passed = true;
  });
  return { allow: headers.get('Access-Control-Allow-Origin') ?? null, status, passed };
}

describe('WidgetCorsMiddleware: домены сайтов всех организаций (MKT1B BOOK-1)', () => {
  it('разрешает домены действующих сайтов с бронью обеих организаций, но не чужие, паузу и выключенную бронь', async () => {
    const mw = middleware();
    expect((await corsFor(mw, 'https://a.example')).allow).toBe('https://a.example');
    expect((await corsFor(mw, 'https://b.example')).allow).toBe('https://b.example');
    expect((await corsFor(mw, 'https://www.b.example')).allow).toBe('https://www.b.example');
    expect((await corsFor(mw, 'https://unknown.example')).allow).toBeNull();
    expect((await corsFor(mw, 'https://paused.example')).allow).toBeNull();
    expect((await corsFor(mw, 'https://off.example')).allow).toBeNull();
  });

  it('preflight всегда 204, обычный запрос идёт дальше: CORS не авторизует бронь, это делает bookingSite', async () => {
    const mw = middleware();
    const preflight = await corsFor(mw, 'https://unknown.example');
    expect(preflight.status).toBe(204);
    expect(preflight.passed).toBe(false);
    const get = await corsFor(mw, 'https://b.example', 'GET');
    expect(get.passed).toBe(true);
    expect(get.allow).toBe('https://b.example');
  });
});
