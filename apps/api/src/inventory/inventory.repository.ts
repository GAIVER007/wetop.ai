import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { InventoryImportPlan } from '@pms/domain';
import { readInventoryPlanFromDb } from '@pms/imports';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
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

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async read(): Promise<InventoryReadModel | null> {
    const property = await this.prisma.db.property.findFirst({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: { name: true, timezone: true, currency: true },
    });
    if (!property) return null;
    const fromDb = await readInventoryPlanFromDb(this.prisma.db, property.name);
    if (!fromDb) return null;
    return { property, plan: fromDb.plan, blocks: fromDb.blocks };
  }
}
