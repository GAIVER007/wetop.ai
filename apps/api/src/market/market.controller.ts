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
  Put,
  Query,
} from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { MarketService } from './market.service';

/**
 * «Загрузка конкурентов» (ADR-141): смотрит тот, кто видит отчёты; список конкурентов и снимки ведёт тот, кто ставит
 * цены. Вносит человек; сборщик ИИ (источник AI_AGENT): отдельный срез после Q-257.
 */
@Access('reports')
@Controller('market')
export class MarketController {
  constructor(@Inject(MarketService) private readonly service: MarketService) {}

  @Get('occupancy')
  occupancy(
    @Query('from') from?: string,
    @Query('days') days?: string,
    @Query('asOf') asOf?: string,
    @Query('compare') compare?: string,
  ) {
    return this.service.occupancy({ from, days, asOf, compare });
  }

  @Access('rates')
  @Post('competitors')
  createCompetitor(@Body() dto: Record<string, unknown>) {
    return this.service.createCompetitor(dto ?? {});
  }

  @Access('rates')
  @Patch('competitors/:id')
  updateCompetitor(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Record<string, unknown>) {
    return this.service.updateCompetitor(id, dto ?? {});
  }

  @Access('rates')
  @Put('competitors/:id/occupancy')
  @HttpCode(200)
  writeOccupancy(@Param('id', ParseUUIDPipe) id: string, @Body() dto: { entries?: unknown }) {
    return this.service.writeOccupancy(id, dto ?? {});
  }
}
