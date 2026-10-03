import 'reflect-metadata';
import { Inject, Injectable, Module } from '@nestjs/common';
import type { OwnDay } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { ChessboardService } from '../chessboard/chessboard.service';
import {
  CHESSBOARD_REPOSITORY,
  PrismaChessboardRepository,
} from '../chessboard/chessboard.repository';
import { MarketCollectorController } from './collector.controller';
import { MarketCollectorService } from './collector.service';
import { MarketController } from './market.controller';
import { MARKET_REPOSITORY, PrismaMarketRepository } from './market.repository';
import { MarketService, OWN_OCCUPANCY, type OwnOccupancySource } from './market.service';

/** Своя загрузка: клетки того же календаря, что «Аналитика → Загрузка» (окно раздела не длиннее 31 дня) */
@Injectable()
export class ChessboardOwnOccupancy implements OwnOccupancySource {
  constructor(@Inject(ChessboardService) private readonly chessboard: ChessboardService) {}
  async ownDays(from: string, to: string): Promise<Record<string, OwnDay>> {
    const board = await this.chessboard.board(from, to);
    return board.summary;
  }
}

@Module({
  controllers: [MarketController, MarketCollectorController],
  providers: [
    PrismaService,
    ChessboardService,
    { provide: CHESSBOARD_REPOSITORY, useClass: PrismaChessboardRepository },
    { provide: OWN_OCCUPANCY, useClass: ChessboardOwnOccupancy },
    { provide: MARKET_REPOSITORY, useClass: PrismaMarketRepository },
    MarketService,
    MarketCollectorService,
  ],
})
export class MarketModule {}
