import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module';
import { PrismaService } from './prisma.provider';

describe('Database connection through the real API application', () => {
  let app: INestApplication;
  const findFirst = vi.fn();
  const count = vi.fn();
  const property = {
    id: 'test-property',
    name: 'Тестовый хостел из базы',
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    _count: { accommodationTypes: 3, reservations: 11, ratePlans: 2, services: 4, trackedSites: 1 },
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ db: { property: { findFirst }, inventoryUnit: { count } } })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(property);
    count.mockResolvedValue(17);
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://test:fake-secret@region.pooler.supabase.com:5432/test',
    );
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => app?.close());

  it('reads stored property/counts and identifies Supabase without returning credentials or IDs', async () => {
    const response = await request(app.getHttpServer()).get('/system/connection').expect(200);
    expect(response.body).toMatchObject({
      state: 'READY',
      source: 'database',
      database: { connected: true, provider: 'supabase' },
      property: { name: property.name, timezone: property.timezone, currency: property.currency },
      counts: { units: 17, categories: 3, reservations: 11, ratePlans: 2, services: 4, sites: 1 },
    });
    expect(response.text).not.toMatch(/fake-secret|test-property|pooler\.supabase/);
    expect(count).toHaveBeenCalledWith({
      where: { accommodationType: { propertyId: property.id } },
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: expect.any(String) } }),
    );
  });

  it('distinguishes a connected empty object from a connection error', async () => {
    findFirst.mockResolvedValue({
      ...property,
      _count: {
        accommodationTypes: 0,
        reservations: 0,
        ratePlans: 0,
        services: 0,
        trackedSites: 0,
      },
    });
    count.mockResolvedValue(0);
    const response = await request(app.getHttpServer()).get('/system/connection').expect(200);
    expect(response.body.state).toBe('READY');
    expect(response.body.counts.units).toBe(0);
    expect(response.body.counts.reservations).toBe(0);
  });

  it('does not claim the project is ready when its property is missing', async () => {
    findFirst.mockResolvedValue(null);
    const response = await request(app.getHttpServer()).get('/system/connection').expect(200);
    expect(response.body).toMatchObject({
      state: 'PROPERTY_MISSING',
      database: { connected: true },
      property: null,
      counts: null,
    });
    expect(count).not.toHaveBeenCalled();
  });

  it('returns a safe unavailable state when PostgreSQL refuses the connection', async () => {
    findFirst.mockRejectedValue(new Error('connection failed with fake-secret and internal-host'));
    const response = await request(app.getHttpServer()).get('/system/connection').expect(200);
    expect(response.body).toMatchObject({
      state: 'DATABASE_UNAVAILABLE',
      database: { connected: false },
      property: null,
      counts: null,
    });
    expect(response.text).not.toMatch(/fake-secret|internal-host|stack/);
  });

  it('does not turn a failed table query into zero records', async () => {
    count.mockRejectedValue(new Error('relation missing'));
    const response = await request(app.getHttpServer()).get('/system/connection').expect(200);
    expect(response.body).toMatchObject({ state: 'DATABASE_UNAVAILABLE', counts: null });
  });

  it('names the schema the API works in: public for live data, pms_test for autotests (ADR-040)', async () => {
    const live = await request(app.getHttpServer()).get('/system/connection').expect(200);
    expect(live.body.database.schema).toBe('public');
    vi.stubEnv('DATABASE_SCHEMA', 'pms_test');
    const tests = await request(app.getHttpServer()).get('/system/connection').expect(200);
    expect(tests.body.database.schema).toBe('pms_test');
  });

  it('keeps a non-Supabase PostgreSQL connection accurately labelled', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test@supabase.com.invalid/test');
    const response = await request(app.getHttpServer()).get('/system/connection').expect(200);
    expect(response.body.database.provider).toBe('postgresql');
  });
});
