import 'reflect-metadata';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

/** Показатели за период: «Аналитика → Обзор» (ADR-105, ADR-114) и до переезда — Главная. */
@Controller('desk')
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly service: DashboardService) {}

  @Get('dashboard')
  dashboard(@Query('from') from?: string, @Query('to') to?: string, @Query('fund') fund?: string) {
    return this.service.dashboard(from, to, fund ?? 'all');
  }
}
