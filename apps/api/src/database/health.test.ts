import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module';
import { PrismaService } from './prisma.provider';

/**
 * `GET /health` — живость API для сторожа снаружи процесса (Docker, plans/server-kz-2026-09-17.md).
 *
 * Зачем отдельный маршрут, а не `/inventory/summary`, которым мерили живость на Mac:
 *  1. как только включат `AUTH_REQUIRED=1` (ADR-049), `/inventory/summary` отвечает 401 без сессии —
 *     контейнер API навсегда остался бы «нездоровым», а стойка и туннель зависят от его здоровья и не
 *     поднялись бы вовсе;
 *  2. проверка обязана трогать базу: 14.09.2026 Mac уснул, соединения пула умерли, и API отвечал на
 *     запросы, но ни один из них не доходил до базы — лечилось только перезапуском руками;
 *  3. проверка не должна висеть вечно, когда пул мёртв: у пула нет таймаутов, поэтому ждём сами.
 */
describe('GET /health', () => {
  let app: INestApplication;
  const queryRaw = vi.fn();
  const authRequired = process.env['AUTH_REQUIRED'];
  const timeout = process.env['HEALTH_TIMEOUT_MS'];

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
  afterEach(() => {
    if (authRequired === undefined) delete process.env['AUTH_REQUIRED'];
    else process.env['AUTH_REQUIRED'] = authRequired;
    if (timeout === undefined) delete process.env['HEALTH_TIMEOUT_MS'];
    else process.env['HEALTH_TIMEOUT_MS'] = timeout;
  });
  afterAll(async () => {
    await app.close();
  });

  it('отвечает 200, когда база отвечает', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('остаётся доступной с включённым замком — иначе контейнер API никогда не станет здоровым', async () => {
    process.env['AUTH_REQUIRED'] = '1';
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('отвечает 503, когда база не отвечает', async () => {
    queryRaw.mockRejectedValue(new Error('Connection terminated due to connection timeout'));
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body.status).toBe('down');
  });

  it('не висит на мёртвом пуле, а отвечает 503 по своему сроку', async () => {
    process.env['HEALTH_TIMEOUT_MS'] = '50';
    queryRaw.mockImplementation(() => new Promise(() => {})); // запрос, который никогда не вернётся
    await request(app.getHttpServer()).get('/health').expect(503);
  });

  it('не рассказывает наружу, что именно сломалось', async () => {
    queryRaw.mockRejectedValue(new Error('postgresql://pms:секрет@db.example.kz:5432/pms'));
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(JSON.stringify(res.body)).not.toContain('postgresql://');
    expect(JSON.stringify(res.body)).not.toContain('секрет');
  });
});
