import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Optional,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { channex } from '@pms/integrations';
import { Access } from '../auth/access.decorator';
import { CHANNELS_REPOSITORY, type MappingRow } from './channels.repository';
import { PROVIDER } from './ari-publisher';
import { IntegrationOwnerGuard } from './integration-owner';
import { ChannelOperatorInterceptor } from './operator-access';

/**
 * Раздел «Каналы» модуля «Каналы продаж» (ADR-138, план plans/channels-catalog-2026-10-03.md): подключения объекта к
 * каналам и все доступные каналы — из Channel API Channex (только чтение); брони за 30 дней и активность — из нашей
 * базы. Подключение, сопоставление и включение канала делаются в окне Channex (одноразовый токен, только владелец):
 * у каждого из десятков каналов свои шаги, и Channex их уже сделал. Ничего в Channex отсюда не пишется.
 */

export const CHANNEL_CATALOG_READER = Symbol('CHANNEL_CATALOG_READER');
/** Часы раздела — подменяются только в тестах */
export const CHANNEL_CATALOG_CLOCK = Symbol('CHANNEL_CATALOG_CLOCK');
export type CatalogReader = Pick<
  channex.ChannexClient,
  'listChannelAdapters' | 'listChannels' | 'createOneTimeToken'
> &
  Partial<Pick<channex.ChannexClient, 'listChannelCodes'>>;

export function catalogReaderFromEnv(): CatalogReader | null {
  const apiKey = process.env.CHANNEX_API_KEY?.trim();
  if (!apiKey) return null;
  return new channex.ChannexClient({
    apiKey,
    baseUrl: channexBase(),
    allowProduction: channex.channexProductionAllowed(),
    maxRetries: 1,
    timeoutMs: 8000,
  });
}
const channexBase = () => process.env.CHANNEX_API_BASE_URL?.trim() || channex.CHANNEX_STAGING_URL;

/** Что из нашей базы нужно разделу: брони и входящие события за окно (по объекту вошедшего) */
export interface ChannelActivity {
  /** `at` — когда бронь сделана: `booked_at` канала, иначе `created_at` у нас; без отменённых и незаездов */
  reservations: Array<{ source: string; channel: string | null; at: string }>;
  events: Array<{
    uniqueId: string | null;
    otaName: string | null;
    status: string;
    receivedAt: string;
  }>;
}
export interface ChannelActivityRepository {
  mappings(provider: string): Promise<Pick<MappingRow, 'providerPropertyId'>[]>;
  channelActivity(provider: string, since: Date): Promise<ChannelActivity>;
}

/**
 * Статус канала (решение по Q-253, дополнение к ADR-112): «Работает» — только по фактам. Channex знает лишь
 * «включён», поэтому «Работает» = включён + от канала за 30 дней приходило событие (бронь, изменение, отмена) +
 * за 7 дней нет входящих с ошибкой. Включён без событий — «Включён»; ошибки входящих — «Ошибки броней».
 */
export type ChannelStatus = 'WORKING' | 'ENABLED' | 'ERRORS' | 'OFF' | 'REMOVING';
export function channelStatus(
  c: {
    active: boolean;
    removalDate: string | null;
    lastEventAt: string | null;
    failedEvents7d: number;
  },
  now: Date,
): ChannelStatus {
  if (!c.active) return c.removalDate ? 'REMOVING' : 'OFF';
  if (c.failedEvents7d > 0) return 'ERRORS';
  const recent = c.lastEventAt && now.getTime() - Date.parse(c.lastEventAt) <= 30 * DAY;
  return recent ? 'WORKING' : 'ENABLED';
}

const DAY = 86_400_000;
const CATALOG_TTL = 24 * 60 * 60 * 1000;
const latest = (a: string | null, b: string) => (a && a > b ? a : b);
const CHANNEL_CODE = /^[A-Z0-9]{2,5}$/;

type Outside = {
  key: string;
  source: string;
  label: string | null;
  bookings30: number;
  lastBookingAt: string | null;
};

@Injectable()
export class ChannelCatalogService {
  private catalog: {
    at: number;
    adapters: channex.ChannexChannelAdapter[];
    codes: Map<string, string>;
  } | null = null;

  constructor(
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelActivityRepository,
    @Inject(CHANNEL_CATALOG_READER) private readonly reader: CatalogReader | null,
    @Optional() @Inject(CHANNEL_CATALOG_CLOCK) private readonly clock?: () => Date,
  ) {}

  private now(): Date {
    return this.clock ? this.clock() : new Date();
  }

  private async adapters() {
    if (this.catalog && Date.now() - this.catalog.at < CATALOG_TTL) return this.catalog;
    const [adapters, codes] = await Promise.all([
      this.reader!.listChannelAdapters(),
      // коды нужны только окну Channex; без них окно открывается со всем списком
      this.reader!.listChannelCodes ? this.reader!.listChannelCodes().catch(() => []) : [],
    ]);
    const byKey = new Map<string, string>();
    for (const c of codes) {
      const key = channex.otaChannelKey(c.name);
      if (key && !byKey.has(key)) byKey.set(key, c.code);
    }
    this.catalog = { at: Date.now(), adapters, codes: byKey };
    return this.catalog;
  }

  private async propertyId(): Promise<string | null> {
    return (
      (await this.repo.mappings(PROVIDER)).find((m) => m.providerPropertyId)?.providerPropertyId ??
      null
    );
  }

  async list() {
    const now = this.now();
    const [propertyId, activity] = await Promise.all([
      this.propertyId(),
      this.repo.channelActivity(PROVIDER, new Date(now.getTime() - 30 * DAY)),
    ]);
    // Брони и события — по ключу канала, тем же, что у отчётов (оба написания Booking.com — один канал)
    const bookings = new Map<
      string,
      { count: number; last: string | null; source: string; label: string | null }
    >();
    for (const r of activity.reservations) {
      const key =
        r.source === 'OTA' && r.channel ? `OTA:${channex.otaChannelKey(r.channel)}` : r.source;
      const row = bookings.get(key) ?? {
        count: 0,
        last: null,
        source: r.source,
        label: r.source === 'OTA' && r.channel ? channex.otaChannelLabel(r.channel) : null,
      };
      row.count += 1;
      row.last = latest(row.last, r.at);
      bookings.set(key, row);
    }
    const events = new Map<string, { last: string | null; failed7d: number }>();
    for (const e of activity.events) {
      if (!e.uniqueId && !e.otaName) continue;
      const key = channex.channelKey(e.uniqueId ?? '', e.otaName ?? '');
      const row = events.get(key) ?? { last: null, failed7d: 0 };
      row.last = latest(row.last, e.receivedAt);
      if (e.status === 'FAILED' && now.getTime() - Date.parse(e.receivedAt) <= 7 * DAY)
        row.failed7d += 1;
      events.set(key, row);
    }
    const base = {
      checkedAt: now.toISOString(),
      environment: environmentOf(channexBase()),
      propertyConnected: !!propertyId,
    };
    const outsideOf = (connected: Set<string>): Outside[] =>
      [...bookings.entries()]
        .filter(([key]) => !connected.has(key))
        .map(([key, b]) => ({
          key,
          source: b.source,
          label: b.label,
          bookings30: b.count,
          lastBookingAt: b.last,
        }))
        .sort(
          (a, b) =>
            Number(b.source === 'OTA') - Number(a.source === 'OTA') ||
            b.bookings30 - a.bookings30 ||
            a.key.localeCompare(b.key),
        );
    const empty = (state: string, message: string) => ({
      ...base,
      state,
      message,
      connections: [],
      adapters: null,
      outside: outsideOf(new Set()),
    });
    if (!this.reader) return empty('NO_KEY', 'Не задан ключ менеджера каналов');
    if (!propertyId)
      return empty(
        'NO_MAPPING',
        'Объект ещё не создан в менеджере каналов — настройте подключение',
      );
    let raw: channex.ChannexResource<channex.ChannexChannelAttributes>[];
    let catalog: Awaited<ReturnType<ChannelCatalogService['adapters']>>;
    try {
      [raw, catalog] = await Promise.all([this.reader.listChannels(propertyId), this.adapters()]);
    } catch (error) {
      const status = error instanceof channex.ChannexApiError ? error.status : 0;
      return status === 401 || status === 403
        ? empty('DENIED', 'Ключ менеджера каналов не даёт доступа к каналам')
        : empty('UNREACHABLE', 'Менеджер каналов не ответил — показаны только брони из WETOP');
    }
    const byCode = new Map(catalog.adapters.map((a) => [a.code, a]));
    const connections = raw
      .map((r) => channex.toConnectionView(r, byCode))
      .map((c) => {
        const b = bookings.get(`OTA:${c.channelKey}`);
        const e = events.get(c.channelKey);
        const facts = {
          ...c,
          shortCode: catalog.codes.get(c.channelKey) ?? null,
          bookings30: b?.count ?? 0,
          lastBookingAt: b?.last ?? null,
          lastEventAt: e?.last ?? null,
          failedEvents7d: e?.failed7d ?? 0,
        };
        return { ...facts, status: channelStatus(facts, now) };
      })
      .sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          b.bookings30 - a.bookings30 ||
          a.channelTitle.localeCompare(b.channelTitle),
      );
    const connectedKeys = new Set(connections.map((c) => c.channelKey));
    const adapters = catalog.adapters
      .map((a) => ({
        ...channex.toAdapterView(a),
        shortCode: catalog.codes.get(channex.toAdapterView(a).channelKey) ?? null,
        connected: connections.some((c) => c.adapterCode === a.code),
      }))
      .sort((a, b) => Number(b.connected) - Number(a.connected) || a.title.localeCompare(b.title));
    return {
      ...base,
      state: 'READY',
      message: 'Каналы загружены из менеджера каналов',
      connections,
      adapters,
      outside: outsideOf(new Set([...connectedKeys].map((k) => `OTA:${k}`))),
    };
  }

  /** Окно Channex для подключения или настройки канала: одноразовый токен (15 минут) только на объект */
  async connectSession(input: { username: string; channel?: string }) {
    if (input.channel !== undefined && !CHANNEL_CODE.test(input.channel))
      throw new BadRequestException('Неизвестный код канала');
    if (!this.reader) throw new ConflictException('Не задан ключ менеджера каналов');
    const propertyId = await this.propertyId();
    if (!propertyId)
      throw new ConflictException(
        'Объект ещё не создан в менеджере каналов — сначала настройте подключение',
      );
    const token = await this.reader.createOneTimeToken({
      propertyId,
      username: input.username.slice(0, 80) || 'WETOP',
    });
    return {
      url: channex.channelIframeUrl(channexBase(), {
        token,
        propertyId,
        ...(input.channel ? { channelCode: input.channel } : {}),
      }),
      expiresInMinutes: 15,
    };
  }
}

function environmentOf(base: string) {
  try {
    const host = new URL(base).hostname;
    return host === 'staging.channex.io'
      ? 'staging'
      : channex.isChannexProduction(base)
        ? 'production'
        : 'custom';
  } catch {
    return 'custom';
  }
}

@Access('channels')
@UseGuards(IntegrationOwnerGuard)
@Controller('channels/channex')
@UseInterceptors(ChannelOperatorInterceptor)
export class ChannelCatalogController {
  constructor(@Inject(ChannelCatalogService) private readonly service: ChannelCatalogService) {}

  @Get('channels') list() {
    return this.service.list();
  }

  /** Окно Channex открывает только владелец: в нём подключают, включают и выключают каналы (ADR-112, ADR-138) */
  @Access('owner')
  @Post('channels/connect-session')
  @HttpCode(200)
  connectSession(
    @Body() body: { channel?: unknown } | undefined,
    @Req() req: { user?: { name?: string | null; email?: string | null } },
    @Query('channel') q?: string,
  ) {
    const raw = typeof body?.channel === 'string' ? body.channel : q;
    return this.service.connectSession({
      username: req.user?.name || req.user?.email || 'WETOP',
      ...(raw ? { channel: raw } : {}),
    });
  }
}
