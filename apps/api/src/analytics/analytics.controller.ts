import 'reflect-metadata';
import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

/** Аналитика сайта для стойки: сайты, код счётчика, отчёт. Только localhost, как всё в PMS (ADR-023). */
@Controller('analytics')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly service: AnalyticsService) {}

  @Get('sites')
  sites() {
    return this.service.sites();
  }

  @Post('sites')
  create(@Body() dto: { name?: unknown; hosts?: unknown }) {
    return this.service.create(dto ?? {});
  }

  @Get('sites/:id')
  card(@Param('id') id: string) {
    return this.service.card(id);
  }

  @Patch('sites/:id')
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      name?: unknown;
      hosts?: unknown;
      status?: unknown;
      bookingEnabled?: unknown;
      bookingRatePlanCode?: unknown;
    },
  ) {
    return this.service.update(id, dto ?? {});
  }

  @Delete('sites/:id')
  remove(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Get('sites/:id/report')
  report(@Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.report(id, from || undefined, to || undefined);
  }
}
