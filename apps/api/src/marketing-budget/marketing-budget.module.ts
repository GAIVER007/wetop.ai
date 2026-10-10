import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { MarketingBudgetController } from './marketing-budget.controller';
import {
  MARKETING_BUDGET_REPOSITORY,
  PrismaMarketingBudgetRepository,
} from './marketing-budget.repository';
import { MarketingBudgetService } from './marketing-budget.service';

/** Учёт бюджета и расходов маркетинга (МКТ-В1/В2, ADR-MKT-B1, DATA_MODEL §32) */
@Module({
  controllers: [MarketingBudgetController],
  providers: [
    PrismaService,
    { provide: MARKETING_BUDGET_REPOSITORY, useClass: PrismaMarketingBudgetRepository },
    MarketingBudgetService,
  ],
})
export class MarketingBudgetModule {}
