import 'reflect-metadata';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { channex } from '@pms/integrations';
import { gatewayFailure } from './gateway-failure';
import { categoryAvailability } from '@pms/domain';
import { buildAvailabilityValues, buildRestrictionValues, lastPricedDate } from './ari';
import { buildChannexSetup } from './setup-plan';
import { DEFAULT_FULL_SYNC_HOUR, isFullSyncDue } from './schedule';
import { ARI_STOPPED_MESSAGE, isAriStopped } from './ari-switch';
import {
  CHANNELS_REPOSITORY,
  CHANNEX_GATEWAY,
  type ChannelsRepository,
  type ChannexGateway,
} from './channels.repository';

export const PROVIDER = 'channex';
/** Тариф, который продаётся в OTA (plans/slice-4-channex.md, умолчание): «Тариф для ОТА +35%» */
export const DEFAULT_OTA_RATE_PLAN_CODE = 'rate-ota';
/*
 * Глубина полной выгрузки. 500 суток — требование сертификации Channex («Full sync means you should send
 * 500 days of Availability, rates and restrictions», pms-certification-tests.md §1), и оно же разумно для
 * продажи: канал не продаст дальше, чем мы отдали остатки. Цены сейчас заведены на 361 день вперёд
 * Если цены за границей календаря отсутствуют, уходят только остатки — так и указано в форме.
 */
const DEFAULT_SYNC_DAYS = 500;
/** Входящий endpoint PMS (channels.controller) — Channex шлёт сюда POST с нашим секретом в заголовке */
export const WEBHOOK_PATH = '/channels/channex/webhook';
const WEBHOOK_EVENTS = 'booking';
const SECRET_HEADER = 'x-channex-webhook-secret';
const webhookProperty = (w: channex.ChannexResource<channex.ChannexWebhookAttributes>) => {
  const d = w.relationships?.['property']?.data;
  return d && !Array.isArray(d) ? d.id : null;
};

export interface SetupResult {
  providerPropertyId: string;
  created: { property: boolean; roomTypes: number; ratePlans: number };
  roomTypes: Array<{
    categoryCode: string;
    providerRoomTypeId: string;
    providerRatePlanId: string;
  }>;
}
export interface WebhookStatus {
  registered: boolean;
  id: string | null;
  callbackUrl: string | null;
  eventMask: string | null;
  active: boolean;
  sendData: boolean;
  /** Адрес, который PMS зарегистрирует: PUBLIC_API_URL + путь webhook; null — PUBLIC_API_URL не задан */
  expectedUrl: string | null;
  secretConfigured: boolean;
}
export interface WebhookRegisterResult {
  id: string;
  callbackUrl: string;
  created: boolean;
  eventMask: string;
  active: boolean;
}
export interface WebhookTestResult {
  callbackUrl: string;
  statusCode: number;
  body: string;
  verdict: string;
}
export interface SyncResult {
  from: string;
  to: string;
  availabilityValues: number;
  restrictionValues: number;
  tasks: string[];
  warnings: unknown[];
}

const plusDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

async function viaChannex<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof channex.ChannexApiError) throw gatewayFailure(e);
    throw e;
  }
}

export type SyncTrigger = 'manual' | 'scheduled' | 'import';
export interface ScheduledSyncResult {
  ran: boolean;
  reason: string;
  lastRunAt: string | null;
  hourLocal: number;
  result?: SyncResult;
}
/** Как часто проверяем, не пора ли делать полную выгрузку (сама выгрузка — раз в сутки) */
const SCHEDULE_CHECK_MS = 10 * 60_000;

@Injectable()
export class ChannexSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ChannexSyncService.name);
  private scheduleTimer: NodeJS.Timeout | null = null;
  private syncing = false;
  constructor(
    @Inject(CHANNEX_GATEWAY) private readonly gateway: ChannexGateway,
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
  ) {}

  /** Расписание только в живом процессе с ключом; в тестах и при CHANNEX_FULL_SYNC=off — выключено. */
  onModuleInit(): void {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.CHANNEX_FULL_SYNC === 'off' ||
      !process.env.CHANNEX_API_KEY?.trim()
    )
      return;
    this.scheduleTimer = setInterval(
      () =>
        void this.runScheduledFullSyncIfDue().catch((e: unknown) =>
          this.log.warn(`полная выгрузка по расписанию не удалась: ${(e as Error).message}`),
        ),
      SCHEDULE_CHECK_MS,
    );
    this.scheduleTimer.unref();
  }
  onModuleDestroy(): void {
    if (this.scheduleTimer) clearInterval(this.scheduleTimer);
  }

  /**
   * Полная выгрузка раз в сутки после CHANNEX_FULL_SYNC_HOUR (по умолчанию 03:00 Алматы), если сегодня её ещё
   * не было (по журналу аудита `channex.fullSync` — ручной прогон тоже считается). Нужна, потому что дельты
   * уходят только по событиям PMS, а фоновая задача и правки в базе остатки в канале не обновляют.
   */
  async runScheduledFullSyncIfDue(now = new Date(), force = false): Promise<ScheduledSyncResult> {
    const raw = Number(process.env.CHANNEX_FULL_SYNC_HOUR ?? DEFAULT_FULL_SYNC_HOUR);
    const hourLocal = Number.isInteger(raw) && raw >= 0 && raw <= 23 ? raw : DEFAULT_FULL_SYNC_HOUR;
    const lastRunAt = await this.repo.lastAuditAt('channex.fullSync');
    const base = { lastRunAt: lastRunAt?.toISOString() ?? null, hourLocal };
    if (isAriStopped())
      return {
        ran: false,
        reason: 'исходящий ARI остановлен (CHANNEX_ARI=off, план отката)',
        ...base,
      };
    if (!force && !isFullSyncDue({ lastRunAt, now, hourLocal }))
      return {
        ran: false,
        reason: lastRunAt
          ? 'сегодня полная выгрузка уже была'
          : `час выгрузки (${hourLocal}:00 Алматы) ещё не наступил`,
        ...base,
      };
    if (this.syncing) return { ran: false, reason: 'полная выгрузка уже идёт', ...base };
    this.syncing = true;
    try {
      const result = await this.fullSync(undefined, force ? 'manual' : 'scheduled');
      this.log.log(
        `полная выгрузка ${force ? 'вручную' : 'по расписанию'}: остатков ${result.availabilityValues}, ограничений ${result.restrictionValues}, задачи ${result.tasks.join(', ')}`,
      );
      return { ran: true, reason: force ? 'принудительно' : 'по расписанию', result, ...base };
    } finally {
      this.syncing = false;
    }
  }

  /** Создать в Channex объект, категории и тарифы, которых ещё нет в маппинге. Повтор ничего не дублирует. */
  async setup(ratePlanCode = DEFAULT_OTA_RATE_PLAN_CODE): Promise<SetupResult> {
    const local = await this.repo.localSetup(ratePlanCode);
    if (!local.ratePlan)
      throw new UnprocessableEntityException(
        `Тариф ${ratePlanCode} не найден — сначала импорт тарифов`,
      );
    const ratePlan = local.ratePlan;
    const plan = buildChannexSetup({
      property: local.property,
      categories: local.categories,
      ratePlan,
    });
    const existing = await this.repo.mappings(PROVIDER);
    const created = { property: false, roomTypes: 0, ratePlans: 0 };
    let providerPropertyId =
      existing.find((m) => m.providerRoomTypeId === null)?.providerPropertyId ?? null;
    if (!providerPropertyId) {
      const p = await viaChannex(() => this.gateway.createProperty(plan.property));
      providerPropertyId = p.id;
      await this.repo.savePropertyMapping(local.property.id, PROVIDER, providerPropertyId);
      created.property = true;
    }
    const roomTypes: SetupResult['roomTypes'] = [];
    for (const rt of plan.roomTypes) {
      const have = existing.find(
        (m) =>
          m.localAccommodationTypeId === rt.localCategoryId &&
          m.localRatePlanId === ratePlan.id &&
          m.providerRatePlanId,
      );
      if (have) {
        roomTypes.push({
          categoryCode: rt.localCategoryCode,
          providerRoomTypeId: have.providerRoomTypeId!,
          providerRatePlanId: have.providerRatePlanId!,
        });
        continue;
      }
      const sameType = existing.find(
        (m) => m.localAccommodationTypeId === rt.localCategoryId && m.providerRoomTypeId,
      );
      let providerRoomTypeId = sameType?.providerRoomTypeId ?? null;
      if (!providerRoomTypeId) {
        const r = await viaChannex(() =>
          this.gateway.createRoomType({ property_id: providerPropertyId!, ...rt.attrs }),
        );
        providerRoomTypeId = r.id;
        created.roomTypes += 1;
      }
      const rpPlan = plan.ratePlans.find((x) => x.localCategoryId === rt.localCategoryId)!;
      const rp = await viaChannex(() =>
        this.gateway.createRatePlan({
          property_id: providerPropertyId!,
          room_type_id: providerRoomTypeId!,
          ...rpPlan.attrs,
        }),
      );
      created.ratePlans += 1;
      await this.repo.saveRatePlanMapping({
        propertyId: local.property.id,
        provider: PROVIDER,
        localAccommodationTypeId: rt.localCategoryId,
        localRatePlanId: ratePlan.id,
        providerPropertyId,
        providerRoomTypeId,
        providerRatePlanId: rp.id,
      });
      roomTypes.push({
        categoryCode: rt.localCategoryCode,
        providerRoomTypeId,
        providerRatePlanId: rp.id,
      });
    }
    const result = { providerPropertyId, created, roomTypes };
    await this.repo.audit('channex.setup', result);
    return result;
  }

  /** Полная выгрузка ARI на N дней вперёд: 1 вызов доступности + 1 вызов цен/ограничений (ari.md, rate-limits.md). */
  private async providerPropertyId(): Promise<string> {
    const m = (await this.repo.mappings(PROVIDER)).find((x) => x.providerPropertyId);
    if (!m)
      throw new UnprocessableEntityException(
        'Объект в менеджере каналов не создан — сначала POST /channels/channex/setup',
      );
    return m.providerPropertyId;
  }
  private expectedCallbackUrl(override?: string): string | null {
    const base = override?.trim() || process.env.PUBLIC_API_URL?.trim();
    if (!base) return null;
    return override?.trim() ? base : `${base.replace(/\/+$/, '')}${WEBHOOK_PATH}`;
  }
  private webhookInput(callbackUrl?: string) {
    const secret = process.env.CHANNEX_WEBHOOK_SECRET?.trim();
    if (!secret)
      throw new ServiceUnavailableException(
        'CHANNEX_WEBHOOK_SECRET не задан в .env — вписывает владелец (SECURITY.md §3)',
      );
    const url = this.expectedCallbackUrl(callbackUrl);
    if (!url)
      throw new BadRequestException(
        'Нет публичного адреса API: задайте PUBLIC_API_URL=https://… в .env или передайте callbackUrl',
      );
    if (!/^https:\/\/[^\s/]+/.test(url))
      throw new BadRequestException(
        `callback_url должен начинаться с https:// (webhook-collection.md → Security): ${url}`,
      );
    return { url, secret };
  }

  /** Что зарегистрировано в Channex для нашего объекта (секрет наружу не отдаётся). */
  async webhookStatus(): Promise<WebhookStatus> {
    const expectedUrl = this.expectedCallbackUrl();
    const secretConfigured = !!process.env.CHANNEX_WEBHOOK_SECRET?.trim();
    const none: WebhookStatus = {
      registered: false,
      id: null,
      callbackUrl: null,
      eventMask: null,
      active: false,
      sendData: false,
      expectedUrl,
      secretConfigured,
    };
    const m = (await this.repo.mappings(PROVIDER)).find((x) => x.providerPropertyId);
    if (!m) return none;
    const own = (await viaChannex(() => this.gateway.listWebhooks())).filter(
      (w) => webhookProperty(w) === m.providerPropertyId,
    );
    const w = own[0];
    if (!w) return none;
    return {
      ...none,
      registered: true,
      id: w.id,
      callbackUrl: w.attributes.callback_url,
      eventMask: w.attributes.event_mask,
      active: w.attributes.is_active,
      sendData: w.attributes.send_data,
    };
  }

  /**
   * Зарегистрировать (или обновить) webhook нашего объекта: события booking, секрет в заголовке
   * X-Channex-Webhook-Secret, send_data = true (нужен payload.revision_id). Один webhook на объект — повтор обновляет.
   */
  async registerWebhook(callbackUrl?: string): Promise<WebhookRegisterResult> {
    // Д1: постоянный адрес задан — регистрация на другой (быстрый туннель, опечатка) увела бы события Channex
    const permanent = this.expectedCallbackUrl();
    const asked = callbackUrl?.trim();
    if (permanent && asked && asked !== permanent)
      throw new ConflictException(
        `Задан постоянный адрес PMS (PUBLIC_API_URL → ${permanent}): webhook регистрируется только на него, не на ${asked}`,
      );
    const { url, secret } = this.webhookInput(callbackUrl);
    const propertyId = await this.providerPropertyId();
    const input: channex.ChannexWebhookInput = {
      callback_url: url,
      event_mask: WEBHOOK_EVENTS,
      property_id: propertyId,
      headers: { [SECRET_HEADER]: secret },
      is_active: true,
      send_data: true,
      is_global: false,
    };
    const existing = (await viaChannex(() => this.gateway.listWebhooks())).find(
      (w) => webhookProperty(w) === propertyId,
    );
    const saved = existing
      ? await viaChannex(() => this.gateway.updateWebhook(existing.id, input))
      : await viaChannex(() => this.gateway.createWebhook(input));
    // Успех считаем по ответу Channex, а не по тому, что отправили: 15.09.2026 PUT ответил 200, адрес не поменял,
    // и кнопка отрапортовала перерегистрацию, пока webhook оставался на мёртвом туннеле.
    const savedUrl = saved.attributes.callback_url;
    if (savedUrl !== url)
      throw new BadGatewayException(
        `Менеджер каналов оставил адрес webhook ${savedUrl} вместо ${url} — webhook не перерегистрирован`,
      );
    await this.repo.audit('channels.webhook.register', {
      webhookId: saved.id,
      callbackUrl: savedUrl,
      eventMask: WEBHOOK_EVENTS,
      created: !existing,
    });
    return {
      id: saved.id,
      callbackUrl: savedUrl,
      created: !existing,
      eventMask: saved.attributes.event_mask,
      active: saved.attributes.is_active,
    };
  }

  /** Channex шлёт пробный POST на наш адрес с нашими заголовками и возвращает ответ endpoint'а. */
  async testWebhook(callbackUrl?: string): Promise<WebhookTestResult> {
    // Пробный запрос несёт заголовок секрета: при постоянном адресе — только на него, как регистрация (Д1).
    // Иначе любой вошедший уведёт секрет на свой сервер (SECURITY.md §11, проверка 24.09.2026)
    const permanent = this.expectedCallbackUrl();
    const asked = callbackUrl?.trim();
    if (permanent && asked && asked !== permanent)
      throw new ConflictException(
        `Задан постоянный адрес PMS (PUBLIC_API_URL → ${permanent}): проверка webhook идёт только на него, не на ${asked}`,
      );
    const { url, secret } = this.webhookInput(callbackUrl);
    const propertyId = await this.providerPropertyId();
    const t = await viaChannex(() =>
      this.gateway.testWebhook({
        callback_url: url,
        event_mask: WEBHOOK_EVENTS,
        property_id: propertyId,
        headers: { [SECRET_HEADER]: secret },
        send_data: true,
      }),
    );
    const verdict =
      t.status_code === 200 || t.status_code === 400
        ? 'endpoint доступен, секрет принят'
        : t.status_code === 401
          ? 'endpoint доступен, но секрет не совпал — сверьте CHANNEX_WEBHOOK_SECRET'
          : t.status_code === 503
            ? 'endpoint доступен, но на стороне PMS секрет не задан'
            : `endpoint недоступен или ответил ${t.status_code}`;
    return { callbackUrl: url, statusCode: t.status_code, body: t.body.slice(0, 500), verdict };
  }

  async fullSync(days = DEFAULT_SYNC_DAYS, trigger: SyncTrigger = 'manual'): Promise<SyncResult> {
    if (isAriStopped()) throw new ServiceUnavailableException(ARI_STOPPED_MESSAGE);
    if (!Number.isInteger(days) || days < 1 || days > 730)
      throw new UnprocessableEntityException('days — целое от 1 до 730');
    const mappings = (await this.repo.mappings(PROVIDER)).filter(
      (m) =>
        m.providerRoomTypeId &&
        m.providerRatePlanId &&
        m.localAccommodationTypeCode &&
        m.localRatePlanId,
    );
    if (mappings.length === 0)
      throw new UnprocessableEntityException(
        'Сопоставление с менеджером каналов пустое — сначала POST /channels/channex/setup',
      );
    const providerPropertyId = mappings[0]!.providerPropertyId;
    const local = await this.repo.localSetup(DEFAULT_OTA_RATE_PLAN_CODE);
    const today = await this.repo.today();
    const from = today;
    const to = plusDays(today, days - 1);
    // Доступность для канала: единицы − блокировки − проданные проживания (DATA_MODEL §7)
    const toExclusive = plusDays(to, 1);
    const [units, blocks, items] = await Promise.all([
      this.repo.categoryUnits(),
      this.repo.categoryBlocks(from, toExclusive),
      this.repo.soldItems(from, toExclusive),
    ]);
    const free = categoryAvailability({ from, to, units, blocks, items });
    const roomTypes = [
      ...new Map(
        mappings.map((m) => [
          m.providerRoomTypeId!,
          {
            localCategoryCode: m.localAccommodationTypeCode!,
            providerRoomTypeId: m.providerRoomTypeId!,
          },
        ]),
      ).values(),
    ];
    const availability = buildAvailabilityValues({
      propertyId: providerPropertyId,
      from,
      to,
      roomTypes,
      free,
    });
    const ratePlanIds = [...new Set(mappings.map((m) => m.localRatePlanId!))];
    const [dailyRates, restrictions] = await Promise.all([
      this.repo.dailyRates(ratePlanIds, from, to),
      this.repo.restrictions(ratePlanIds, from, to),
    ]);
    const occupancyByCategory = Object.fromEntries(
      local.categories.map((c) => [c.code, c.capacityAdults]),
    );
    // Channex Full Sync (сертификация §1): 500 дней И доступности, И цен/ограничений с ОДНОЙ границей дат.
    // Ограничения выгружаем на весь период, как доступность. Дни за последней ценой buildRestrictionValues
    // закрывает stop_sell с перенесённой ценой — конец окна совпадает с доступностью и в каждом объекте есть
    // `rate` (раньше окно обрезалось по последней цене, и концы не совпадали — Channex завернул).
    const lastPriced = lastPricedDate(dailyRates, occupancyByCategory);
    const restrictionValues = buildRestrictionValues({
      propertyId: providerPropertyId,
      from,
      to,
      ratePlans: mappings.map((m) => ({
        localCategoryCode: m.localAccommodationTypeCode!,
        localRatePlanId: m.localRatePlanId!,
        providerRatePlanId: m.providerRatePlanId!,
      })),
      dailyRates,
      restrictions,
      occupancyByCategory,
    });
    const a = await viaChannex(() => this.gateway.updateAvailability(availability));
    const r = await viaChannex(() => this.gateway.updateRestrictions(restrictionValues));
    const result: SyncResult = {
      from,
      to,
      availabilityValues: availability.length,
      restrictionValues: restrictionValues.length,
      tasks: [...a.data, ...r.data].map((t) => t.id),
      warnings: [
        ...(a.meta?.warnings ?? []),
        ...(r.meta?.warnings ?? []),
        ...(lastPriced && lastPriced < to
          ? [
              `Цены заведены по ${lastPriced}; дни ${plusDays(lastPriced, 1)}…${to} выгружены закрытыми (stop_sell) с перенесённой ценой — продлите календарь цен, чтобы открыть их`,
            ]
          : []),
      ],
    };
    await this.repo.audit('channex.fullSync', { ...result, trigger });
    return result;
  }
}
