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
  dashboard(@Query('from') from?: string, @Query('to') to?: string, @Query('fund') fund?: string) {
    return this.service.dashboard(from, to, fund ?? 'all');
  }

  /** «По номерам» (REP3): клетки шахматки до единицы; отчёт — под правом отчётов */
  @Access('reports')
  @Get('dashboard/units')
  units(@Query('from') from?: string, @Query('to') to?: string, @Query('fund') fund?: string) {
    return this.service.units(from, to, fund ?? 'all');
  }
}
