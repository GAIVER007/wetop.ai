import 'reflect-metadata';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  InventoryService,
  type InventorySummaryDto,
  type InventoryUnitDto,
} from './inventory.service';

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
}
