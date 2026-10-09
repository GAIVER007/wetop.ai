import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { BarController } from './bar.controller';
import { BAR_REPOSITORY, PrismaBarRepository } from './bar.repository';
import { BarService } from './bar.service';
import { BarScanService } from './bar-scan.service';
import { BAR_SCAN_BOT, barScanBotFromEnv } from './scan.bot';

@Module({
  controllers: [BarController],
  providers: [
    PrismaService,
    BarService,
    BarScanService,
    { provide: BAR_REPOSITORY, useClass: PrismaBarRepository },
    // скан накладной (ADR-154): без SELLER_URL и ключа порт пуст, и сервис честно отвечает 503
    { provide: BAR_SCAN_BOT, useFactory: barScanBotFromEnv },
  ],
})
export class BarModule {}
