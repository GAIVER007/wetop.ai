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
import { signPreviewToken } from '../marketing-site/preview-token';
import { MemorySiteAssetStorage, SITE_ASSET_STORAGE } from '../marketing-site/asset-storage';
import type { AssetRow } from '../marketing-site/asset-refs';

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
const PREVIEW_SECRET = 'mkt7-preview-secret-for-unit-tests-32b';
const VERSION_2 = '6c4f5d23-6e70-4182-9d9e-0f1a2b3c4d5e';

const row = (patch: Partial<PublishedSiteRow> = {}): PublishedSiteRow => ({
  siteId: SITE,
  locationId: 'loc-a',
  versionId: '5b3e4c12-5d6f-4071-8c8d-9e0f1a2b3c4d',
  schemaVersion: 'site-spec/0',
  specHash: HASH,
  spec: SPEC,
  propertyId: 'prop-a',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  publicKey: 'pms_0123456789ab',
  bookingEnabled: true,
  primaryHost: null,
  ...patch,
});

const calls: Array<{ siteId: string; tenant: string | null }> = [];
let published: Record<string, PublishedSiteRow> = {};
/** MKT7: ACTIVE домены сайтов (хост → сайт) и версии, доступные превью (`siteId:versionId`) */
let domains: Record<string, string> = {};
let previews: Record<string, PublishedSiteRow> = {};
const previewCalls: Array<{ siteId: string; versionId: string; tenant: string | null }> = [];
let categoriesFail = false;
/** MKT8: библиотека (филиал → строки) и версии, которые уже публиковались (`siteId:versionId`) */
let library: Record<string, AssetRow[]> = {};
let publishedVersions = new Set<string>();
const assetCalls: Array<{ locationId: string; ids: string[]; tenant: string | null }> = [];
const storage = new MemorySiteAssetStorage();
const repo: SitesRuntimeRepository = {
  async assets(locationId, ids) {
    assetCalls.push({ locationId, ids, tenant: databaseTenant() });
    return (library[locationId] ?? []).filter((r) => ids.includes(r.id));
  },
  async versionPublished(siteId, versionId) {
    return publishedVersions.has(`${siteId}:${versionId}`);
  },
  async publishedSite(siteId) {
    calls.push({ siteId, tenant: databaseTenant() });
    return published[siteId] ?? null;
  },
  async siteIdByHost(host) {
    return domains[host] ?? null;
  },
  async previewSite(siteId, versionId) {
    previewCalls.push({ siteId, versionId, tenant: databaseTenant() });
    return previews[`${siteId}:${versionId}`] ?? null;
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
      { provide: SITE_ASSET_STORAGE, useValue: storage },
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
  previewCalls.length = 0;
  published = {};
  domains = {};
  previews = {};
  categoriesFail = false;
  library = {};
  publishedVersions = new Set();
  assetCalls.length = 0;
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
  vi.stubEnv('SITE_PREVIEW_SECRET', PREVIEW_SECRET);
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

describe('MKT7: боевое разрешение хоста через SiteDomain', () => {
  it('production: ACTIVE домен даёт сайт; основной хост в ответе настоящий', async () => {
    domains['luxx.sites.test'] = SITE;
    published[SITE] = row({ primaryHost: 'luxx.sites.test' });
    const res = await current('host=LUXX.sites.test.', RUNTIME_KEY, { NODE_ENV: 'production' }).expect(200);
    expect(res.body.primaryHost).toBe('luxx.sites.test');
    expect(calls).toEqual([{ siteId: SITE, tenant: null }]);
  });

  it('домена нет или сайт не опубликован: одинаковый 404', async () => {
    domains['paused.sites.test'] = OTHER;
    await current('host=unknown.sites.test', RUNTIME_KEY, { NODE_ENV: 'production' }).expect(404);
    await current('host=paused.sites.test', RUNTIME_KEY, { NODE_ENV: 'production' }).expect(404);
  });
});

describe('MKT7: превью по подписанному токену', () => {
  const now = () => Math.floor(Date.now() / 1000);
  const token = (patch: { siteId?: string; versionId?: string; exp?: number } = {}, secret = PREVIEW_SECRET) =>
    signPreviewToken(
      { siteId: patch.siteId ?? SITE, versionId: patch.versionId ?? VERSION_2, exp: patch.exp ?? now() + 600 },
      Buffer.from(secret, 'utf8'),
    );
  const preview = (query: string, key: string | null = RUNTIME_KEY, env: Record<string, string> = {}) =>
    server(key, env).get(`/sites-runtime/preview?${query}`);

  it('действующий токен: ровно эта версия, без ключа сайта и брони, не кэшируется', async () => {
    previews[`${SITE}:${VERSION_2}`] = row({ versionId: VERSION_2 });
    const res = await preview(`token=${token()}`).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({ siteId: SITE, state: 'PREVIEW', versionId: VERSION_2, publicKey: null, bookingEnabled: false });
    expect(res.body.primaryHost).toBeNull();
    expect(typeof res.body.expiresAt).toBe('string');
    expect(previewCalls).toEqual([{ siteId: SITE, versionId: VERSION_2, tenant: null }]);
  });

  it('ключ рантайма без токена, испорченный и чужой секрет: 404 без чтения базы', async () => {
    await preview('').expect(404);
    await preview('token=').expect(404);
    const t = token();
    await preview(`token=${t.slice(0, -2)}AA`).expect(404);
    await preview(`token=${token({}, 'another-secret-another-secret-0123456')}`).expect(404);
    expect(previewCalls).toEqual([]);
  });

  it('истёкший токен: 410 без чтения базы', async () => {
    const res = await preview(`token=${token({ exp: now() - 1 })}`).expect(410);
    expect(res.body.code).toBe('preview_expired');
    expect(previewCalls).toEqual([]);
  });

  it('версия не своего сайта или сайт в архиве (строки нет): 404', async () => {
    await preview(`token=${token({ versionId: OTHER })}`).expect(404);
  });

  it('секрета нет: превью закрыто 503', async () => {
    await preview(`token=${token()}`, RUNTIME_KEY, { SITE_PREVIEW_SECRET: '' }).expect(503);
  });

  it('общий служебный ключ и ключ сборщика превью не открывают', async () => {
    previews[`${SITE}:${VERSION_2}`] = row({ versionId: VERSION_2 });
    await preview(`token=${token()}`, SERVICE_KEY).expect(403);
    await preview(`token=${token()}`, COLLECT_KEY).expect(403);
    await preview(`token=${token()}`, null).expect(401);
  });
});

describe('MKT8: подписанные адреса картинок версии', () => {
  // ссылки примера SiteSpec: логотип, фавиконка, og и картинки секций
  const LOGO = '6f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
  const FAVICON = '7a2d3b01-4c5e-4f60-9b7c-8d9e0f1a2b3c';
  const HERO = '8b3e4c12-5d6f-4071-8c8d-9e0f1a2b3c4d';
  const ABOUT = '9c4f5d23-6e70-4182-9d9e-0f1a2b3c4d5e';
  const UNREFERENCED = 'f0f0f0f0-0000-4000-8000-000000000000';
  const asset = (id: string, kind: AssetRow['kind'], status = 'READY'): AssetRow => ({
    id,
    kind,
    status,
    storageRef: `site-assets/loc-a/${id}/${'a'.repeat(64)}.${kind === 'FAVICON' ? 'png' : 'webp'}`,
  });

  it('текущая версия: ровно ссылки документа нужного вида, подписанные; лишних из библиотеки нет', async () => {
    published[SITE] = row();
    library['loc-a'] = [asset(LOGO, 'LOGO'), asset(FAVICON, 'IMAGE'), asset(HERO, 'IMAGE'), asset(ABOUT, 'IMAGE', 'DELETED'), asset(UNREFERENCED, 'IMAGE')];
    const res = await current('host=stepnoy.localhost').expect(200);
    // фавиконка не того вида не подписывается; удалённый, но удержанный ради истории ассет опубликованной версии есть
    expect(Object.keys(res.body.assets).sort()).toEqual([ABOUT, HERO, LOGO].sort());
    for (const url of Object.values(res.body.assets) as string[]) expect(storage.verify(url)).not.toBeNull();
    expect(res.body.assets[UNREFERENCED]).toBeUndefined();
    // в базу ушли только id ссылок версии, служебной ролью
    expect(assetCalls).toHaveLength(1);
    expect(assetCalls[0]!.ids).not.toContain(UNREFERENCED);
    expect(assetCalls[0]!.tenant).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('"storageRef"');
  });

  it('ассет другого филиала с тем же id не подписывается: выборка только по филиалу сайта', async () => {
    published[SITE] = row();
    library['loc-b'] = [asset(HERO, 'IMAGE')];
    const res = await current('host=stepnoy.localhost').expect(200);
    expect(res.body.assets).toEqual({});
    expect(assetCalls[0]!.locationId).toBe('loc-a');
  });

  it('превью новой версии: удалённый ассет не показывается; уже публиковавшейся: показывается', async () => {
    const now = Math.floor(Date.now() / 1000);
    const t = signPreviewToken({ siteId: SITE, versionId: VERSION_2, exp: now + 600 }, Buffer.from(PREVIEW_SECRET, 'utf8'));
    previews[`${SITE}:${VERSION_2}`] = row({ versionId: VERSION_2 });
    library['loc-a'] = [asset(HERO, 'IMAGE'), asset(ABOUT, 'IMAGE', 'DELETED')];
    const fresh = await server(RUNTIME_KEY).get(`/sites-runtime/preview?token=${t}`).expect(200);
    expect(Object.keys(fresh.body.assets)).toEqual([HERO]);
    publishedVersions.add(`${SITE}:${VERSION_2}`);
    const historical = await server(RUNTIME_KEY).get(`/sites-runtime/preview?token=${t}`).expect(200);
    expect(Object.keys(historical.body.assets).sort()).toEqual([ABOUT, HERO].sort());
  });

  it('хранилище не настроено или выборка упала: картинок нет, сайт отвечает', async () => {
    const service = new SitesRuntimeService(repo, null);
    published[SITE] = row();
    library['loc-a'] = [asset(HERO, 'IMAGE')];
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SITES_RUNTIME_DEV_RESOLVER', '1');
    vi.stubEnv('SITES_RUNTIME_DEV_HOSTS', `stepnoy.localhost=${SITE}`);
    expect((await service.current({ host: 'stepnoy.localhost' })).assets).toEqual({});
    const broken = new SitesRuntimeService({ ...repo, assets: async () => { throw new Error('db down'); } }, storage);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await broken.current({ host: 'stepnoy.localhost' })).assets).toEqual({});
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
