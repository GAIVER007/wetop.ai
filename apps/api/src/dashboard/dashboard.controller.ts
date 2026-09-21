import 'reflect-metadata';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

/** Главная собственника и управляющего: показатели за период. */
@Controller('desk')
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly service: DashboardService) {}

  @Get('dashboard')
  dashboard(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.dashboard(from, to);
  }
}
