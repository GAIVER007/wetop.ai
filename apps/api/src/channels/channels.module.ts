import 'reflect-metadata';
import { Module } from '@nestjs/common';
import {
  CHESSBOARD_REPOSITORY,
  PrismaChessboardRepository,
} from '../chessboard/chessboard.repository';
import { PrismaService } from '../database/prisma.provider';
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
    { provide: CHANNELS_REPOSITORY, useClass: PrismaChannelsRepository },
    { provide: CHESSBOARD_REPOSITORY, useClass: PrismaChessboardRepository },
    { provide: CHANNEX_GATEWAY, useFactory: channexGatewayFromEnv },
  ],
})
export class ChannelsModule {}
