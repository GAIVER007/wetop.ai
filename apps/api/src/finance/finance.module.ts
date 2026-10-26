import { CashShiftsController } from './cash-shifts.controller';
import { CashShiftsService } from './cash-shifts.service';
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { FinanceController } from './finance.controller';
import { FINANCE_REPOSITORY, PrismaFinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';
import { PaymentRequestsController } from './payment-requests.controller';
import {
  PAYMENT_REQUESTS_REPOSITORY,
  PrismaPaymentRequestsRepository,
} from './payment-requests.repository';
import { PaymentRequestsService } from './payment-requests.service';
import { UnitsModule } from '../units/units.module';
import { ExpenseDocumentsController } from './expense-documents';
import { OwnerSummaryController, OwnerSummaryService } from './owner-summary';

@Module({
  imports: [UnitsModule],
  controllers: [CashShiftsController, FinanceController, PaymentRequestsController, OwnerSummaryController, ExpenseDocumentsController],
  providers: [
    PrismaService,
    CashShiftsService,
    FinanceService,
    OwnerSummaryService,
    { provide: FINANCE_REPOSITORY, useClass: PrismaFinanceRepository },
    // Запросы оплаты (DATA_MODEL §24, ADR-144)
    PaymentRequestsService,
    { provide: PAYMENT_REQUESTS_REPOSITORY, useClass: PrismaPaymentRequestsRepository },
  ],
})
export class FinanceModule {}
