import 'reflect-metadata';
import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { OrganizationService } from './organization.service';

/**
 * Компания и её филиалы (Platform P3, ADR-130). Структуру видит каждый вошедший (`desk`), переключатель филиала нужен и
 * администратору; сводку по филиалам, право `reports`, как «Аналитику»; добавляет филиал владелец (`owner`, Q-237).
 * «Только чтение» организации закрывает запись общим замком (ADR-102): маршрут не под `/auth/*`.
 */
@Controller('organization')
export class OrganizationController {
  constructor(@Inject(OrganizationService) private readonly service: OrganizationService) {}

  @Access('desk')
  @Get()
  structure() {
    return this.service.structure();
  }

  @Access('owner')
  @Post('locations')
  createBranch(@Body() body: unknown) {
    return this.service.createBranch(body);
  }

  @Access('reports')
  @Get('summary')
  summary(@Query('from') from?: string, @Query('to') to?: string, @Query('fund') fund?: string) {
    return this.service.summary(from, to, fund ?? 'all');
  }
}
