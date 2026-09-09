import 'reflect-metadata';
import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { FinanceService } from './finance.service';

/** Счета гостя: начисления, платежи, возвраты (DATA_MODEL §6). Суммы в теле — десятичные строки, наружу — minor units. */
@Controller('finance')
export class FinanceController {
  constructor(@Inject(FinanceService) private readonly service: FinanceService) {}

  @Get('reservations/:number')
  reservation(@Param('number') number: string) {
    return this.service.reservation(number);
  }

  @Get('services')
  services() {
    return this.service.services();
  }

  @Post('folios/:id/charges')
  addCharge(@Param('id') id: string, @Body() dto: Parameters<FinanceService['addCharge']>[1]) {
    return this.service.addCharge(id, dto ?? {});
  }

  @Post('charges/:id/void')
  @HttpCode(200)
  voidCharge(@Param('id') id: string) {
    return this.service.voidCharge(id);
  }

  @Post('payments')
  createPayment(@Body() dto: Parameters<FinanceService['createPayment']>[0]) {
    return this.service.createPayment(dto ?? {});
  }

  @Post('payments/:id/refunds')
  refund(@Param('id') id: string, @Body() dto: Parameters<FinanceService['refund']>[1]) {
    return this.service.refund(id, dto ?? {});
  }
}
