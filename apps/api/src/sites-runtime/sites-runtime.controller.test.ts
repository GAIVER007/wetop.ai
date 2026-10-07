import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Controller, Get, Param, Post, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { siteSpecHash } from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { databaseTenant } from '../auth/request-context';
import { SitesRuntimeController } from './sites-runtime.controller';
import {
  SITES_RUNTIME_REPOSITORY,
  type PublishedSiteRow,
  type SitesRuntimeRepository,
} from './sites-runtime.repository';
import { SitesRuntimeService } from './sites-runtime.service';

/**
 * MKT4: служебный путь публичного рантайма. Ключ `SITES_RUNTIME_KEY` открывает только `GET /sites-runtime/current`;
 * хост разрешается только картой dev и test; ответ отдаёт ровно опубликованную версию, без документа при совпавшем
 * `knownSpecHash`, с `publicFacts` по белому списку. Гостиницы вымышленные (ADR-010).
 */
const RUNTIME_KEY = 'sites-runtime-key-for-run';
const SERVICE_KEY = 'service-key-for-run';
const COLLECT_KEY = 'market-collect-key-for-run';
const SITE = '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const OTHER = '4a2d3b01-4c5e-4f60-9b7c-8d9e0f1a2b3c';
const SPEC = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../docs/marketing/sitespec-v0.example.json'), 'utf8'),
) as Record<string, unknown>;
const HASH = siteSpecHash(SPEC);

const row = (patch: Partial<PublishedSiteRow> = {}): PublishedSiteRow => ({
  siteId: SITE,
  versionId: '5b3e4c12-5d6f-4071-8c8d-9e0f1a2b3c4d',
  schemaVersion: 'site-spec/0',
  specHash: HASH,
  spec: SPEC,
  propertyId: 'prop-a',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  publicKey: 'pms_0123456789ab',
  bookingEnabled: true,
  ...patch,
});

const calls: Array<{ siteId: string; tenant: string | null }> = [];
let published: Record<string, PublishedSiteRow> = {};
let categoriesFail = false;
const repo: SitesRuntimeRepository = {
  async publishedSite(siteId) {
    calls.push({ siteId, tenant: databaseTenant() });
    return published[siteId] ?? null;
  },
  async categories(_propertyId, codes) {
    if (categoriesFail) throw new Error('db down');
    return [
      { code: 'standard-double', active: true, capacityAdults: 2, name: 'Служебное имя', id: 'cat-1' },
      { code: 'dorm-bed', active: false, capacityAdults: 1 },
    ].filter((c) => codes.includes(c.code));
  },
};

/** Управление сайтом, как в API: ключ рантайма сюда не входит ни на чтение черновика, ни на версию по id */
@Access('settings')
@Controller('marketing/site')
class FakeManagementController {
  @Get('draft') draft() {
    return { latest: true };
  }
  @Get('versions/:id') version(@Param('id') id: string) {
    return { id };
  }
}

/** Соседний служебный путь: ключ рантайма тоже не входит */
@Access('service')
@Controller('market/collector')
class FakeCollectorController {
  @Get('competitors') list() {
    return [];
  }
}

@Access('service')
@Controller('sites-runtime')
class FakeRuntimeWriteController {
  @Post('current') write() {
    return { written: true };
  }
}

let app: INestApplication;
beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [SitesRuntimeController, FakeManagementController, FakeCollectorController, FakeRuntimeWriteController],
    providers: [
      { provide: AuthService, useValue: { whoami: async () => null } },
      { provide: SITES_RUNTIME_REPOSITORY, useValue: repo },
      SitesRuntimeService,
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
  calls.length = 0;
  published = {};
  categoriesFail = false;
});

function server(key: string | null, env: Record<string, string> = {}) {
  vi.stubEnv('AUTH_REQUIRED', '1');
  vi.stubEnv('SITES_RUNTIME_KEY', RUNTIME_KEY);
  vi.stubEnv('SERVICE_API_KEY', SERVICE_KEY);
  vi.stubEnv('MARKET_COLLECT_KEY', COLLECT_KEY);
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('SITES_RUNTIME_DEV_RESOLVER', '1');
  vi.stubEnv('SITES_RUNTIME_DEV_HOSTS', `stepnoy.localhost=${SITE},other.localhost=${OTHER}`);
  vi.stubEnv('PUBLIC_API_URL', 'https://api.example.test/');
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const http = request(app.getHttpServer());
  const withKey = <T extends { set: (h: string, v: string) => T }>(r: T) =>
    key ? r.set('x-wetop-service-key', key) : r;
  return {
    get: (path: string) => withKey(http.get(path)),
    post: (path: string) => withKey(http.post(path)),
  };
}
const current = (query: string, key: string | null = RUNTIME_KEY, env: Record<string, string> = {}) =>
  server(key, env).get(`/sites-runtime/current?${query}`);

describe('ключ рантайма SITES_RUNTIME_KEY', () => {
  it('без ключа 401, неверный ключ 401, чужой узкий ключ 403, общий служебный ключ 403', async () => {
    published[SITE] = row();
    await current('host=stepnoy.localhost', null).expect(401);
    await current('host=stepnoy.localhost', 'wrong-key-of-other-length').expect(401);
    await current('host=stepnoy.localhost', 'sites-runtime-key-for-ruN').expect(401);
    await current('host=stepnoy.localhost', COLLECT_KEY).expect(403);
    await current('host=stepnoy.localhost', SERVICE_KEY).expect(403);
    expect(calls).toEqual([]);
  });

  it('ключ рантайма не открывает управление, черновик, версию по id, соседние служебные пути и запись', async () => {
    await server(RUNTIME_KEY).get('/marketing/site/draft').expect(403);
    await server(RUNTIME_KEY).get(`/marketing/site/versions/${SITE}`).expect(403);
    await server(RUNTIME_KEY).get('/market/collector/competitors').expect(403);
    await server(RUNTIME_KEY).post('/sites-runtime/current').expect(403);
  });

  it('путь рантайма проверяет ключ и без замка входа (AUTH_REQUIRED выключен)', async () => {
    published[SITE] = row();
    await current('host=stepnoy.localhost', null, { AUTH_REQUIRED: '0' }).expect(401);
    await current('host=stepnoy.localhost', SERVICE_KEY, { AUTH_REQUIRED: '0' }).expect(403);
    await current('host=stepnoy.localhost', RUNTIME_KEY, { AUTH_REQUIRED: '0' }).expect(200);
  });
});

describe('разрешение хоста: только dev и test, боевое выключено до MKT7', () => {
  it('хост из карты разрешается, нормализуется, базу читает служебной ролью', async () => {
    published[SITE] = row();
    await current('host=Stepnoy.Localhost:8787').expect(200);
    expect(calls).toEqual([{ siteId: SITE, tenant: null }]);
  });

  it('неизвестный и неверный хост 404, базу не трогает', async () => {
    for (const host of ['unknown.localhost', 'bad host', '', 'localhost'])
      await current(`host=${encodeURIComponent(host)}`).expect(404);
    await current('').expect(404);
    expect(calls).toEqual([]);
  });

  it('production: карта не действует, любой хост 404', async () => {
    published[SITE] = row();
    await current('host=stepnoy.localhost', RUNTIME_KEY, { NODE_ENV: 'production' }).expect(404);
    expect(calls).toEqual([]);
  });

  it('без SITES_RUNTIME_DEV_RESOLVER=1 карта не действует', async () => {
    published[SITE] = row();
    await current('host=stepnoy.localhost', RUNTIME_KEY, { SITES_RUNTIME_DEV_RESOLVER: '' }).expect(404);
    expect(calls).toEqual([]);
  });

  it('сайт не опубликован (нет строки из базы): 404 без имени сайта', async () => {
    const res = await current('host=other.localhost').expect(404);
    expect(JSON.stringify(res.body)).not.toContain('Степной');
  });
});

describe('ответ контракта', () => {
  it('опубликованная версия целиком: поля по контракту, без лишних', async () => {
    published[SITE] = row();
    const res = await current('host=stepnoy.localhost').expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'assets', 'bookingEnabled', 'defaultLocale', 'primaryHost', 'publicApiUrl', 'publicFacts', 'publicKey',
        'schemaVersion', 'siteId', 'spec', 'specHash', 'state', 'versionId',
      ].sort(),
    );
    expect(res.body).toMatchObject({
      siteId: SITE,
      state: 'PUBLISHED',
      primaryHost: null,
      defaultLocale: 'ru',
      versionId: '5b3e4c12-5d6f-4071-8c8d-9e0f1a2b3c4d',
      schemaVersion: 'site-spec/0',
      specHash: HASH,
      publicKey: 'pms_0123456789ab',
      bookingEnabled: true,
      publicApiUrl: 'https://api.example.test',
      assets: {},
    });
    expect(res.body.spec).toEqual(SPEC);
  });

  it('knownSpecHash совпал: документа в ответе нет, остальное есть', async () => {
    published[SITE] = row();
    const res = await current(`host=stepnoy.localhost&knownSpecHash=${HASH}`).expect(200);
    expect(res.body.spec).toBeUndefined();
    expect(res.body.specHash).toBe(HASH);
  });

  it('knownSpecHash не совпал: документ в ответе; неверный формат 400', async () => {
    published[SITE] = row();
    const res = await current(`host=stepnoy.localhost&knownSpecHash=${'0'.repeat(64)}`).expect(200);
    expect(res.body.spec).toEqual(SPEC);
    await current('host=stepnoy.localhost&knownSpecHash=abc').expect(400);
  });

  it('publicFacts: только коды версии, только белый список полей, незнакомый код active:false', async () => {
    const spec = structuredClone(SPEC) as { pages: Array<{ sections: Array<Record<string, unknown>> }> };
    const rooms = spec.pages[0]!.sections.find((s) => s['type'] === 'accommodations')!;
    const items = rooms['items'] as Array<Record<string, unknown>>;
    items.push({ ...items[0], categoryCode: 'lost-code' });
    const pricing = spec.pages[0]!.sections.find((s) => s['type'] === 'pricing')!;
    pricing['categoryCodes'] = ['standard-double', 'dorm-bed', 'lost-code'];
    published[SITE] = row({ spec, specHash: siteSpecHash(spec) });
    const res = await current('host=stepnoy.localhost').expect(200);
    expect(Object.keys(res.body.publicFacts).sort()).toEqual(['categories', 'checkInTime', 'checkOutTime', 'loadedAt']);
    expect(res.body.publicFacts.checkInTime).toBe('14:00');
    expect(res.body.publicFacts.checkOutTime).toBe('12:00');
    expect(res.body.publicFacts.categories).toEqual([
      { code: 'standard-double', active: true, capacityAdults: 2 },
      { code: 'dorm-bed', active: false, capacityAdults: 1 },
      { code: 'lost-code', active: false },
    ]);
    expect(Number.isNaN(Date.parse(res.body.publicFacts.loadedAt))).toBe(false);
  });

  it('факты не загрузились: publicFacts null, сайт отвечает', async () => {
    published[SITE] = row();
    categoriesFail = true;
    const res = await current('host=stepnoy.localhost').expect(200);
    expect(res.body.publicFacts).toBeNull();
  });

  it('связанного сайта счётчика нет: ключа нет, брони нет', async () => {
    published[SITE] = row({ publicKey: null, bookingEnabled: false });
    const res = await current('host=stepnoy.localhost').expect(200);
    expect(res.body.publicKey).toBeNull();
    expect(res.body.bookingEnabled).toBe(false);
  });
});

describe('неверный документ закрывает выдачу: 503 и запись в лог', () => {
  it.each([
    ['документ не проходит проверку', () => row({ spec: { ...SPEC, theme: { preset: 'NEON' } } })],
    ['незнакомая версия схемы', () => row({ schemaVersion: 'site-spec/9', spec: { ...SPEC, schemaVersion: 'site-spec/9' } })],
    ['хэш не совпал с документом', () => row({ specHash: 'f'.repeat(64) })],
  ])('%s', async (_label, make) => {
    published[SITE] = make();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await current('host=stepnoy.localhost').expect(503);
    expect(res.body.code).toBe('spec_invalid');
    expect(res.body.spec).toBeUndefined();
    expect(errors).toHaveBeenCalled();
    expect(JSON.stringify(errors.mock.calls)).toContain(SITE);
    errors.mockRestore();
  });
});
