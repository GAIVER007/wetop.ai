import 'reflect-metadata';
import { Body, Controller, Get, Headers, HttpCode, Inject, Post, Query } from '@nestjs/common';
import { InboundBookingsService } from './inbound.service';
import { OutboxWorker } from './outbox.worker';
import { PROVIDER } from './ari-publisher';
import { ChannexSyncService } from './sync.service';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from './channels.repository';

/** Channex: настройка объекта на staging и полная выгрузка ARI. Только localhost (роли — Q-061…064). */
@Controller('channels/channex')
export class ChannelsController {
  constructor(
    @Inject(ChannexSyncService) private readonly sync: ChannexSyncService,
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
    @Inject(InboundBookingsService) private readonly inbound: InboundBookingsService,
    @Inject(OutboxWorker) private readonly outbox: OutboxWorker,
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
  fullSync(@Query('days') days?: string) {
    return this.sync.fullSync(days ? Number(days) : undefined);
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

  /** Забрать все неподтверждённые ревизии из ленты и обработать (для sandbox без публичного URL). */
  @Post('pull')
  @HttpCode(200)
  pull(@Query('propertyId') propertyId?: string) {
    return this.inbound.pull(propertyId || undefined);
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
