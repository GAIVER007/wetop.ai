import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { InventoryImportPlan } from '@pms/domain';
import { countActiveBlocks, readInventoryPlanFromDb } from '@pms/imports';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyToday, propertyIdRef } from '../database/property-ref';

export interface InventoryPropertyInfo {
  name: string;
  timezone: string;
  currency: string;
}

export interface InventoryReadModel {
  property: InventoryPropertyInfo;
  plan: InventoryImportPlan;
  blocks: number;
}

/** Живое состояние места для списка фонда (ADR-108): уборка, действующая блокировка, участие в продаже */
export interface InventoryUnitState {
  code: string;
  housekeepingStatus: 'DIRTY' | 'CLEAN' | 'INSPECTED';
  active: boolean;
  /** Блокировка, действующая сегодня (правило countActiveBlocks); нет — место в продаже */
  block: { dateTo: string; type: string; reason: string | null } | null;
}

/** Порт чтения фонда. В тестах подменяется фальшивкой без БД. */
export interface InventoryRepository {
  read(): Promise<InventoryReadModel | null>;
  /** Уборка и блокировки живые — читаются на каждый запрос, в кэш дерева не попадают */
  states(): Promise<InventoryUnitState[]>;
  invalidate?(propertyId: string): void;
}

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');

/**
 * Сколько держать дерево фонда в памяти. Здания, комнаты и единицы меняет только импорт (отдельный процесс):
 * новая единица появится на экранах не позже чем через минуту. Блокировки — живые, считаются на каждый запрос.
 */
const PLAN_TTL_MS = () => Number(process.env.INVENTORY_PLAN_TTL_MS ?? 60_000);

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  // Кэш дерева фонда — ПО ОБЪЕКТУ (его id): иначе один процесс отдал бы фонд одной организации
  // другой (мультитенантность, разбор изоляции 21.09). id объекта — по организации вошедшего.
  private cached = new Map<
    string,
    { at: number; property: InventoryPropertyInfo; plan: InventoryImportPlan }
  >();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  invalidate(propertyId: string): void {
    this.cached.delete(propertyId);
  }

  async states(): Promise<InventoryUnitState[]> {
    const propertyId = await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const today = await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const onDate = new Date(`${today}T00:00:00Z`);
    const rows = await this.prisma.db.inventoryUnit.findMany({
      where: { propertyId },
      select: {
        code: true,
        housekeepingStatus: true,
        active: true,
        blocks: {
          where: { dateFrom: { lte: onDate }, dateTo: { gt: onDate } },
          orderBy: { dateTo: 'desc' },
          take: 1,
          select: { dateTo: true, type: true, reason: true },
        },
      },
    });
    return rows.map((row) => ({
      code: row.code,
      housekeepingStatus: row.housekeepingStatus,
      active: row.active,
      block: row.blocks[0]
        ? {
            dateTo: row.blocks[0].dateTo.toISOString().slice(0, 10),
            type: row.blocks[0].type,
            reason: row.blocks[0].reason,
          }
        : null,
    }));
  }

  async read(): Promise<InventoryReadModel | null> {
    // Объект организации вошедшего — id из property-ref (по имени читать нельзя, имена между
    // организациями не уникальны). Служебный путь property-ref сам возьмёт Luxx по имени.
    const propertyId = await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    // Волна 4: дерево фонда — 5+ обращений к базе в Сингапуре; с кэшем на запрос остаётся один подсчёт блокировок
    const hit = this.cached.get(propertyId);
    if (hit && Date.now() - hit.at < PLAN_TTL_MS()) {
      const blocks = await countActiveBlocks(
        this.prisma.db,
        propertyId,
        await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name),
      );
      return { property: hit.property, plan: hit.plan, blocks };
    }
    const fromDb = await readInventoryPlanFromDb(this.prisma.db, { id: propertyId });
    if (!fromDb) {
      this.cached.delete(propertyId);
      return null;
    }
    this.cached.set(propertyId, {
      at: Date.now(),
      property: fromDb.property,
      plan: fromDb.plan,
    });
    return { property: fromDb.property, plan: fromDb.plan, blocks: fromDb.blocks };
  }
}
