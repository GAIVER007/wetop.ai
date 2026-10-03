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

@Module({
  imports: [UnitsModule],
  controllers: [FinanceController, PaymentRequestsController],
  providers: [
    PrismaService,
    FinanceService,
    { provide: FINANCE_REPOSITORY, useClass: PrismaFinanceRepository },
    // Запросы оплаты (DATA_MODEL §23, ADR-143)
    PaymentRequestsService,
    { provide: PAYMENT_REQUESTS_REPOSITORY, useClass: PrismaPaymentRequestsRepository },
  ],
})
export class FinanceModule {}
