import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { databaseTenant } from '../auth/request-context';
import { MarketCollectorController } from './collector.controller';
import { MarketCollectorService } from './collector.service';
import { MarketController } from './market.controller';
import {
  MARKET_REPOSITORY,
  type CollectorTarget,
  type CollectedEntry,
  type MarketAudit,
} from './market.repository';
import { MarketService, OWN_OCCUPANCY } from './market.service';

/**
 * M2a (ADR-142, Q-260): служебный вход ИИ-сборщика загрузки конкурентов. Узкий ключ `MARKET_COLLECT_KEY` открывает
 * ровно два адреса: список конкурентов всех объектов и запись снимков одного конкурента. Объект и «сегодня» берутся из
 * строки конкурента, а не из запроса; источник всегда AI_AGENT; ручной ввод того же дня сильнее сборщика.
 * Отели вымышленные (ADR-010).
 */
const COLLECT_KEY = 'market-collect-key-for-run';
const ACT_KEY = 'assistant-act-key-for-run';
const SOSED = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a01';
const ARCHIVED = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a02';
const UNKNOWN = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a03';

const targets: CollectorTarget[] = [
  {
    id: SOSED,
    name: 'Отель Сосед',
    url: 'https://example.invalid/sosed',
    distanceM: 300,
    unitsTotal: 40,
    propertyId: 'prop-a',
    propertyName: 'Гостиница А',
    timezone: 'Asia/Almaty',
  },
];

const writes: Array<{
  target: CollectorTarget;
  observedOn: string;
  entries: CollectedEntry[];
  audit: MarketAudit;
  tenant: string | null;
}> = [];
const repo = {
  async collectorTargets() {
    return targets;
  },
  async collectorTarget(id: string) {
    return targets.find((t) => t.id === id) ?? null;
  },
  async writeCollected(target: CollectorTarget, observedOn: string, entries: CollectedEntry[], audit: MarketAudit) {
    writes.push({ target, observedOn, entries, audit, tenant: databaseTenant() });
    // ночь 2026-10-05 уже заполнил человек сегодня: сборщик её не трогает
    const kept = entries.filter((e) => e.date === '2026-10-05').length;
    return { saved: entries.length - kept, kept };
  },
};

let app: INestApplication;
beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [MarketCollectorController, MarketController],
    providers: [
      { provide: AuthService, useValue: { whoami: async () => null } },
      { provide: MARKET_REPOSITORY, useValue: repo },
      { provide: OWN_OCCUPANCY, useValue: { ownDays: async () => ({}) } },
      MarketService,
      MarketCollectorService,
      { provide: APP_GUARD, useClass: SessionGuard },
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});
afterAll(async () => {
  await app.close();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  writes.length = 0;
});

function server(key: string | null) {
  vi.stubEnv('AUTH_REQUIRED', '1');
  vi.stubEnv('MARKET_COLLECT_KEY', COLLECT_KEY);
  vi.stubEnv('ASSISTANT_ACT_KEY', ACT_KEY);
  const http = request(app.getHttpServer());
  const withKey = <T extends { set: (h: string, v: string) => T }>(r: T) =>
    key ? r.set('x-wetop-service-key', key) : r;
  return {
    get: (path: string) => withKey(http.get(path)),
    put: (path: string, body: unknown) => withKey(http.put(path).send(body as object)),
    post: (path: string, body: unknown) => withKey(http.post(path).send(body as object)),
  };
}
const put = (id: string, entries: unknown, key: string | null = COLLECT_KEY) =>
  server(key).put(`/market/collector/competitors/${id}/occupancy`, { entries });

describe('ключ сборщика (M2a, Q-260)', () => {
  it('без ключа — 401, чужой узкий ключ — 403; ничего не пишется', async () => {
    await server(null).get('/market/collector/competitors').expect(401);
    await put(SOSED, [{ date: '2026-10-04', percent: 80 }], null).expect(401);
    await put(SOSED, [{ date: '2026-10-04', percent: 80 }], ACT_KEY).expect(403);
    expect(writes).toEqual([]);
  });

  it('ключ сборщика не открывает раздел стойки: ни таблицу, ни ручной ввод, ни список конкурентов', async () => {
    await server(COLLECT_KEY).get('/market/occupancy').expect(403);
    await server(COLLECT_KEY).post('/market/competitors', { name: 'Чужой' }).expect(403);
    await server(COLLECT_KEY)
      .put(`/market/competitors/${SOSED}/occupancy`, { entries: [{ date: '2026-10-04', percent: 80 }] })
      .expect(403);
    await server(COLLECT_KEY).get('/market/night?date=2026-10-04').expect(403);
  });
});

describe('GET /market/collector/competitors', () => {
  it('отдаёт действующих конкурентов всех объектов: имя, ссылку, расстояние и объект', async () => {
    const res = await server(COLLECT_KEY).get('/market/collector/competitors').expect(200);
    expect(res.body).toEqual({ competitors: targets });
  });
});

describe('PUT /market/collector/competitors/:id/occupancy', () => {
  it('пишет снимки сегодняшнего дня объекта конкурента источником AI_AGENT, служебной ролью базы', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 20:30 UTC 3 октября — в Алматы (UTC+5) уже 4 октября
    vi.setSystemTime(new Date('2026-10-03T20:30:00Z'));
    const res = await put(SOSED, [
      { date: '2026-10-04', percent: 91 },
      { date: '2026-10-05', percent: '64,5' },
    ]).expect(200);
    expect(res.body).toEqual({ saved: 1, kept: 1, observedOn: '2026-10-04' });
    expect(writes).toHaveLength(1);
    expect(writes[0]!.target.propertyId).toBe('prop-a');
    expect(writes[0]!.observedOn).toBe('2026-10-04');
    expect(writes[0]!.entries).toEqual([
      { date: '2026-10-04', bp: 9100 },
      { date: '2026-10-05', bp: 6450 },
    ]);
    expect(writes[0]!.audit).toMatchObject({
      entityType: 'Competitor',
      entityId: SOSED,
      action: 'market.occupancy.collected',
    });
    expect(writes[0]!.tenant).toBeNull();
  });

  it('объект и организация не берутся из тела запроса', async () => {
    await put(SOSED, [{ date: '2026-10-04', percent: 50 }]).expect(200);
    await server(COLLECT_KEY)
      .put(`/market/collector/competitors/${SOSED}/occupancy`, {
        propertyId: 'prop-b',
        organizationId: 'org-b',
        entries: [{ date: '2026-10-04', percent: 50 }],
      })
      .expect(200);
    expect(writes.map((w) => w.target.propertyId)).toEqual(['prop-a', 'prop-a']);
  });

  it('неизвестный или убранный конкурент — 404; не UUID — 400', async () => {
    await put(UNKNOWN, [{ date: '2026-10-04', percent: 50 }]).expect(404);
    await put(ARCHIVED, [{ date: '2026-10-04', percent: 50 }]).expect(404);
    await put('sosed', [{ date: '2026-10-04', percent: 50 }]).expect(400);
    expect(writes).toEqual([]);
  });

  it('сборщик не стирает: пустое значение, проценты вне 0…100, дубль и даль ночи — 400', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T06:00:00Z'));
    await put(SOSED, [{ date: '2026-10-04', percent: '' }]).expect(400);
    await put(SOSED, [{ date: '2026-10-04', percent: null }]).expect(400);
    await put(SOSED, [{ date: '2026-10-04', percent: 120 }]).expect(400);
    await put(SOSED, [
      { date: '2026-10-04', percent: 50 },
      { date: '2026-10-04', percent: 60 },
    ]).expect(400);
    await put(SOSED, [{ date: '2028-01-01', percent: 50 }]).expect(400);
    await put(SOSED, []).expect(400);
    expect(writes).toEqual([]);
  });
});
