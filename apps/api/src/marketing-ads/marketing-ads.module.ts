import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import {
  AD_PROPOSAL_BOT,
  ADS_LOCATION,
  AdProposalService,
  MarketingAdsController,
  PrismaAdsLocation,
  adProposalBotFromEnv,
} from './ad-proposal';

/** Запуск рекламы из WETOP, ИИ-таргетолог (DATA_MODEL §57, ADR-MKT-LAUNCH): отдельное право, тратит деньги */
@Module({
  controllers: [MarketingAdsController],
  providers: [
    PrismaService,
    { provide: ADS_LOCATION, useClass: PrismaAdsLocation },
    { provide: AD_PROPOSAL_BOT, useFactory: () => adProposalBotFromEnv() },
    AdProposalService,
  ],
})
export class MarketingAdsModule {}
