import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { InventoryImportPlan } from '@pms/domain';
import { LUXX_APARTS_PROPERTY, countActiveBlocks, readInventoryPlanFromDb } from '@pms/imports';
import { PrismaService } from '../database/prisma.provider';

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

/** Порт чтения фонда. В тестах подменяется фальшивкой без БД. */
export interface InventoryRepository {
  read(): Promise<InventoryReadModel | null>;
}

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');

/**
 * Сколько держать дерево фонда в памяти. Здания, комнаты и единицы меняет только импорт (отдельный процесс):
 * новая единица появится на экранах не позже чем через минуту. Блокировки — живые, считаются на каждый запрос.
 */
const PLAN_TTL_MS = () => Number(process.env.INVENTORY_PLAN_TTL_MS ?? 60_000);
const almatyToday = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  private cached: {
    at: number;
    propertyId: string;
    property: InventoryPropertyInfo;
    plan: InventoryImportPlan;
  } | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async read(): Promise<InventoryReadModel | null> {
    // Волна 4: дерево фонда — 5+ обращений к базе в Сингапуре; с кэшем на запрос остаётся один подсчёт блокировок
    if (this.cached && Date.now() - this.cached.at < PLAN_TTL_MS()) {
      const blocks = await countActiveBlocks(this.prisma.db, this.cached.propertyId, almatyToday());
      return { property: this.cached.property, plan: this.cached.plan, blocks };
    }
    const fromDb = await readInventoryPlanFromDb(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    if (!fromDb) {
      this.cached = null;
      return null;
    }
    this.cached = {
      at: Date.now(),
      propertyId: fromDb.property.id,
      property: fromDb.property,
      plan: fromDb.plan,
    };
    return { property: fromDb.property, plan: fromDb.plan, blocks: fromDb.blocks };
  }
}
