import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { ChessboardService } from '../chessboard/chessboard.service';
import {
  CHESSBOARD_REPOSITORY,
  PrismaChessboardRepository,
} from '../chessboard/chessboard.repository';
import { DashboardController } from './dashboard.controller';
import { DASHBOARD_REPOSITORY, PrismaDashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  exports: [DashboardService],
  providers: [
    PrismaService,
    ChessboardService,
    { provide: CHESSBOARD_REPOSITORY, useClass: PrismaChessboardRepository },
    DashboardService,
    { provide: DASHBOARD_REPOSITORY, useClass: PrismaDashboardRepository },
  ],
})
export class DashboardModule {}
