import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.provider';

/**
 * `GET /health` — живость API для сторожа снаружи процесса: healthcheck Docker на сервере, `ari.sh` и
 * `status.sh` на Mac. Слито 18.09.2026 из двух наборов — ни одна проверка не выброшена.
 *
 * Зачем отдельный маршрут, а не `/inventory/summary`, которым мерили живость на Mac:
 *  1. как только включат `AUTH_REQUIRED=1` (ADR-049), `/inventory/summary` отвечает 401 без сессии —
 *     контейнер API навсегда остался бы «нездоровым», а стойка и туннель зависят от его здоровья и не
 *     поднялись бы вовсе;
 *  2. проверка обязана трогать базу: 14.09.2026 Mac уснул, соединения пула умерли, и API отвечал на
 *     запросы, но ни один из них не доходил до базы;
 *  3. проверка отвечает по своему сроку: срок пула — 30 с (ADR-043), а healthcheck Docker ждёт 10 с,
 *     без своего срока проверка отваливалась бы молча по таймауту Docker;
 *  4. дешёвая по построению: `SELECT 1`, а не выборка гостиницы — её дёргают раз в несколько секунд.
 */
describe('GET /health', () => {
  let app: INestApplication;
  const queryRaw = vi.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ db: { $queryRaw: queryRaw } })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    queryRaw.mockResolvedValue([{ ok: 1 }]);
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => app?.close());

  it('живая база — 200 и status ok', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('база не отвечает — 503 и status degraded, без подробностей драйвера', async () => {
    queryRaw.mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.5:5432 password=fake-secret'),
    );
    const response = await request(app.getHttpServer()).get('/health').expect(503);
    expect(response.body).toMatchObject({ status: 'degraded', database: 'down' });
    expect(response.text).not.toMatch(/fake-secret|ECONNREFUSED|5432/);
  });

  it('строка подключения из ошибки драйвера наружу не выходит', async () => {
    queryRaw.mockRejectedValue(new Error('postgresql://pms:секрет@db.example.kz:5432/pms'));
    const response = await request(app.getHttpServer()).get('/health').expect(503);
    expect(response.text).not.toContain('postgresql://');
    expect(response.text).not.toContain('секрет');
  });

  it('не висит на мёртвом пуле, а отвечает 503 по своему сроку', async () => {
    vi.stubEnv('HEALTH_TIMEOUT_MS', '50');
    queryRaw.mockImplementation(() => new Promise(() => {})); // запрос, который никогда не вернётся
    const response = await request(app.getHttpServer()).get('/health').expect(503);
    expect(response.body).toMatchObject({ status: 'degraded', database: 'down' });
  });

  it('замок входа проверку живости не трогает: у Docker и туннеля сессии нет', async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});

describe('GET /status/public (H14, ADR-143)', () => {
  let app: INestApplication;
  const queryRaw = vi.fn();
  const findMany = vi.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        db: {
          $queryRaw: queryRaw,
          systemIncident: { findMany },
          externalEvent: {},
          channelOutbox: {},
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    findMany.mockResolvedValue([]);
  });
  afterAll(async () => app?.close());

  it('без входа: всё работает — четыре части словами', async () => {
    const r = await request(app.getHttpServer()).get('/status/public').expect(200);
    expect(r.body.overall).toBe('ok');
    expect(r.body.components.map((c: { key: string }) => c.key)).toEqual([
      'app',
      'database',
      'channels',
      'booking',
    ]);
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('открытая неисправность каналов — «с перебоями», а её текст и вид наружу не выходят', async () => {
    findMany.mockResolvedValue([
      {
        id: 'i1',
        kind: 'outbox.stuck',
        title: 'Очередь в Channex стоит 40 мин, секретный-хвост',
        status: 'OPEN',
        severity: 'CRITICAL',
      },
    ]);
    const r = await request(app.getHttpServer()).get('/status/public').expect(200);
    expect(r.body.overall).toBe('degraded');
    expect(r.text).not.toMatch(/outbox|Channex|секретный/);
  });

  it('база не отвечает — «недоступно», без подробностей драйвера', async () => {
    queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const r = await request(app.getHttpServer()).get('/status/public').expect(200);
    expect(r.body.overall).toBe('down');
    expect(r.text).not.toMatch(/ECONNREFUSED|5432/);
  });
});
