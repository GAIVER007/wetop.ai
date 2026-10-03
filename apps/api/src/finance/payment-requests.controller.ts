import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { PaymentRequestsService } from './payment-requests.service';

/**
 * Запросы оплаты (DATA_MODEL §23, ADR-141): счёт Kaspi по телефону, ссылка банка или перевод в брони; «Оплачено»
 * превращает запрос в обычный платёж. Право — стойка: оплату принимает администратор смены.
 */
@Access('desk')
@Controller('finance')
export class PaymentRequestsController {
  constructor(@Inject(PaymentRequestsService) private readonly service: PaymentRequestsService) {}

  @Get('reservations/:number/payment-requests')
  list(@Param('number') number: string) {
    return this.service.list(number);
  }

  @Post('reservations/:number/payment-requests')
  create(@Param('number') number: string, @Body() dto: Record<string, unknown>) {
    return this.service.create(number, dto ?? {});
  }

  @Post('payment-requests/:id/paid')
  @HttpCode(200)
  paid(@Param('id', ParseUUIDPipe) id: string, @Body() dto: { paidAt?: unknown }) {
    return this.service.markPaid(id, dto ?? {});
  }

  @Post('payment-requests/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }
}
