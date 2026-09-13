import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InboundBookingsService } from './inbound.service';
import { OutboxWorker } from './outbox.worker';
import { PROVIDER } from './ari-publisher';
import { ChannexSyncService } from './sync.service';
import { reachabilityForRegistered } from './schedule';
import { WebhookHealthService } from './webhook-health.service';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from './channels.repository';

/** Channex: настройка объекта на staging и полная выгрузка ARI. Только localhost (роли — Q-061…064). */
@Controller('channels/channex')
export class ChannelsController {
  constructor(
    @Inject(ChannexSyncService) private readonly sync: ChannexSyncService,
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
    @Inject(InboundBookingsService) private readonly inbound: InboundBookingsService,
    @Inject(OutboxWorker) private readonly outbox: OutboxWorker,
    @Inject(WebhookHealthService) private readonly health: WebhookHealthService,
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

  /** Webhook Channex: секрет в заголовке X-Channex-Webhook-Secret (webhook-collection.md → Security). */
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
    // Регистрация в Channex + сторож: когда webhook доставлял последний раз и не под подозрением ли он
    const status = await this.sync.webhookStatus();
    const health = this.health.snapshot();
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

  /** Журнал входящих событий: что прислал Channex и обработали ли мы это (ADR-007). */
  @Get('events')
  events(@Query('limit') limit?: string) {
    const n = Number(limit ?? 30);
    return this.repo.recentEvents(PROVIDER, Number.isInteger(n) && n > 0 && n <= 200 ? n : 30);
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
  outboxStatus() {
    return this.repo.outboxSummary(PROVIDER);
  }

  /** Отправить накопившееся сейчас (без ожидания фонового цикла). */
  @Post('outbox/flush')
  @HttpCode(200)
  flush() {
    return this.outbox.flush(true);
  }
}
