import 'reflect-metadata';
import { Controller, Get, Header, Inject, Query } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { SalesService } from './sales.service';

/** Хаб «Продажи» (SALES2.2): сводка периода. Смотрят те, кто видит отчёты (владелец, управляющий, администратор) */
@Controller('sales')
@Access('reports')
export class SalesController {
  constructor(@Inject(SalesService) private readonly sales: SalesService) {}

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.sales.summary(from, to);
  }
}
