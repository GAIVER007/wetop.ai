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
  Query,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { Access } from '../auth/access.decorator';

/** Счета гостя: начисления, платежи, возвраты (DATA_MODEL §6). Суммы в теле — десятичные строки, наружу — minor units. */
@Access('desk')
@Controller('finance')
export class FinanceController {
  constructor(@Inject(FinanceService) private readonly service: FinanceService) {}

  @Get('reservations/:number')
  reservation(@Param('number') number: string) {
    return this.service.reservation(number);
  }

  @Access('reports')
  @Get('report')
  report(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.periodReport(from, to);
  }

  /** Брони с остатком к сбору за период — список к «Финансам за период» (ADR-113) */
  @Access('reports')
  @Get('debts')
  debts(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.periodDebts(from, to);
  }

  /** Оплаты и возвраты за период с отборами по типу и способу — «Финансы за период», F2 (ADR-113) */
  @Access('reports')
  @Get('operations')
  operations(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('method') method?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.periodOperations(from, to, {
      ...(type !== undefined ? { type } : {}),
      ...(method !== undefined ? { method } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
  }

  @Get('services')
  services() {
    return this.service.services();
  }

  @Post('folios/:id/charges')
  addCharge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Parameters<FinanceService['addCharge']>[1],
  ) {
    return this.service.addCharge(id, dto ?? {});
  }

  @Post('folios/:id/stay-extras')
  addStayExtra(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Parameters<FinanceService['addStayExtra']>[1],
  ) {
    return this.service.addStayExtra(id, dto ?? {});
  }

  @Post('folios/:id/close')
  @HttpCode(200)
  closeFolio(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.closeFolio(id);
  }

  @Access('refunds')
  @Post('charges/:id/void')
  @HttpCode(200)
  voidCharge(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.voidCharge(id);
  }

  @Post('payments')
  createPayment(@Body() dto: Parameters<FinanceService['createPayment']>[0]) {
    return this.service.createPayment(dto ?? {});
  }

  @Access('refunds')
  @Post('payments/:id/refunds')
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Parameters<FinanceService['refund']>[1],
  ) {
    return this.service.refund(id, dto ?? {});
  }
}
