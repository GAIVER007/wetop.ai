import 'reflect-metadata';
import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { BusinessMarketService } from './business-market.service';

/**
 * «Конкуренты» салона и ресторана (DATA_MODEL §60): смотрит тот, кто видит отчёты; соседей и снимки дня ведёт тот, кто
 * ставит цены (как у гостиницы, ADR-142). Сборщик ИИ пишет через служебный вход отдельным срезом.
 */
@Access('reports')
@Controller('business-market')
export class BusinessMarketController {
  constructor(@Inject(BusinessMarketService) private readonly service: BusinessMarketService) {}

  @Get()
  board(@Query('from') from?: string, @Query('days') days?: string) {
    return this.service.board({ from, days });
  }

  @Access('rates')
  @Post('competitors')
  create(@Body() dto: Record<string, unknown>) {
    return this.service.createCompetitor(dto ?? {});
  }

  @Access('rates')
  @Patch('competitors/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Record<string, unknown>) {
    return this.service.updateCompetitor(id, dto ?? {});
  }

  @Access('rates')
  @Put('competitors/:id/snapshot')
  @HttpCode(200)
  snapshot(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Record<string, unknown>) {
    return this.service.putSnapshot(id, dto ?? {});
  }
}
