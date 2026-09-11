import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { FinanceController } from './finance.controller';
import { FINANCE_REPOSITORY, PrismaFinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';
import { UnitsModule } from '../units/units.module';

@Module({
  imports: [UnitsModule],
  controllers: [FinanceController],
  providers: [
    PrismaService,
    FinanceService,
    { provide: FINANCE_REPOSITORY, useClass: PrismaFinanceRepository },
  ],
})
export class FinanceModule {}
