import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { meta } from '@pms/integrations';
import { encryptPii } from '@pms/shared';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaMarketingBudgetRepository } from '../../apps/api/src/marketing-budget/marketing-budget.repository';
import {
  AD_CREATIVE_MAX_BYTES,
  AD_VIDEO_MAX_BYTES,
  AdLaunchService,
  type MetaWriterPort,
} from '../../apps/api/src/marketing-ads/ad-launch';
import type { SiteAssetStorage } from '../../apps/api/src/marketing-site/asset-storage';
import { purgeAuditRows } from '../tools/audit-purge';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Запуск рекламы (DATA_MODEL §57, ADR-MKT-LAUNCH) на настоящей базе с поддельным Meta (сети нет): креатив, проверка
 * бюджета по остатку плана, шаги в журнал, номера Meta, кампания WETOP, ключ повтора, пауза при сбое, обрыв процесса,
 * «Остановить» и «Включить». Данные вымышленные (ADR-010).
 */
process.env.PII_ENCRYPTION_KEY ||= 'test-key-for-ad-launch-integration-only';
const TOKEN = 'suat-test-not-real';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('fake-jpeg-body')]);
/** MP4 и MOV опознаются по ящику `ftyp` в байтах 4–8 (марка `isom` или `qt  `) */
const ftyp = (brand: string, size: number) =>
  Buffer.concat([
    Buffer.from([0, 0, 0, 0x18]),
    Buffer.from('ftyp'),
    Buffer.from(brand),
    Buffer.alloc(Math.max(size - 12, 0), 7),
  ]);

class FakeWriter implements MetaWriterPort {
  calls: Array<[string, unknown[]]> = [];
  tokens: string[] = [];
  failAt: string | null = null;
  /** начало номеров объектов Meta: у разных запусков теста они не должны совпадать (кампания WETOP ищется по номеру) */
  idBase = '12000000000';
  private n = 0;
  private hit(name: string, args: unknown[]) {
    this.calls.push([name, args]);
    if (this.failAt === name)
      throw new meta.MetaApiError('Meta: Нет способа оплаты', 100, false, 1885272);
    this.n += 1;
    return `${this.idBase}${String(this.n).padStart(4, '0')}`;
  }
  async uploadImage(...a: unknown[]) {
    this.calls.push(['uploadImage', a]);
    if (this.failAt === 'uploadImage') throw new meta.MetaApiError('Meta: картинка', 100, false);
    return 'imghash123';
  }
  /** готовность видео по очереди: пустой список = сразу ready */
  videoStatuses: string[] = [];
  async uploadVideo(...a: unknown[]) {
    this.calls.push(['uploadVideo', a]);
    if (this.failAt === 'uploadVideo') throw new meta.MetaApiError('Meta: видео', 100, false);
    return 'video-888';
  }
  async video(...a: unknown[]) {
    this.calls.push(['video', a]);
    const status = this.videoStatuses.shift() ?? 'ready';
    return { status, picture: status === 'ready' ? 'https://example.test/thumb.jpg' : null };
  }
  async createCampaign(...a: unknown[]) {
    return this.hit('createCampaign', a);
  }
  async createAdSet(...a: unknown[]) {
    return this.hit('createAdSet', a);
  }
  async createCreative(...a: unknown[]) {
    return this.hit('createCreative', a);
  }
  async createAd(...a: unknown[]) {
    return this.hit('createAd', a);
  }
  async setStatus(...a: unknown[]) {
    this.calls.push(['setStatus', a]);
  }
  async assignedPages() {
    this.calls.push(['assignedPages', []]);
    return [{ id: '555', name: 'Отель на Абая', canAdvertise: true, instagramUserId: '777' }];
  }
  async searchCities(...a: unknown[]) {
    this.calls.push(['searchCities', a]);
    return [{ key: '1234567', name: 'Алматы', region: 'Алматы' }];
  }
  names() {
    return this.calls.map((c) => c[0]);
  }
}

class MemoryStorage implements SiteAssetStorage {
  objects = new Map<string, { body: Buffer; type: string }>();
  async put(i: { key: string; body: Buffer; contentType: string }) {
    this.objects.set(i.key, { body: i.body, type: i.contentType });
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async signedGet(key: string) {
    const o = this.objects.get(key)!;
    return `data:${o.type};base64,${o.body.toString('base64')}`;
  }
  async exists(key: string) {
    return this.objects.has(key);
  }
}

describe('запуск рекламы (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url))
    throw new Error('Запуск проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const db = prisma.db;
  const repo = new PrismaMarketingBudgetRepository(prisma);
  const storage = new MemoryStorage();
  let writer = new FakeWriter();
  const service = new AdLaunchService(prisma, repo, storage, (token) => {
    writer.tokens.push(token);
    return writer;
  });
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const org = randomUUID();
  const business = randomUUID();
  const location = randomUUID();
  const as = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      {
        userId: user,
        organizationId: org,
        scope: 'LOCATION',
        businessId: business,
        locationId: location,
        vertical: 'HOSPITALITY',
      },
      fn,
    );
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
  const month = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  let connectionId = '';
  let creativeId = '';

  const input = (over: Record<string, unknown> = {}) => ({
    requestKey: randomUUID(),
    creativeId,
    destination: 'WHATSAPP',
    dailyBudgetMinor: '500',
    fxRate: '480',
    headline: 'Осень у моря',
    primaryText: 'Номер с видом на горы. Напишите, подберём даты.',
    pageId: '555',
    instagramUserId: '777',
    countryCode: 'KZ',
    cities: [{ key: '1234567', name: 'Алматы' }],
    ageMin: 25,
    ageMax: 54,
    genders: [],
    advantageAudience: false,
    welcome: { text: 'Здравствуйте!', autofill: 'Хочу узнать цены' },
    proposal: { headline: 'Осень у моря (ИИ)' },
    ...over,
  });
  const setPlan = (amount: bigint) =>
    db.marketingBudgetLine.upsert({
      where: { locationId_month_platform: { locationId: location, month, platform: 'META' } },
      create: { locationId: location, month, platform: 'META', amount },
      update: { amount },
    });

  beforeAll(async () => {
    await db.user.create({ data: { id: user, email: `mkt-launch-${tag}@example.invalid` } });
    await db.organization.create({ data: { id: org, name: `Запуск ${tag}`, status: 'ACTIVE' } });
    await db.business.create({
      data: { id: business, organizationId: org, name: `Отель ${tag}`, vertical: 'HOSPITALITY' },
    });
    await db.location.create({
      data: {
        id: location,
        businessId: business,
        name: `Отель ${tag}`,
        timezone: 'Asia/Almaty',
        currency: 'KZT',
      },
    });
    connectionId = (
      await db.marketingAdConnection.create({
        data: {
          locationId: location,
          platform: 'META',
          adAccountId: '1234567890',
          currency: 'USD',
          timezone: 'Asia/Almaty',
          tokenCiphertext: encryptPii(TOKEN),
        },
      })
    ).id;
    await setPlan(100_000_000n);
  });

  afterAll(async () => {
    const launches = await db.marketingAdLaunch.findMany({
      where: { locationId: location },
      select: { id: true },
    });
    const campaigns = await db.marketingCampaign.findMany({
      where: { locationId: location },
      select: { id: true },
    });
    await purgeAuditRows(db, {
      entityId: { in: [...launches.map((l) => l.id), ...campaigns.map((c) => c.id)] },
    });
    await db.$transaction([
      db.marketingAdLaunchStep.deleteMany({ where: { launch: { locationId: location } } }),
      db.marketingAdLaunch.deleteMany({ where: { locationId: location } }),
      db.marketingAdCreative.deleteMany({ where: { locationId: location } }),
      db.marketingCampaign.deleteMany({ where: { locationId: location } }),
      db.marketingBudgetLine.deleteMany({ where: { locationId: location } }),
      db.marketingAdConnection.deleteMany({ where: { locationId: location } }),
    ]);
    await db.location.deleteMany({ where: { id: location } });
    await db.business.deleteMany({ where: { id: business } });
    await db.organization.deleteMany({ where: { id: org } });
    await db.user.deleteMany({ where: { id: user } });
    await prisma.onModuleDestroy();
  });

  it('креатив: JPEG в закрытое хранилище, тот же файл второй раз не ложится, не картинка отклоняется', async () => {
    const first = await as(() =>
      service.uploadCreative({ buffer: JPEG, originalname: 'offer.jpg' }),
    );
    const again = await as(() =>
      service.uploadCreative({ buffer: JPEG, originalname: 'copy.jpg' }),
    );
    expect(again.id).toBe(first.id);
    creativeId = first.id;
    const row = await db.marketingAdCreative.findUniqueOrThrow({ where: { id: first.id } });
    expect(row.storageRef).toBe(`marketing-ad-creatives/${location}/${row.id}/${row.sha256}.jpg`);
    expect(storage.objects.has(row.storageRef)).toBe(true);
    await expect(
      as(() => service.uploadCreative({ buffer: Buffer.from('%PDF-1.7'), originalname: 'a.pdf' })),
    ).rejects.toMatchObject({ status: 415 });
  });

  it('запуск: шаги по порядку, ключ кабинета, номера Meta, кампания WETOP ACTIVE, журнал из пяти шагов', async () => {
    writer = new FakeWriter();
    const body = input();
    const { id } = await as(() => service.start(body));
    await service.idle();
    expect(writer.names()).toEqual([
      'uploadImage',
      'createCampaign',
      'createAdSet',
      'createCreative',
      'createAd',
    ]);
    expect(writer.tokens).toEqual([TOKEN]);
    const adSet = writer.calls[2]![1][1] as Record<string, unknown>;
    expect(adSet).toMatchObject({
      destination: 'WHATSAPP',
      dailyBudgetMinor: 500n,
      currency: 'USD',
      pageId: '555',
      cityKeys: ['1234567'],
      ageMin: 25,
      ageMax: 54,
    });
    const creative = writer.calls[3]![1][1] as Record<string, unknown>;
    expect(creative).toMatchObject({
      media: { kind: 'IMAGE', imageHash: 'imghash123' },
      instagramUserId: '777',
      welcome: { text: 'Здравствуйте!', autofill: 'Хочу узнать цены' },
    });
    expect(String(creative.urlTags)).toContain('utm_content={{ad.id}}');

    const l = await db.marketingAdLaunch.findUniqueOrThrow({
      where: { id },
      include: { steps: { orderBy: { at: 'asc' } }, campaign: true },
    });
    expect(l).toMatchObject({
      status: 'SUCCEEDED',
      step: 'DONE',
      currency: 'USD',
      fxRate: expect.anything(),
    });
    expect(l.dailyBudgetBaseMinor).toBe(240_000n);
    expect(l.proposal).toEqual({ headline: 'Осень у моря (ИИ)' });
    expect(l.externalCampaignId).toBe('120000000000001');
    expect(l.campaign).toMatchObject({
      platform: 'META',
      externalId: '120000000000001',
      status: 'ACTIVE',
    });
    expect(l.steps.map((s) => `${s.step}:${s.status}`)).toEqual([
      'MEDIA:OK',
      'CAMPAIGN:OK',
      'ADSET:OK',
      'CREATIVE:OK',
      'AD:OK',
    ]);
    expect(l.steps[0]!.externalId).toBe('imghash123');

    // ключ повтора: то же нажатие не создаёт вторую кампанию
    writer = new FakeWriter();
    expect((await as(() => service.start(body))).id).toBe(id);
    await service.idle();
    expect(writer.calls).toEqual([]);
    const view = await as(() => service.view(id));
    expect(view).toMatchObject({
      status: 'SUCCEEDED',
      headline: 'Осень у моря',
      externalCampaignId: '120000000000001',
    });
  });

  it('сбой на группе: кампания в Meta на паузе, запуск FAILED словами Meta, кампании WETOP нет', async () => {
    writer = new FakeWriter();
    writer.failAt = 'createAdSet';
    const { id } = await as(() => service.start(input()));
    await service.idle();
    expect(writer.names()).toEqual(['uploadImage', 'createCampaign', 'createAdSet', 'setStatus']);
    expect(writer.calls[3]![1]).toEqual(['120000000000001', 'PAUSED']);
    const l = await db.marketingAdLaunch.findUniqueOrThrow({
      where: { id },
      include: { steps: { orderBy: { at: 'asc' } } },
    });
    expect(l).toMatchObject({
      status: 'FAILED',
      step: 'ADSET',
      campaignId: null,
      externalCampaignId: '120000000000001',
    });
    expect(l.error).toBe('Meta: Нет способа оплаты');
    expect(l.steps.map((s) => `${s.step}:${s.status}`)).toEqual([
      'MEDIA:OK',
      'CAMPAIGN:OK',
      'ADSET:FAILED',
      'ADSET:ROLLED_BACK',
    ]);
    expect(l.steps[2]!.errorCode).toBe(100);
  });

  it('видео: MP4 и MOV в закрытое хранилище как VIDEO, лимиты 8 МБ для фото и 200 МБ для видео', async () => {
    const mp4 = await as(() =>
      service.uploadCreative({ buffer: ftyp('isom', 4096), originalname: 'tour.mp4' }),
    );
    const mp4Row = await db.marketingAdCreative.findUniqueOrThrow({ where: { id: mp4.id } });
    expect(mp4Row).toMatchObject({ kind: 'VIDEO', mimeType: 'video/mp4', byteSize: 4096 });
    expect(mp4Row.storageRef).toBe(`marketing-ad-creatives/${location}/${mp4Row.id}/${mp4Row.sha256}.mp4`);

    const mov = await as(() =>
      service.uploadCreative({ buffer: ftyp('qt  ', 4096), originalname: 'tour.mov' }),
    );
    expect(await db.marketingAdCreative.findUniqueOrThrow({ where: { id: mov.id } })).toMatchObject({
      kind: 'VIDEO',
      mimeType: 'video/quicktime',
    });

    // фото больше 8 МБ отклоняется, видео такого же размера проходит
    const bigImage = Buffer.concat([JPEG, Buffer.alloc(AD_CREATIVE_MAX_BYTES, 1)]);
    await expect(
      as(() => service.uploadCreative({ buffer: bigImage, originalname: 'big.jpg' })),
    ).rejects.toMatchObject({ status: 413 });
    const bigVideo = ftyp('isom', AD_CREATIVE_MAX_BYTES + 1024);
    await expect(
      as(() => service.uploadCreative({ buffer: bigVideo, originalname: 'ok.mp4' })),
    ).resolves.toHaveProperty('id');
    await expect(
      as(() =>
        service.uploadCreative({ buffer: ftyp('isom', AD_VIDEO_MAX_BYTES + 1), originalname: 'x.mp4' }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });

  describe('запуск с видео', () => {
    const fast = { intervalMs: 1, timeoutMs: 80 };
    const videoService = () =>
      new AdLaunchService(
        prisma,
        repo,
        storage,
        (token) => {
          writer.tokens.push(token);
          return writer;
        },
        fast,
      );
    const videoCreative = async (tagName: string) =>
      (
        await as(() =>
          service.uploadCreative({ buffer: ftyp('isom', 2048 + tagName.length), originalname: `${tagName}.mp4` }),
        )
      ).id;

    it('загружает видео, ждёт готовности, креатив собирается из номера видео и превью', async () => {
      writer = new FakeWriter();
      writer.idBase = '13000000000';
      writer.videoStatuses = ['processing', 'processing', 'ready'];
      const svc = videoService();
      const creative = await videoCreative('ok');
      const { id } = await as(() => svc.start(input({ creativeId: creative })));
      await svc.idle();
      expect(writer.names()).toEqual([
        'uploadVideo',
        'video',
        'video',
        'video',
        'createCampaign',
        'createAdSet',
        'createCreative',
        'createAd',
      ]);
      const upload = writer.calls[0]![1] as [string, { mimeType: string; fileName: string }];
      expect(upload[1]).toMatchObject({ mimeType: 'video/mp4', fileName: 'ok.mp4' });
      expect(writer.calls[6]![1][1]).toMatchObject({
        media: { kind: 'VIDEO', videoId: 'video-888', thumbnailUrl: 'https://example.test/thumb.jpg' },
      });
      const l = await db.marketingAdLaunch.findUniqueOrThrow({
        where: { id },
        include: { steps: { orderBy: { at: 'asc' } } },
      });
      expect(l.status).toBe('SUCCEEDED');
      expect(l.steps[0]).toMatchObject({ step: 'MEDIA', status: 'OK', externalId: 'video-888' });
      // кампания не должна оставаться действующей: от неё зависит остаток бюджета в соседних проверках
      await db.marketingCampaign.update({ where: { id: l.campaignId! }, data: { status: 'PAUSED' } });
    });

    it('Meta не обработала видео: запуск FAILED словами, кампания в Meta не создаётся', async () => {
      writer = new FakeWriter();
      writer.videoStatuses = ['processing', 'error'];
      const svc = videoService();
      const creative = await videoCreative('bad');
      const { id } = await as(() => svc.start(input({ creativeId: creative })));
      await svc.idle();
      expect(writer.names()).toEqual(['uploadVideo', 'video', 'video']);
      const l = await db.marketingAdLaunch.findUniqueOrThrow({ where: { id } });
      expect(l).toMatchObject({ status: 'FAILED', step: 'MEDIA', externalCampaignId: null });
      expect(l.error).toMatch(/не смогла обработать видео/);
    });

    it('видео не готово за отведённое время: запуск FAILED, дальше загрузки Meta не идём', async () => {
      writer = new FakeWriter();
      writer.videoStatuses = Array.from({ length: 500 }, () => 'processing');
      const svc = videoService();
      const creative = await videoCreative('slow');
      const { id } = await as(() => svc.start(input({ creativeId: creative })));
      await svc.idle();
      expect(writer.names()).not.toContain('createCampaign');
      const l = await db.marketingAdLaunch.findUniqueOrThrow({ where: { id } });
      expect(l).toMatchObject({ status: 'FAILED', step: 'MEDIA' });
      expect(l.error).toMatch(/не обработано за/);
    });
  });

  it('деньги: нет плана, остаток плана мал, кабинет в тенге: отказ словами до Meta, строки нет', async () => {
    writer = new FakeWriter();
    const before = await db.marketingAdLaunch.count({ where: { locationId: location } });
    await setPlan(1_000n);
    await expect(as(() => service.start(input()))).rejects.toThrow(/план|Остаток/);
    await db.marketingBudgetLine.delete({
      where: { locationId_month_platform: { locationId: location, month, platform: 'META' } },
    });
    await expect(as(() => service.start(input()))).rejects.toThrow(/Нет плана канала Meta/);
    await setPlan(100_000_000n);
    await db.marketingAdConnection.update({
      where: { id: connectionId },
      data: { currency: 'KZT' },
    });
    await expect(as(() => service.start(input({ dailyBudgetMinor: '500000' })))).rejects.toThrow(
      /Q-MKT-KZT/,
    );
    await db.marketingAdConnection.update({
      where: { id: connectionId },
      data: { currency: 'USD' },
    });
    expect(await db.marketingAdLaunch.count({ where: { locationId: location } })).toBe(before);
    expect(writer.calls).toEqual([]);
  });

  it('мастер: кабинет, страницы, запомненные страница и Instagram, сколько ещё можно в день; город', async () => {
    writer = new FakeWriter();
    const a = await as(() => service.assets());
    expect(a).toMatchObject({
      connected: true,
      reportingCurrency: 'KZT',
      cabinet: { currency: 'USD' },
      pages: [{ id: '555', instagramUserId: '777' }],
      pagesError: null,
      // запуск выше запомнил выбор
      defaults: { pageId: '555', instagramUserId: '777' },
    });
    // план 100 000 000 минус действующий запуск 240 000 в день: подсказка той же формулой, что проверка
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
    const [y, m, d] = today.split('-').map(Number) as [number, number, number];
    const days = BigInt(new Date(Date.UTC(y, m, 0)).getUTCDate() - d + 1);
    expect(a.roomDailyMinor).toBe((100_000_000n / days - 240_000n).toString());
    expect(await as(() => service.geo('Алма', 'KZ'))).toEqual([{ key: '1234567', name: 'Алматы', region: 'Алматы' }]);
    expect(writer.calls.at(-1)).toEqual(['searchCities', ['Алма', 'KZ']]);
    await expect(as(() => service.geo('А', 'KZ'))).rejects.toThrow(/от 2 букв/);
  });

  it('«Остановить» и «Включить»: сначала Meta, потом статус кампании WETOP и журнал', async () => {
    const c = await db.marketingCampaign.findFirstOrThrow({
      where: { locationId: location, externalId: '120000000000001' },
    });
    writer = new FakeWriter();
    await as(() => service.setCampaignStatus(c.id, 'PAUSED'));
    expect(writer.calls).toEqual([['setStatus', ['120000000000001', 'PAUSED']]]);
    expect((await db.marketingCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
      'PAUSED',
    );
    await as(() => service.setCampaignStatus(c.id, 'ACTIVE'));
    expect((await db.marketingCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
      'ACTIVE',
    );
  });

  it('обрыв процесса: RUNNING старше 15 минут закрывается FAILED, созданная кампания на паузу', async () => {
    writer = new FakeWriter();
    const id = randomUUID();
    await db.marketingAdLaunch.create({
      data: {
        id,
        locationId: location,
        connectionId,
        requestKey: randomUUID(),
        source: 'SCREEN',
        goal: 'MESSAGES',
        destination: 'WHATSAPP',
        dailyBudgetMinor: 500n,
        currency: 'USD',
        fxRate: '480',
        dailyBudgetBaseMinor: 240_000n,
        settings: {},
        creativeId,
        step: 'ADSET',
        externalCampaignId: '120000000009999',
        createdAt: new Date(Date.now() - 20 * 60_000),
      },
    });
    expect(await service.recoverStale()).toBe(1);
    expect(writer.calls).toEqual([['setStatus', ['120000000009999', 'PAUSED']]]);
    const l = await db.marketingAdLaunch.findUniqueOrThrow({ where: { id } });
    expect(l).toMatchObject({ status: 'FAILED', error: 'Запуск прерван перезапуском сервера' });
  });

  it('«Аудитории» и «Креативы»: успешный запуск с днями кабинета, цена заявки; аудитория для мастера; чужой филиал нет', async () => {
    const ok = await db.marketingAdLaunch.findFirstOrThrow({
      where: { locationId: location, status: 'SUCCEEDED', campaignId: { not: null } },
      orderBy: { createdAt: 'asc' },
    });
    const day = (d: string, spend: bigint, leads: number, currency = 'USD') =>
      db.marketingCampaignStat.create({
        data: { campaignId: ok.campaignId!, date: new Date(`${d}T00:00:00Z`), impressions: 1000, clicks: 50, leads, source: 'META', spendMinor: spend, spendCurrency: currency },
      });
    await day('2026-10-01', 3000n, 4);
    await day('2026-10-02', 1000n, 0);
    // день в чужой валюте в расход не складывается
    await day('2026-10-03', 999_999n, 0, 'KZT');
    const lib = await as(() => service.library());
    const row = lib.audiences.find((a) => a.lastLaunchId === ok.id || a.settings.ageMin === 25)!;
    expect(row).toMatchObject({ label: 'Алматы · 25–54 · все', currency: 'USD' });
    expect(row.leads).toBeGreaterThanOrEqual(4);
    expect(lib.audiences.every((a) => a.currency === 'USD')).toBe(true);
    const creative = lib.creatives.find((c) => c.creativeId === ok.creativeId)!;
    expect(creative).toMatchObject({ kind: 'IMAGE', fileName: 'offer.jpg' });
    expect(BigInt(creative.spendMinor)).toBeGreaterThanOrEqual(4000n);
    expect(BigInt(creative.spendMinor)).toBeLessThan(999_999n);
    // неудачный запуск в сводку не попал
    const failed = await db.marketingAdLaunch.findFirstOrThrow({ where: { locationId: location, status: 'FAILED' } });
    expect(lib.audiences.some((a) => a.lastLaunchId === failed.id)).toBe(false);

    expect(await as(() => service.audienceOf(ok.id))).toEqual({
      countryCode: 'KZ',
      cities: [{ key: '1234567', name: 'Алматы' }],
      ageMin: 25,
      ageMax: 54,
      genders: [],
      advantageAudience: false,
    });
    await expect(as(() => service.audienceOf(failed.id))).rejects.toThrow('Запуск не найден');
    // другой филиал той же организации: чужих запусков не видно
    const other = randomUUID();
    await db.location.create({ data: { id: other, businessId: business, name: `Другой ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
    try {
      const foreign = await withSignedInUser(
        { userId: user, organizationId: org, scope: 'LOCATION', businessId: business, locationId: other, vertical: 'HOSPITALITY' },
        () => service.library(),
      );
      expect(foreign).toEqual({ audiences: [], creatives: [] });
      await expect(
        withSignedInUser(
          { userId: user, organizationId: org, scope: 'LOCATION', businessId: business, locationId: other, vertical: 'HOSPITALITY' },
          () => service.audienceOf(ok.id),
        ),
      ).rejects.toThrow('Запуск не найден');
    } finally {
      await db.location.delete({ where: { id: other } });
    }
  });
});
