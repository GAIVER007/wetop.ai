import { RequiresBusinessCapability } from '../auth/capability.decorator';
import 'reflect-metadata';
import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import {
  InventoryService,
  type InventorySummaryDto,
  type InventoryUnitDto,
} from './inventory.service';
import { Access } from '../auth/access.decorator';

@Access('desk')
@RequiresBusinessCapability('hospitality.inventory')
@Controller('inventory')
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly service: InventoryService) {}

  /** Сводка Gate 1: 88 = 16 ROOM + 72 BED, 92 гостя, по категориям. */
  @Get('summary')
  summary(): Promise<InventorySummaryDto> {
    return this.service.summary();
  }

  /** Все единицы; `?category=<accommodation type code>` — фильтр. Неизвестная категория → []. */
  @Get('units')
  units(@Query('category') category?: string): Promise<InventoryUnitDto[]> {
    return this.service.units(category === '' ? undefined : category);
  }

  /** Динамика сводки: `?days=7|30|90` (по умолчанию 30) */
  @Get('trend')
  trend(@Query('days') days?: string) {
    const n = days === undefined || days === '' ? 30 : Number(days);
    if (![7, 30, 90].includes(n)) throw new BadRequestException('Период: 7, 30 или 90 дней');
    return this.service.trend(n);
  }

  /** Занятость мест сегодня: проживает, заезд сегодня, свободно */
  @Get('occupancy')
  occupancy() {
    return this.service.occupancy();
  }
}
