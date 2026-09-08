import 'reflect-metadata';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { summarizeInventoryPlan, type InventorySummary } from '@pms/domain';
import {
  INVENTORY_REPOSITORY,
  type InventoryPropertyInfo,
  type InventoryRepository,
} from './inventory.repository';

export interface InventorySummaryDto extends InventorySummary {
  property: InventoryPropertyInfo;
  blocks: number;
}

export interface InventoryUnitDto {
  code: string;
  exelyRoomNumber: string | null;
  kind: 'ROOM' | 'BED';
  accommodationTypeCode: string;
  accommodationTypeName: string;
  roomNumber: string;
  roomCapacity: number;
  isDorm: boolean;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(INVENTORY_REPOSITORY) private readonly repo: InventoryRepository) {}

  private async load() {
    const model = await this.repo.read();
    if (!model)
      throw new NotFoundException('Номерной фонд не импортирован: объект в БД отсутствует');
    return model;
  }

  async summary(): Promise<InventorySummaryDto> {
    const model = await this.load();
    return {
      property: model.property,
      ...summarizeInventoryPlan(model.plan),
      blocks: model.blocks,
    };
  }

  async units(category?: string): Promise<InventoryUnitDto[]> {
    const model = await this.load();
    const nameByCode = new Map(model.plan.accommodationTypes.map((t) => [t.code, t.name]));
    // Порядок ответа стабилен: по коду с числовым сравнением («2» раньше «10»). Из кода ничего не выводится.
    return [...model.plan.units]
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .filter((u) => category === undefined || u.accommodationTypeCode === category)
      .map((u) => ({
        code: u.code,
        exelyRoomNumber: u.exelyRoomNumber,
        kind: u.kind,
        accommodationTypeCode: u.accommodationTypeCode,
        accommodationTypeName: nameByCode.get(u.accommodationTypeCode) ?? u.accommodationTypeCode,
        roomNumber: u.roomNumber,
        roomCapacity: u.roomCapacity,
        isDorm: u.isDorm,
      }));
  }
}
