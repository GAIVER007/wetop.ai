import 'reflect-metadata';
import { UseGuards } from '@nestjs/common';
import { IntegrationOwnerGuard } from './integration-owner';
import {
  BadRequestException,
  Body,
  Controller,
  GatewayTimeoutException,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ChannelOperatorInterceptor } from './operator-access';
import { InboundBookingsService } from './inbound.service';
import { OutboxWorker } from './outbox.worker';
import { ARI_PUBLISHER, PROVIDER, type AriPublisher } from './ari-publisher';

/** Статусы входящего события в базе (`ExternalEventStatus`): другого значения Prisma не примет */
const EVENT_STATUSES = ['RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED'] as const;
import { ChannexSyncService } from './sync.service';
import { reachabilityForRegistered } from './schedule';
import { WebhookHealthService } from './webhook-health.service';
import {
  CHANNELS_REPOSITORY,
  type ChannelsRepository,
  type OutboxStatus,
} from './channels.repository';
import { Public } from '../auth/public.decorator';
import { isAriStopped } from './ari-switch';
import { outboxRowSummary } from './outbox-rows';
import { revisionFacts } from './revision-facts';
import { Access } from '../auth/access.decorator';

/** Ответ или отказ за отведённое время: запрос к провайдеру идёт дальше, но страница его не ждёт */
function within<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new GatewayTimeoutException(message)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Channex: настройка объекта на staging и полная выгрузка ARI. Только localhost (роли — Q-061…064). */
@Access('channels')
@UseGuards(IntegrationOwnerGuard)
@Controller('channels/channex')
// только организация подключённого объекта и главный администратор (аудит 26.09, В-2 и С-3; ADR-095)
@UseInterceptors(ChannelOperatorInterceptor)
export class ChannelsController {
  constructor(
    @Inject(ChannexSyncService) private readonly sync: ChannexSyncService,
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
    @Inject(InboundBookingsService) private readonly inbound: InboundBookingsService,
    @Inject(OutboxWorker) private readonly outbox: OutboxWorker,
    @Inject(WebhookHealthService) private readonly health: WebhookHealthService,
    @Inject(ARI_PUBLISHER) private readonly publisher: AriPublisher,
  ) {}

  @Get('mapping')
  mapping() {
    return this.repo.mappings(PROVIDER);
  }

  @Post('setup')
  @HttpCode(200)
  setup(@Query('ratePlanCode') ratePlanCode?: string) {
    return this.sync.setup(ratePlanCode || undefined);
  }

  @Post('sync')
  @HttpCode(200)
  fullSync(@Query('days') days?: string, @Query('trigger') trigger?: string) {
    return this.sync.fullSync(
      days ? Number(days) : undefined,
      trigger === 'import' ? 'import' : 'manual',
    );
  }

  /** Полная выгрузка по расписанию (раз в сутки после CHANNEX_FULL_SYNC_HOUR); ?force=1 — прямо сейчас. */
  @Post('sync/scheduled')
  @HttpCode(200)
  scheduledSync(@Query('force') force?: string) {
    return this.sync.runScheduledFullSyncIfDue(new Date(), force === '1' || force === 'true');
  }

  /**
   * Остатки изменились мимо команд PMS — автосинхронизация из внешней системы (ADR-032). Пересчитать доступность
   * названных категорий на ночах [from, toExclusive) и поставить дельтой в очередь, как для брони со стойки.
   * Полная выгрузка по такому событию не делается (сертификация Channex, п. 13: только дельты).
   */
  @Post('availability/changed')
  @HttpCode(200)
  async availabilityChanged(@Body() body: Record<string, unknown> | undefined) {
    const { categoryCodes, from, toExclusive } = body ?? {};
    const isDate = (v: unknown): v is string =>
      typeof v === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
    if (
      !Array.isArray(categoryCodes) ||
      categoryCodes.length === 0 ||
      categoryCodes.length > 50 ||
      !categoryCodes.every((c) => typeof c === 'string' && c.length > 0 && c.length <= 64)
    )
      throw new BadRequestException('categoryCodes: непустой список кодов категорий');
    if (!isDate(from) || !isDate(toExclusive) || toExclusive <= from)
      throw new BadRequestException('from и toExclusive: даты YYYY-MM-DD, from раньше toExclusive');
    if ((Date.parse(toExclusive) - Date.parse(from)) / 86_400_000 > 500)
      throw new BadRequestException('окно не больше 500 суток — глубины полной выгрузки');
    await this.publisher.reservationChanged({ categoryCodes, from, toExclusive });
    return { accepted: true };
  }

  /** Webhook Channex: секрет в заголовке X-Channex-Webhook-Secret (webhook-collection.md → Security). */
  @Public() // Channex приходит снаружи со своим секретом в заголовке, сессии у него нет
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Headers('x-channex-webhook-secret') secret: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.inbound.handleWebhook(secret, body ?? {});
  }

  /** Webhook в Channex: что зарегистрировано; регистрация/обновление; пробный вызов (webhook-collection.md). */
  @Get('webhook/status')
  async webhookStatus() {
    // Регистрация в Channex + сторож: когда webhook доставлял последний раз и не под подозрением ли он.
    // Клиент Channex повторяет запросы и ждёт до минуты на 429 — экран диагностики столько не ждёт (504)
    const status = await within(
      this.sync.webhookStatus(),
      Number(process.env.CHANNEX_STATUS_TIMEOUT_MS ?? 10_000),
      'Менеджер каналов не ответил на запрос webhook вовремя — повторите проверку позже',
    );
    const health = this.health.snapshot(await this.repo.currentPropertyId());
    return {
      ...status,
      ...health,
      // проба могла застать прежний адрес туннеля — тогда о текущем она ничего не говорит
      callbackReachable: reachabilityForRegistered({
        registeredUrl: status.callbackUrl,
        probedUrl: health.callbackProbedUrl,
        reachable: health.callbackReachable,
      }),
    };
  }

  @Post('webhook/register')
  @HttpCode(200)
  registerWebhook(@Body() body: { callbackUrl?: string } | undefined) {
    return this.sync.registerWebhook(body?.callbackUrl);
  }

  @Post('webhook/test')
  @HttpCode(200)
  testWebhook(@Body() body: { callbackUrl?: string } | undefined) {
    return this.sync.testWebhook(body?.callbackUrl);
  }

  /** Забрать все неподтверждённые ревизии из ленты и обработать (для sandbox без публичного URL). */
  @Post('pull')
  @HttpCode(200)
  pull(@Query('propertyId') propertyId?: string) {
    return this.inbound.pull(propertyId || undefined);
  }

  /**
   * Журнал входящих событий: что прислал Channex и обработали ли мы это (ADR-007). Срез 7.2: фильтры
   * по статусу и типу, поиск по номеру брони или unique_id, постраничность (offset), бронь у события.
   */
  @Get('events')
  async events(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('q') q?: string,
  ) {
    const n = Number(limit ?? 30);
    const o = Number(offset ?? 0);
    // Неизвестный статус Prisma отвергает исключением, и вся таблица событий уходит в «не загрузились»
    const st = (status ?? '').trim();
    return this.repo.eventsPage(PROVIDER, {
      limit: Number.isInteger(n) && n > 0 && n <= 200 ? n : 30,
      offset: Number.isInteger(o) && o >= 0 ? o : 0,
      status: EVENT_STATUSES.includes(st as (typeof EVENT_STATUSES)[number]) ? st : undefined,
      type: type?.trim() || undefined,
      q: q?.trim() || undefined,
    });
  }

  /** Страница «Приём брони из канала» (срез 7.2): ревизия без ПД → бронь → ячейки; только чтение. */
  @Get('events/:revisionId')
  async event(@Param('revisionId') revisionId: string) {
    const ev = await this.repo.eventByRevision(PROVIDER, revisionId);
    if (!ev) throw new NotFoundException(`Событие ${revisionId} не найдено`);
    const facts = revisionFacts(ev.payload);
    const row = Object.fromEntries(Object.entries(ev).filter(([k]) => k !== 'payload'));
    const linked = facts.uniqueId
      ? await this.repo.reservationCardByExternalId(facts.uniqueId)
      : null;
    const mappings = await this.repo.mappings(PROVIDER);
    const categoryByRoomType = Object.fromEntries(
      mappings
        .filter((m) => m.providerRoomTypeId && m.localAccommodationTypeCode)
        .map((m) => [m.providerRoomTypeId!, m.localAccommodationTypeCode!]),
    );
    return {
      event: row,
      facts,
      categoryByRoomType,
      reservation: linked?.card ?? null,
      balances: linked?.balances ?? {},
    };
  }

  /** Строки очереди ARI для журнала интеграции (срез 7.2): что ушло, на какие даты, по каким категориям. */
  @Get('outbox/rows')
  async outboxRows(@Query('status') status?: string, @Query('limit') limit?: string) {
    const n = Number(limit ?? 50);
    const st = ['PENDING', 'SENT', 'FAILED'].includes(status ?? '')
      ? (status as OutboxStatus)
      : undefined;
    const [rows, mappings] = await Promise.all([
      this.repo.outboxRows(PROVIDER, {
        status: st,
        limit: Number.isInteger(n) && n > 0 && n <= 200 ? n : 50,
      }),
      this.repo.mappings(PROVIDER),
    ]);
    const names = {
      roomTypeById: new Map(
        mappings
          .filter((m) => m.providerRoomTypeId && m.localAccommodationTypeCode)
          .map((m) => [m.providerRoomTypeId!, m.localAccommodationTypeCode!]),
      ),
      ratePlanById: new Map(
        mappings
          .filter((m) => m.providerRatePlanId && m.localAccommodationTypeCode)
          .map((m) => [m.providerRatePlanId!, m.localAccommodationTypeCode!]),
      ),
    };
    return rows.map(({ payload, ...r }) => ({ ...r, ...outboxRowSummary(payload, names) }));
  }

  /**
   * Разобрать событие заново после потолка попыток. Без этой команды ревизия, которую PMS не смогла
   * разобрать шесть раз, оставалась бы необработанной до тех пор, пока Channex не пришлёт её снова.
   */
  @Post('events/:revisionId/retry')
  @HttpCode(200)
  retryEvent(@Param('revisionId') revisionId: string) {
    return this.inbound.retryEvent(revisionId);
  }

  /** Очередь исходящих изменений ARI: сколько ждёт, сколько ушло, последняя задача Channex. */
  @Get('outbox')
  async outboxStatus() {
    // Выключатель ARI спрашивается у самого запущенного процесса: на сервере переменную задаёт
    // compose, и «задано в файле» ещё не значит «процесс это видит» (урок 15.09 — рапорт без
    // проверки). scripts/ops/ari-server.sh читает именно это поле.
    return { ...(await this.repo.outboxSummary(PROVIDER)), ariStopped: isAriStopped() };
  }

  /**
   * Строки очереди: что именно уехало в Channex и чем кончилось. Плитки над таблицей отвечают
   * «сколько», эта таблица — «что» (срез 7.2, сцена показа сертификации).
   */
  @Get('outbox/messages')
  outboxMessages(@Query('limit') limit?: string) {
    const n = Number(limit ?? 20);
    return this.repo.recentOutbox(PROVIDER, Number.isInteger(n) && n > 0 && n <= 200 ? n : 20);
  }

  /** Отправить накопившееся сейчас (без ожидания фонового цикла). */
  @Post('outbox/flush')
  @HttpCode(200)
  flush() {
    return this.outbox.flush(true);
  }
}
