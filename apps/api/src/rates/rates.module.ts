import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { PrismaService } from '../database/prisma.provider';
import { RatesController } from './rates.controller';
import { PrismaRatesRepository, RATES_REPOSITORY } from './rates.repository';
import { RatesService } from './rates.service';

@Module({
  imports: [ChannelsModule],
  controllers: [RatesController],
  providers: [
    PrismaService,
    RatesService,
    { provide: RATES_REPOSITORY, useClass: PrismaRatesRepository },
  ],
})
export class RatesModule {}
