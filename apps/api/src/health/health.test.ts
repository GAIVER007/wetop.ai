import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.provider';

/**
 * Проверка живости для Docker и туннеля (plans/server-kz-2026-09-18.md, шаг 1).
 * Дешёвая по построению: `SELECT 1`, а не выборка гостиницы — её дёргают раз в несколько секунд.
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

  it('замок входа проверку живости не трогает: у Docker и туннеля сессии нет', async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
