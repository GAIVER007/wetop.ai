import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { ChessboardController } from './chessboard.controller';
import { CHESSBOARD_REPOSITORY, PrismaChessboardRepository } from './chessboard.repository';
import { ChessboardService } from './chessboard.service';

@Module({
  controllers: [ChessboardController],
  providers: [
    PrismaService,
    ChessboardService,
    { provide: CHESSBOARD_REPOSITORY, useClass: PrismaChessboardRepository },
  ],
})
export class ChessboardModule {}
