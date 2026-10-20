import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { MarketingBudgetController } from './marketing-budget.controller';
import {
  MARKETING_BUDGET_REPOSITORY,
  PrismaMarketingBudgetRepository,
} from './marketing-budget.repository';
import { MarketingBudgetService } from './marketing-budget.service';
import { ExpenseFilesService } from './expense-files';
import { MarketingCampaignsController, MarketingCampaignsService } from './campaigns';
import {
  EnvMetaGateway,
  META_GATEWAY,
  MarketingMetaController,
  MarketingMetaNightly,
  MarketingMetaService,
} from './meta-connection';
import { SITE_ASSET_STORAGE, siteAssetStorageFromEnv } from '../marketing-site/asset-storage';

/** Учёт бюджета и расходов маркетинга (МКТ-В1/В2, ADR-MKT-B1, DATA_MODEL §41) */
@Module({
  controllers: [MarketingBudgetController, MarketingCampaignsController, MarketingMetaController],
  providers: [
    PrismaService,
    { provide: MARKETING_BUDGET_REPOSITORY, useClass: PrismaMarketingBudgetRepository },
    MarketingBudgetService,
    ExpenseFilesService,
    MarketingCampaignsService,
    { provide: META_GATEWAY, useClass: EnvMetaGateway },
    MarketingMetaService,
    MarketingMetaNightly,
    { provide: SITE_ASSET_STORAGE, useFactory: () => siteAssetStorageFromEnv() },
  ],
})
export class MarketingBudgetModule {}
