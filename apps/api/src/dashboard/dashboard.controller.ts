import 'reflect-metadata';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Access } from '../auth/access.decorator';

/** Показатели за период: «Аналитика → Обзор» (ADR-105, ADR-114) и до переезда — Главная. */
@Access('desk')
@Controller('desk')
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly service: DashboardService) {}

  @Get('dashboard')
  dashboard(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('fund') fund?: string,
    @Query('category') category?: string,
  ) {
    return this.service.dashboard(from, to, fund ?? 'all', category || undefined);
  }

  /** «По номерам» (REP3): клетки шахматки до единицы; отчёт — под правом отчётов */
  @Access('reports')
  @Get('dashboard/units')
  units(@Query('from') from?: string, @Query('to') to?: string, @Query('fund') fund?: string) {
    return this.service.units(from, to, fund ?? 'all');
  }

  /** «Эффективность каналов» (ADR-141): отчёт: под правом отчётов */
  @Access('reports')
  @Get('dashboard/channels')
  channels(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('compareFrom') compareFrom?: string,
    @Query('compareTo') compareTo?: string,
    @Query('channel') channel?: string,
    @Query('sort') sort?: string,
    @Query('empty') empty?: string,
  ) {
    return this.service.channels({
      ...(from !== undefined ? { from } : {}),
      ...(to !== undefined ? { to } : {}),
      ...(compareFrom !== undefined ? { compareFrom } : {}),
      ...(compareTo !== undefined ? { compareTo } : {}),
      ...(channel ? { channel } : {}),
      ...(sort !== undefined ? { sort } : {}),
      empty: empty === '1' || empty === 'true',
    });
  }
}
