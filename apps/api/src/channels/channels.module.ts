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
  CHANNELS_REPOSITORY,
  CHANNEX_GATEWAY,
  PrismaChannelsRepository,
  channexGatewayFromEnv,
} from './channels.repository';

@Module({
  controllers: [ChannelsController],
  providers: [
    PrismaService,
    ChannexSyncService,
    InboundBookingsService,
    { provide: RESERVATIONS_UOW, useClass: PrismaUnitOfWork },
    { provide: CHANNELS_REPOSITORY, useClass: PrismaChannelsRepository },
    { provide: CHANNEX_GATEWAY, useFactory: channexGatewayFromEnv },
    { provide: ARI_PUBLISHER, useClass: OutboxAriPublisher },
    OutboxWorker,
    WebhookHealthService,
  ],
  exports: [ARI_PUBLISHER],
})
export class ChannelsModule {}
