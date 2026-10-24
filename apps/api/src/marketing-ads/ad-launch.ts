import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
  type OnModuleInit,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MarketingBudgetError,
  checkLaunchBudget,
  daysLeftInMonth,
  launchBudgetRoom,
  parseLaunchInput,
  toBaseMinor,
  type AdLaunchInput,
  adLibrary,
  type AdLibraryLaunch,
} from '@pms/domain';
import { meta } from '@pms/integrations';
import { decryptPii } from '@pms/shared';
import { auditUserId } from '../accounts/actor';
import { Access } from '../auth/access.decorator';
import { PrismaService } from '../database/prisma.provider';
import { safeFileName } from '../hotel/property-media';
import {
  SITE_ASSET_STORAGE,
  signedUrlTtl,
  type SiteAssetStorage,
} from '../marketing-site/asset-storage';
import {
  MARKETING_BUDGET_REPOSITORY,
  type MarketingBudgetRepository,
} from '../marketing-budget/marketing-budget.repository';

/**
 * Запуск рекламы из WETOP (DATA_MODEL §57, ADR-MKT-LAUNCH, техпроект `plans/marketing-ai-targetolog-tech-2026-10-16.md` §5).
 * Мастер шлёт проверенные человеком настройки; API сверяет бюджет с остатком плана канала Meta, пишет запуск и в фоне
 * проходит шаги в Meta (картинка, кампания, группа, креатив, объявление, всё сразу ACTIVE), каждый шаг в журнал
 * (ADR-007). Сбой после создания кампании ставит её на паузу: работающей рекламы, о которой WETOP не знает, не остаётся.
 * Код площадки в `@pms/integrations` (ADR-004); здесь фабрика, которую тесты подменяют.
 */
export const META_WRITER = Symbol('META_WRITER');
export type MetaWriterPort = Pick<
  meta.MetaAdsWriter,
  | 'uploadImage'
  | 'uploadVideo'
  | 'video'
  | 'createCampaign'
  | 'createAdSet'
  | 'createCreative'
  | 'createAd'
  | 'setStatus'
  | 'assignedPages'
  | 'searchCities'
>;
export type MetaWriterFactory = (token: string) => MetaWriterPort;
export const metaWriterFactory: MetaWriterFactory = (token) =>
  new meta.MetaAdsWriter({ accessToken: token });

/** Фото креатива: JPEG или PNG как есть (Meta получает исходник), до 8 МБ; видео MP4 или MOV до 200 МБ (§57 CHECK) */
export const AD_CREATIVE_MAX_BYTES = 8 * 1024 * 1024;
export const AD_VIDEO_MAX_BYTES = 200 * 1024 * 1024;
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
/** MP4 и MOV начинаются с ящика `ftyp` в байтах 4–8; марка `qt  ` в байтах 8–12 это QuickTime */
const FTYP = Buffer.from('ftyp');
const QUICKTIME = Buffer.from('qt  ');
/** Готовность видео в Meta: опрос раз в 5 секунд, не дольше 10 минут (create.md §2.3) */
export const AD_VIDEO_POLL = Symbol('AD_VIDEO_POLL');
export interface VideoPoll {
  intervalMs: number;
  timeoutMs: number;
}
const DEFAULT_VIDEO_POLL: VideoPoll = { intervalMs: 5_000, timeoutMs: 600_000 };
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const waitText = (ms: number) => (ms >= 60_000 ? `${Math.round(ms / 60_000)} мин` : `${Math.ceil(ms / 1000)} с`);
/** Запуск дольше этого после старта процесса считается оборванным (техпроект §5) */
const STALE_MS = 15 * 60_000;

type Step = 'MEDIA' | 'CAMPAIGN' | 'ADSET' | 'CREATIVE' | 'AD' | 'DONE';
const dayIn = (timezone: string, now: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);
const isUnique = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
const rule = <T>(fn: () => T): T => {
  try {
    return fn();
  } catch (e) {
    if (e instanceof MarketingBudgetError || e instanceof meta.MetaApiError)
      throw new BadRequestException(e.message);
    throw e;
  }
};

export interface LaunchView {
  id: string;
  status: string;
  step: string;
  destination: string;
  headline: string;
  dailyBudgetMinor: string;
  currency: string;
  campaignId: string | null;
  externalCampaignId: string | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

@Injectable()
export class AdLaunchService implements OnModuleInit {
  private readonly log = new Logger(AdLaunchService.name);
  /** ponytail: замок кабинета в памяти одного процесса API; при нескольких экземплярах: pg_advisory_lock */
  private readonly busy = new Map<string, Promise<void>>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MARKETING_BUDGET_REPOSITORY) private readonly repo: MarketingBudgetRepository,
    @Optional() @Inject(SITE_ASSET_STORAGE) private readonly storage: SiteAssetStorage | null,
    @Inject(META_WRITER) private readonly writer: MetaWriterFactory,
    @Optional() @Inject(AD_VIDEO_POLL) private readonly videoPoll: VideoPoll = DEFAULT_VIDEO_POLL,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    void this.recoverStale().catch((e: unknown) =>
      this.log.warn(`оборванные запуски не закрыты: ${errorText(e)}`),
    );
  }

  /** Дождаться фоновых запусков (тесты и остановка процесса) */
  async idle(): Promise<void> {
    while (this.busy.size) await Promise.allSettled([...this.busy.values()]);
  }

  private requireStorage(): SiteAssetStorage {
    if (!this.storage)
      throw new ServiceUnavailableException(
        'Хранилище файлов не включено. Обратитесь в поддержку WETOP.',
      );
    return this.storage;
  }

  private async scope() {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    return scope;
  }

  /** Фото или видео креатива в закрытое хранилище (как чеки §51); тот же файл филиала второй раз не ложится */
  async uploadCreative(file: { buffer?: Buffer; originalname?: string } | undefined) {
    const body = file?.buffer;
    if (!body?.length) throw new BadRequestException('Выберите фото или видео креатива');
    const video = body.subarray(4, 8).equals(FTYP);
    const png = body.subarray(0, 4).equals(PNG);
    if (!video && !png && !body.subarray(0, 3).equals(JPEG))
      throw new HttpException('Креатив: фото JPEG, PNG или видео MP4, MOV', 415);
    if (video && body.length > AD_VIDEO_MAX_BYTES) throw new HttpException('Видео больше 200 МБ', 413);
    if (!video && body.length > AD_CREATIVE_MAX_BYTES) throw new HttpException('Фото больше 8 МБ', 413);
    const quicktime = video && body.subarray(8, 12).equals(QUICKTIME);
    const scope = await this.scope();
    const storage = this.requireStorage();
    const sha256 = createHash('sha256').update(body).digest('hex');
    const select = { id: true, fileName: true, storageRef: true } as const;
    const view = async (r: { id: string; fileName: string; storageRef: string }) => ({
      id: r.id,
      fileName: r.fileName,
      url: await storage.signedGet(r.storageRef, signedUrlTtl()),
    });
    const existing = await this.prisma.db.marketingAdCreative.findFirst({
      where: { locationId: scope.locationId, sha256 },
      select,
    });
    if (existing) return view(existing);
    const id = randomUUID();
    const mimeType = video ? (quicktime ? 'video/quicktime' : 'video/mp4') : png ? 'image/png' : 'image/jpeg';
    const ext = video ? (quicktime ? 'mov' : 'mp4') : png ? 'png' : 'jpg';
    const key = `marketing-ad-creatives/${scope.locationId}/${id}/${sha256}.${ext}`;
    try {
      await storage.put({ key, body, contentType: mimeType });
    } catch {
      throw new ServiceUnavailableException('Не удалось сохранить файл, повторите позже');
    }
    try {
      const row = await this.prisma.db.marketingAdCreative.create({
        data: {
          id,
          locationId: scope.locationId,
          kind: video ? 'VIDEO' : 'IMAGE',
          fileName: safeFileName(file?.originalname, 'Креатив'),
          mimeType,
          storageRef: key,
          byteSize: body.length,
          sha256,
          createdById: auditUserId(),
        },
        select,
      });
      return view(row);
    } catch (e) {
      await storage.delete(key).catch(() => undefined);
      if (isUnique(e)) {
        const winner = await this.prisma.db.marketingAdCreative.findFirst({
          where: { locationId: scope.locationId, sha256 },
          select,
        });
        if (winner) return view(winner);
      }
      throw e;
    }
  }

  /** Запуск: проверки и строка запуска сразу, шаги в Meta в фоне; ответ `{ id }` для экрана шагов */
  async start(raw: unknown): Promise<{ id: string }> {
    const scope = await this.scope();
    const input = rule(() => parseLaunchInput(raw));
    const prior = await this.prisma.db.marketingAdLaunch.findUnique({
      where: { requestKey: input.requestKey },
      select: { id: true, locationId: true },
    });
    if (prior) {
      if (prior.locationId !== scope.locationId)
        throw new ConflictException('Повторите запуск из мастера');
      return { id: prior.id };
    }
    const conn = await this.prisma.db.marketingAdConnection.findFirst({
      where: { locationId: scope.locationId, platform: 'META', status: 'ACTIVE' },
      select: { id: true, currency: true },
    });
    if (!conn) throw new ConflictException('Подключите рекламный кабинет Meta на «Рекламе»');
    rule(() => meta.metaBudgetUnits(input.dailyBudgetMinor, conn.currency));
    const creative = await this.prisma.db.marketingAdCreative.findFirst({
      where: { id: input.creativeId, locationId: scope.locationId },
      select: { id: true },
    });
    if (!creative) throw new NotFoundException('Креатив не найден: загрузите фото ещё раз');
    const fxRate = conn.currency === scope.reportingCurrency ? '1' : input.fxRate;
    const baseDaily = rule(() => toBaseMinor(input.dailyBudgetMinor, fxRate));
    await this.checkBudget(scope.locationId, scope.timezone, baseDaily);
    const id = randomUUID();
    const { requestKey, creativeId, destination, dailyBudgetMinor, proposal, ...rest } = input;
    void creativeId;
    try {
      await this.prisma.db.$transaction(async (tx) => {
        await tx.marketingAdLaunch.create({
          data: {
            id,
            locationId: scope.locationId,
            connectionId: conn.id,
            requestKey,
            source: 'SCREEN',
            goal:
              destination === 'LEAD_FORM'
                ? 'LEADS'
                : destination === 'WEBSITE'
                  ? 'WEBSITE'
                  : 'MESSAGES',
            destination,
            dailyBudgetMinor,
            currency: conn.currency,
            fxRate,
            dailyBudgetBaseMinor: baseDaily,
            settings: rest as object,
            ...(proposal ? { proposal: proposal as object } : {}),
            creativeId: creative.id,
            createdById: auditUserId(),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: auditUserId(),
            entityType: 'marketing_ad_launch',
            entityId: id,
            action: 'marketing_ad_launch.started',
            after: {
              destination,
              dailyBudgetMinor: dailyBudgetMinor.toString(),
              currency: conn.currency,
              headline: rest.headline,
            },
          },
        });
      });
    } catch (e) {
      if (isUnique(e)) {
        const winner = await this.prisma.db.marketingAdLaunch.findUnique({
          where: { requestKey },
          select: { id: true },
        });
        if (winner) return { id: winner.id };
      }
      throw e;
    }
    // выбор страницы и Instagram запоминается как умолчание мастера (§57 поправка §55)
    await this.prisma.db.marketingAdConnection.update({
      where: { id: conn.id },
      data: { pageId: rest.pageId, instagramUserId: rest.instagramUserId },
    });
    this.schedule(conn.id, id);
    return { id };
  }

  /** Правило денег §57: действующие запуски кабинета + новый × оставшиеся дни ≤ план Meta − учтённый расход Meta */
  /** Деньги для правила §57 в валюте отчётности: план Meta на месяц, учтённый расход Meta, действующие запуски */
  private async money(locationId: string, timezone: string) {
    const today = dayIn(timezone, new Date());
    const month = asDate(`${today.slice(0, 7)}-01`);
    const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    const [plan, spent, active] = await Promise.all([
      this.prisma.db.marketingBudgetLine.findFirst({
        where: { locationId, month, platform: 'META' },
        select: { amount: true },
      }),
      this.prisma.db.marketingExpense.aggregate({
        where: {
          locationId,
          platform: 'META',
          countedInBudget: true,
          date: { gte: month, lt: next },
        },
        _sum: { baseAmount: true },
      }),
      this.prisma.db.marketingAdLaunch.aggregate({
        where: { locationId, status: 'SUCCEEDED', campaign: { status: 'ACTIVE' } },
        _sum: { dailyBudgetBaseMinor: true },
      }),
    ]);
    return {
      planMinor: plan?.amount ?? null,
      spentMinor: spent._sum.baseAmount ?? 0n,
      activeDailyMinor: active._sum.dailyBudgetBaseMinor ?? 0n,
      daysLeft: daysLeftInMonth(today),
    };
  }

  private async checkBudget(locationId: string, timezone: string, newDailyMinor: bigint) {
    const m = await this.money(locationId, timezone);
    rule(() => checkLaunchBudget({ ...m, newDailyMinor }));
  }

  /**
   * Что нужно мастеру: кабинет, страницы и Instagram из окна входа, выбор по умолчанию, сколько ещё можно в день
   * (валюта отчётности). Кабинета нет: `connected: false`, мастер ведёт на подключение.
   */
  async assets() {
    const scope = await this.repo.scope();
    const conn = await this.prisma.db.marketingAdConnection.findFirst({
      where: { locationId: scope.locationId, platform: 'META', status: 'ACTIVE' },
      select: {
        accountName: true,
        adAccountId: true,
        currency: true,
        tokenCiphertext: true,
        pageId: true,
        instagramUserId: true,
      },
    });
    const m = await this.money(scope.locationId, scope.timezone);
    const room = launchBudgetRoom(m);
    const base = {
      reportingCurrency: scope.reportingCurrency,
      roomDailyMinor: room === null ? null : room.toString(),
    };
    if (!conn) return { connected: false as const, ...base };
    let pages: meta.MetaPage[] = [];
    let pagesError: string | null = null;
    try {
      pages = await this.writer(decryptPii(conn.tokenCiphertext)).assignedPages();
    } catch (e) {
      pagesError = errorText(e);
    }
    return {
      connected: true as const,
      ...base,
      cabinet: { name: conn.accountName ?? conn.adAccountId, currency: conn.currency },
      pages,
      pagesError,
      defaults: { pageId: conn.pageId, instagramUserId: conn.instagramUserId },
    };
  }

  /** Город для таргетинга: поиск Meta в стране (create.md §8) */
  async geo(q: unknown, country: unknown) {
    const query = typeof q === 'string' ? q.trim() : '';
    const code = typeof country === 'string' && /^[A-Z]{2}$/.test(country) ? country : 'KZ';
    if (query.length < 2 || query.length > 60) throw new BadRequestException('Введите от 2 букв названия города');
    const scope = await this.repo.scope();
    const conn = await this.prisma.db.marketingAdConnection.findFirst({
      where: { locationId: scope.locationId, platform: 'META', status: 'ACTIVE' },
      select: { tokenCiphertext: true },
    });
    if (!conn) throw new ConflictException('Подключите рекламный кабинет Meta на «Рекламе»');
    try {
      return await this.writer(decryptPii(conn.tokenCiphertext)).searchCities(query, code);
    } catch (e) {
      if (e instanceof meta.MetaApiError) throw new HttpException(e.message, 502);
      throw e;
    }
  }

  private schedule(connectionId: string, launchId: string) {
    const before = this.busy.get(connectionId) ?? Promise.resolve();
    const run = before
      .then(() => this.run(launchId))
      .catch((e: unknown) => this.log.error(`запуск ${launchId}: ${errorText(e)}`))
      .finally(() => {
        if (this.busy.get(connectionId) === run) this.busy.delete(connectionId);
      });
    this.busy.set(connectionId, run);
  }

  private step(
    launchId: string,
    step: Step,
    status: 'OK' | 'FAILED' | 'ROLLED_BACK',
    extra: { externalId?: string; error?: unknown } = {},
  ) {
    const e = extra.error;
    return this.prisma.db.marketingAdLaunchStep.create({
      data: {
        launchId,
        step,
        attempt: 1,
        status,
        externalId: extra.externalId ?? null,
        errorCode: e instanceof meta.MetaApiError ? e.code : null,
        error: e === undefined ? null : errorText(e),
      },
    });
  }

  /** Шаги в Meta по порядку; номер каждого созданного объекта сразу в строку запуска и в журнал */
  async run(launchId: string): Promise<void> {
    const l = await this.prisma.db.marketingAdLaunch.findUnique({
      where: { id: launchId },
      include: { connection: true, creative: true },
    });
    if (!l || l.status !== 'RUNNING') return;
    const s = l.settings as unknown as Omit<
      AdLaunchInput,
      'requestKey' | 'creativeId' | 'destination' | 'dailyBudgetMinor' | 'proposal'
    >;
    const writer = this.writer(decryptPii(l.connection.tokenCiphertext));
    const account = l.connection.adAccountId;
    const name = `WETOP: ${s.headline} ${l.createdAt.toISOString().slice(0, 10)}`;
    let current: Step = 'MEDIA';
    let campaignExt: string | null = null;
    const advance = async (next: Step, data: Record<string, string>) => {
      await this.prisma.db.marketingAdLaunch.update({
        where: { id: launchId },
        data: { ...data, step: next },
      });
      current = next;
    };
    try {
      const isVideo = l.creative!.kind === 'VIDEO';
      const signed = await this.requireStorage().signedGet(l.creative!.storageRef, 900);
      const res = await fetch(signed, { signal: AbortSignal.timeout(isVideo ? 300_000 : 60_000) });
      if (!res.ok) throw new Error('Креатив не прочитан из хранилища');
      const bytes = new Uint8Array(await res.arrayBuffer());
      const media: Parameters<MetaWriterPort['createCreative']>[1]['media'] = isVideo
        ? await this.uploadVideo(writer, account, {
            fileName: l.creative!.fileName,
            bytes,
            mimeType: l.creative!.mimeType,
          })
        : {
            kind: 'IMAGE',
            imageHash: await writer.uploadImage(account, { fileName: l.creative!.fileName, bytes }),
          };
      await this.step(launchId, 'MEDIA', 'OK', {
        externalId: media.kind === 'VIDEO' ? media.videoId : media.imageHash,
      });
      await advance('CAMPAIGN', {});

      campaignExt = await writer.createCampaign(account, { name, destination: l.destination });
      await this.step(launchId, 'CAMPAIGN', 'OK', { externalId: campaignExt });
      await advance('ADSET', { externalCampaignId: campaignExt });

      const adSet = await writer.createAdSet(account, {
        name,
        campaignId: campaignExt,
        destination: l.destination,
        dailyBudgetMinor: l.dailyBudgetMinor,
        currency: l.currency,
        pageId: s.pageId,
        countryCode: s.countryCode,
        cityKeys: s.cities.map((c) => c.key),
        ageMin: s.ageMin,
        ageMax: s.ageMax,
        genders: s.genders,
        advantageAudience: s.advantageAudience,
      });
      await this.step(launchId, 'ADSET', 'OK', { externalId: adSet });
      await advance('CREATIVE', { externalAdsetId: adSet });

      const creative = await writer.createCreative(account, {
        name,
        destination: l.destination,
        pageId: s.pageId,
        instagramUserId: s.instagramUserId,
        media,
        message: s.primaryText,
        headline: s.headline,
        description: s.description,
        link: s.link,
        leadFormId: s.leadFormId,
        welcome: s.welcome,
        urlTags:
          'utm_source=meta&utm_medium={{placement}}&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}',
      });
      await this.step(launchId, 'CREATIVE', 'OK', { externalId: creative });
      await advance('AD', { externalCreativeId: creative });

      const ad = await writer.createAd(account, { name, adSetId: adSet, creativeId: creative });
      await this.step(launchId, 'AD', 'OK', { externalId: ad });

      await this.prisma.db.$transaction(async (tx) => {
        const campaign = await tx.marketingCampaign.upsert({
          where: {
            locationId_platform_externalId: {
              locationId: l.locationId,
              platform: 'META',
              externalId: campaignExt!,
            },
          },
          create: {
            locationId: l.locationId,
            platform: 'META',
            externalId: campaignExt!,
            name: name.slice(0, 200),
            status: 'ACTIVE',
            startsOn: asDate(dayIn(l.connection.timezone, l.createdAt)),
          },
          update: { status: 'ACTIVE' },
          select: { id: true },
        });
        await tx.marketingAdLaunch.update({
          where: { id: launchId },
          data: {
            externalAdId: ad,
            campaignId: campaign.id,
            step: 'DONE',
            status: 'SUCCEEDED',
            finishedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: l.createdById,
            entityType: 'marketing_ad_launch',
            entityId: launchId,
            action: 'marketing_ad_launch.succeeded',
            after: { externalCampaignId: campaignExt, externalAdId: ad },
          },
        });
      });
    } catch (e) {
      await this.fail(launchId, current, campaignExt, writer, e);
    }
  }

  /** Видео в кабинет и ожидание, пока Meta его обработает: креатив с видео создаётся только после `ready` */
  private async uploadVideo(
    writer: MetaWriterPort,
    account: string,
    file: { fileName: string; bytes: Uint8Array; mimeType: string },
  ) {
    const videoId = await writer.uploadVideo(account, file);
    const { intervalMs, timeoutMs } = this.videoPoll;
    const startedAt = Date.now();
    for (;;) {
      const state = await writer.video(videoId);
      if (state.status === 'ready') {
        if (!state.picture) throw new Error('Meta не вернула превью видео');
        return { kind: 'VIDEO' as const, videoId, thumbnailUrl: state.picture };
      }
      if (state.status === 'error') throw new Error('Meta не смогла обработать видео: загрузите другой файл');
      if (Date.now() - startedAt >= timeoutMs)
        throw new Error(`Видео не обработано за ${waitText(timeoutMs)}: попробуйте файл меньше`);
      await sleep(intervalMs);
    }
  }

  /** Сбой шага: журнал, пауза созданной кампании (повтор статуса безопасен), запуск закрыт ошибкой словами */
  private async fail(
    launchId: string,
    current: Step,
    campaignExt: string | null,
    writer: MetaWriterPort | null,
    e: unknown,
  ) {
    await this.step(launchId, current, 'FAILED', { error: e }).catch(() => undefined);
    let paused = false;
    if (campaignExt && writer) {
      try {
        await writer.setStatus(campaignExt, 'PAUSED');
        await this.step(launchId, current, 'ROLLED_BACK', { externalId: campaignExt });
        paused = true;
      } catch (pe) {
        this.log.error(
          `запуск ${launchId}: кампания ${campaignExt} не поставлена на паузу: ${errorText(pe)}`,
        );
      }
    }
    const tail =
      campaignExt && !paused
        ? ' Кампания в Meta могла остаться включённой: проверьте Ads Manager.'
        : '';
    const text = `${errorText(e)}${tail}`.slice(0, 500);
    await this.prisma.db.$transaction([
      this.prisma.db.marketingAdLaunch.update({
        where: { id: launchId },
        data: { status: 'FAILED', error: text, finishedAt: new Date() },
      }),
      this.prisma.db.auditLog.create({
        data: {
          entityType: 'marketing_ad_launch',
          entityId: launchId,
          action: 'marketing_ad_launch.failed',
          after: { step: current, error: text, paused },
        },
      }),
    ]);
  }

  /** После перезапуска API: запуски RUNNING старше 15 минут закрываются ошибкой, созданная кампания на паузу */
  async recoverStale(now: Date = new Date()): Promise<number> {
    const stale = await this.prisma.db.marketingAdLaunch.findMany({
      where: { status: 'RUNNING', createdAt: { lt: new Date(now.getTime() - STALE_MS) } },
      include: { connection: true },
    });
    for (const l of stale) {
      // отключённый кабинет: ключ стёрт (§55), паузу поставить нечем, текст ошибки скажет проверить Ads Manager
      const writer =
        l.connection.status === 'DISCONNECTED'
          ? null
          : this.writer(decryptPii(l.connection.tokenCiphertext));
      await this.fail(
        l.id,
        l.step as Step,
        l.externalCampaignId,
        writer,
        new Error('Запуск прерван перезапуском сервера'),
      );
    }
    return stale.length;
  }

  async view(id: string): Promise<LaunchView> {
    const scope = await this.repo.scope();
    const l = await this.prisma.db.marketingAdLaunch.findFirst({
      where: { id, locationId: scope.locationId },
    });
    if (!l) throw new NotFoundException('Запуск не найден');
    return this.toView(l);
  }

  async list(): Promise<LaunchView[]> {
    const scope = await this.repo.scope();
    const rows = await this.prisma.db.marketingAdLaunch.findMany({
      where: { locationId: scope.locationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((l) => this.toView(l));
  }

  /**
   * «Аудитории» и «Креативы» (23.10.2026): успешные запуски филиала с днями кабинета их кампаний; без новой таблицы.
   * Филиал строго из scope; право раздела `marketing`, ничего не пишет.
   */
  async library() {
    const scope = await this.repo.scope();
    const rows = await this.prisma.db.marketingAdLaunch.findMany({
      where: { locationId: scope.locationId, status: 'SUCCEEDED' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        status: true,
        createdAt: true,
        currency: true,
        settings: true,
        creative: { select: { id: true, kind: true, fileName: true } },
        campaign: { select: { stats: { select: { spendMinor: true, spendCurrency: true, leads: true, impressions: true, clicks: true } } } },
      },
    });
    const launches: AdLibraryLaunch[] = rows.map((l) => {
      const days = l.campaign?.stats ?? [];
      return {
        id: l.id,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
        currency: l.currency,
        headline: String((l.settings as { headline?: unknown }).headline ?? ''),
        settings: l.settings as unknown as AdLibraryLaunch['settings'],
        creative: l.creative ? { id: l.creative.id, kind: l.creative.kind as 'IMAGE' | 'VIDEO', fileName: l.creative.fileName } : null,
        stats: days.length
          ? {
              // расход кабинета только в валюте запуска: другую валюту не складываем
              spendMinor: days.reduce((s, d) => s + (d.spendCurrency === l.currency ? (d.spendMinor ?? 0n) : 0n), 0n),
              leads: days.reduce((s, d) => s + d.leads, 0),
              impressions: days.reduce((s, d) => s + d.impressions, 0),
              clicks: days.reduce((s, d) => s + d.clicks, 0),
            }
          : null,
      };
    });
    return adLibrary(launches);
  }

  /** Аудитория прошлого запуска для мастера «Новая кампания»: только настройки показа, без текста и бюджета */
  async audienceOf(id: string) {
    const scope = await this.repo.scope();
    const l = await this.prisma.db.marketingAdLaunch.findFirst({
      where: { id, locationId: scope.locationId, status: 'SUCCEEDED' },
      select: { settings: true },
    });
    if (!l) throw new NotFoundException('Запуск не найден');
    const s = l.settings as Record<string, unknown>;
    return {
      countryCode: s.countryCode,
      cities: s.cities ?? [],
      ageMin: s.ageMin,
      ageMax: s.ageMax,
      genders: s.genders ?? [],
      advantageAudience: s.advantageAudience === true,
    };
  }

  private toView(l: {
    id: string;
    status: string;
    step: string;
    destination: string;
    settings: unknown;
    dailyBudgetMinor: bigint;
    currency: string;
    campaignId: string | null;
    externalCampaignId: string | null;
    error: string | null;
    createdAt: Date;
    finishedAt: Date | null;
  }): LaunchView {
    return {
      id: l.id,
      status: l.status,
      step: l.step,
      destination: l.destination,
      headline: String((l.settings as { headline?: unknown }).headline ?? ''),
      dailyBudgetMinor: l.dailyBudgetMinor.toString(),
      currency: l.currency,
      campaignId: l.campaignId,
      externalCampaignId: l.externalCampaignId,
      error: l.error,
      createdAt: l.createdAt.toISOString(),
      finishedAt: l.finishedAt?.toISOString() ?? null,
    };
  }

  /** «Остановить» и «Включить» кампании из кабинета: сначала Meta, потом статус в WETOP */
  async setCampaignStatus(
    campaignId: string,
    status: 'ACTIVE' | 'PAUSED',
  ): Promise<{ status: string }> {
    const scope = await this.scope();
    const c = await this.prisma.db.marketingCampaign.findFirst({
      where: {
        id: campaignId,
        locationId: scope.locationId,
        platform: 'META',
        externalId: { not: null },
      },
      select: { id: true, externalId: true, status: true },
    });
    if (!c) throw new NotFoundException('Кампания кабинета не найдена');
    if (c.status === 'FINISHED') throw new ConflictException('Кампания завершена');
    const conn = await this.prisma.db.marketingAdConnection.findFirst({
      where: { locationId: scope.locationId, platform: 'META', status: 'ACTIVE' },
      select: { tokenCiphertext: true },
    });
    if (!conn)
      throw new ConflictException('Кабинет Meta не подключён: подключите его на «Рекламе»');
    try {
      await this.writer(decryptPii(conn.tokenCiphertext)).setStatus(c.externalId!, status);
    } catch (e) {
      if (e instanceof meta.MetaApiError) throw new HttpException(e.message, 502);
      throw e;
    }
    await this.prisma.db.$transaction([
      this.prisma.db.marketingCampaign.update({ where: { id: c.id }, data: { status } }),
      this.prisma.db.auditLog.create({
        data: {
          userId: auditUserId(),
          entityType: 'marketing_campaign',
          entityId: c.id,
          action: status === 'PAUSED' ? 'marketing_campaign.paused' : 'marketing_campaign.resumed',
          before: { status: c.status },
          after: { status },
        },
      }),
    ]);
    return { status };
  }
}

const creativeUpload = () =>
  FileInterceptor('file', {
    limits: { fileSize: AD_VIDEO_MAX_BYTES, files: 1, fields: 2, parts: 4 },
  });

/** Запуск тратит деньги: своё право (§57); смотреть запуски можно с правом раздела */
@Controller('marketing/ads')
export class MarketingAdLaunchController {
  constructor(@Inject(AdLaunchService) private readonly launches: AdLaunchService) {}

  @Access('ads_launch')
  @Post('creatives')
  @UseInterceptors(creativeUpload())
  upload(@UploadedFile() file: { buffer?: Buffer; originalname?: string } | undefined) {
    return this.launches.uploadCreative(file);
  }

  @Access('ads_launch')
  @Post('launches')
  @HttpCode(202)
  start(@Body() body: unknown) {
    return this.launches.start(body);
  }

  @Access('ads_launch')
  @Get('assets')
  assets() {
    return this.launches.assets();
  }

  @Access('ads_launch')
  @Get('geo')
  geo(@Query('q') q: unknown, @Query('country') country: unknown) {
    return this.launches.geo(q, country);
  }

  @Access('marketing')
  @Get('library')
  library() {
    return this.launches.library();
  }

  @Access('ads_launch')
  @Get('launches/:id/audience')
  audience(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.launches.audienceOf(id);
  }

  @Access('marketing')
  @Get('launches')
  list() {
    return this.launches.list();
  }

  @Access('marketing')
  @Get('launches/:id')
  view(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.launches.view(id);
  }

  @Access('ads_launch')
  @Post('campaigns/:id/pause')
  @HttpCode(200)
  pause(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.launches.setCampaignStatus(id, 'PAUSED');
  }

  @Access('ads_launch')
  @Post('campaigns/:id/resume')
  @HttpCode(200)
  resume(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.launches.setCampaignStatus(id, 'ACTIVE');
  }
}
