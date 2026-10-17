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
import {
  AdLaunchService,
  META_WRITER,
  MarketingAdLaunchController,
  metaWriterFactory,
} from './ad-launch';
import {
  MARKETING_BUDGET_REPOSITORY,
  PrismaMarketingBudgetRepository,
} from '../marketing-budget/marketing-budget.repository';
import { SITE_ASSET_STORAGE, siteAssetStorageFromEnv } from '../marketing-site/asset-storage';

/** Запуск рекламы из WETOP, ИИ-таргетолог (DATA_MODEL §57, ADR-MKT-LAUNCH): отдельное право, тратит деньги */
@Module({
  controllers: [MarketingAdsController, MarketingAdLaunchController],
  providers: [
    PrismaService,
    { provide: ADS_LOCATION, useClass: PrismaAdsLocation },
    { provide: AD_PROPOSAL_BOT, useFactory: () => adProposalBotFromEnv() },
    AdProposalService,
    { provide: MARKETING_BUDGET_REPOSITORY, useClass: PrismaMarketingBudgetRepository },
    { provide: SITE_ASSET_STORAGE, useFactory: () => siteAssetStorageFromEnv() },
    { provide: META_WRITER, useValue: metaWriterFactory },
    AdLaunchService,
  ],
})
export class MarketingAdsModule {}
