import 'reflect-metadata';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { summarizeInventoryPlan, type InventorySummary } from '@pms/domain';
import {
  INVENTORY_REPOSITORY,
  type InventoryPropertyInfo,
  type InventoryRepository,
} from './inventory.repository';
import {
  classifyOccupancy,
  computeTrend,
  type InventoryTrend,
  type UnitOccupancy,
} from './inventory-insight';

export interface InventorySummaryDto extends InventorySummary {
  property: InventoryPropertyInfo;
  blocks: number;
}

export interface InventoryUnitDto {
  code: string;
  kind: 'ROOM' | 'BED';
  accommodationTypeCode: string;
  accommodationTypeName: string;
  roomNumber: string;
  roomCapacity: number;
  isDorm: boolean;
  /** Расположение и живое состояние для списка фонда (ADR-108) */
  buildingName: string | null;
  floorName: string | null;
  housekeepingStatus: 'DIRTY' | 'CLEAN' | 'INSPECTED';
  active: boolean;
  block: { dateTo: string; type: string; reason: string | null } | null;
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
    // Уборка и блокировки живут отдельно от кэша дерева фонда: статус меняется чаще, чем структура
    const states = new Map((await this.repo.states()).map((s) => [s.code, s]));
    // Порядок ответа стабилен: по коду с числовым сравнением («2» раньше «10»). Из кода ничего не выводится.
    return [...model.plan.units]
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .filter((u) => category === undefined || u.accommodationTypeCode === category)
      .map((u) => {
        const state = states.get(u.code);
        return {
          code: u.code,
          kind: u.kind,
          accommodationTypeCode: u.accommodationTypeCode,
          accommodationTypeName: nameByCode.get(u.accommodationTypeCode) ?? u.accommodationTypeCode,
          roomNumber: u.roomNumber,
          roomCapacity: u.roomCapacity,
          isDorm: u.isDorm,
          buildingName: u.buildingName ?? null,
          floorName: u.floorName ?? null,
          housekeepingStatus: state?.housekeepingStatus ?? 'DIRTY',
          active: state?.active ?? true,
          block: state?.block ?? null,
        };
      });
  }

  /** Динамика сводки за период (7, 30 или 90 дней), восстановленная из существующих записей */
  async trend(days: number): Promise<InventoryTrend> {
    await this.load();
    return computeTrend({ ...(await this.repo.trendSource()), days });
  }

  /** Кто в месте сегодня: проживает, заезжает или свободно. Только чтение. */
  async occupancy(): Promise<Array<{ code: string } & UnitOccupancy>> {
    const model = await this.load();
    const { today, byCode } = await this.repo.staysToday();
    return model.plan.units.map((u) => ({
      code: u.code,
      ...classifyOccupancy(today, byCode.get(u.code) ?? []),
    }));
  }
}
