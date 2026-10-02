import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
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

  /** Общая лента денег за период: брони + касса, отборы по типу, способу и источнику (ADR-113 F2; §21) */
  @Access('reports')
  @Get('operations')
  operations(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('method') method?: string,
    @Query('source') source?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.periodOperations(from, to, {
      ...(type !== undefined ? { type } : {}),
      ...(method !== undefined ? { method } : {}),
      ...(source !== undefined ? { source } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
  }

  // ── Касса (DATA_MODEL §21): остатки, операции мимо броней, переводы, статьи ────────────────────
  /** Остатки по способам за всё время и статьи одним ответом; кассу ведёт смена — право стойки (Q-238) */
  @Get('cash')
  cash() {
    return this.service.cash();
  }

  @Access('settings')
  @Post('cash/categories')
  createCashCategory(@Body() dto: Parameters<FinanceService['createCashCategory']>[0]) {
    return this.service.createCashCategory(dto ?? {});
  }

  @Access('settings')
  @Patch('cash/categories/:id')
  updateCashCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Parameters<FinanceService['updateCashCategory']>[1],
  ) {
    return this.service.updateCashCategory(id, dto ?? {});
  }

  @Post('cash/operations')
  createCashOperation(@Body() dto: Parameters<FinanceService['createCashOperation']>[0]) {
    return this.service.createCashOperation(dto ?? {});
  }

  @Post('cash/transfers')
  createCashTransfer(@Body() dto: Parameters<FinanceService['createCashTransfer']>[0]) {
    return this.service.createCashTransfer(dto ?? {});
  }

  @Access('refunds')
  @Post('cash/operations/:id/void')
  @HttpCode(200)
  voidCashOperation(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.voidCashOperation(id);
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
