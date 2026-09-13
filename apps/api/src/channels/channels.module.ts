import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { PrismaUnitOfWork, RESERVATIONS_UOW } from '../reservations/reservations.repository';
import { ARI_PUBLISHER, OutboxAriPublisher } from './ari-publisher';
import { InboundBookingsService } from './inbound.service';
import { OutboxWorker } from './outbox.worker';
import { WebhookHealthService } from './webhook-health.service';
import { ChannexSyncService } from './sync.service';
import { ChannelsController } from './channels.controller';
import {
  ChannelConnectionController,
  ChannelConnectionService,
  CHANNEL_CONNECTION_READER,
  connectionReaderFromEnv,
} from './connection';
import {
  ChannelContentController,
  ChannelContentService,
  CHANNEL_CONTENT_READER,
  contentReaderFromEnv,
} from './content';
import {
  CHANNELS_REPOSITORY,
  CHANNEX_GATEWAY,
  PrismaChannelsRepository,
  channexGatewayFromEnv,
} from './channels.repository';

@Module({
  controllers: [ChannelsController, ChannelConnectionController, ChannelContentController],
  providers: [
    PrismaService,
    ChannelConnectionService,
    { provide: CHANNEL_CONNECTION_READER, useFactory: connectionReaderFromEnv },
    // Контент объекта для WETOP из Channex, только чтение (ADR-033)
    ChannelContentService,
    { provide: CHANNEL_CONTENT_READER, useFactory: contentReaderFromEnv },
    ChannexSyncService,
    InboundBookingsService,
    { provide: RESERVATIONS_UOW, useClass: PrismaUnitOfWork },
    { provide: CHANNELS_REPOSITORY, useClass: PrismaChannelsRepository },
    { provide: CHANNEX_GATEWAY, useFactory: channexGatewayFromEnv },
    { provide: ARI_PUBLISHER, useClass: OutboxAriPublisher },
    OutboxWorker,
    WebhookHealthService,
  ],
  // Сторож системы (срез 11) чинит технику теми же путями, что кнопки на /channels
  exports: [
    ARI_PUBLISHER,
    CHANNELS_REPOSITORY,
    CHANNEX_GATEWAY,
    InboundBookingsService,
    OutboxWorker,
    ChannexSyncService,
    WebhookHealthService,
  ],
})
export class ChannelsModule {}
