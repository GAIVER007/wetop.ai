import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { PrismaService } from '../database/prisma.provider';
import { RatesController } from './rates.controller';
import { PrismaRatesRepository, RATES_REPOSITORY } from './rates.repository';
import { RatesService } from './rates.service';
import { RatePlansService } from './rate-plans';
import { PromoCodesService } from './promo-codes';

@Module({
  imports: [ChannelsModule],
  controllers: [RatesController],
  providers: [
    PrismaService,
    RatesService,
    RatePlansService,
    PromoCodesService,
    { provide: RATES_REPOSITORY, useClass: PrismaRatesRepository },
  ],
  // цену категории ставит «Категории номеров» тем же путём, что прежний экран цен (журнал, очередь каналов)
  exports: [RatesService],
})
export class RatesModule {}
