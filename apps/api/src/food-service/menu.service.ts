import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  effectiveMenuItem,
  foodId,
  foodInt,
  foodObject,
  parseLocationMenuItem,
  parseMenuCategory,
  parseMenuItem,
} from '@pms/domain';
import type { DbTx, LocationMenuItem, MenuCategory, MenuItem, Prisma } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { foodMay, foodScope, foodTransaction, foodWritable, type FoodScope } from './scope';

function parsed<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new BadRequestException(e instanceof Error ? e.message : 'Некорректный запрос');
  }
}

const categoryView = (c: MenuCategory) => ({
  id: c.id,
  name: c.name,
  sortOrder: c.sortOrder,
  active: c.active,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

type ItemRow = MenuItem & { locations: LocationMenuItem[] };
function itemView(i: ItemRow) {
  const override = i.locations[0] ?? null;
  const effective = effectiveMenuItem(i, override);
  return {
    id: i.id,
    categoryId: i.categoryId,
    name: i.name,
    sku: i.sku,
    description: i.description,
    priceMinor: i.price.toString(),
    currency: i.currency,
    outputWeightGrams: i.outputWeightGrams,
    prepTimeMinutes: i.prepTimeMinutes,
    allergens: i.allergens,
    tags: i.tags,
    active: i.active,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    location: {
      enabled: override?.enabled ?? true,
      available: override?.available ?? true,
      priceOverrideMinor: override?.priceOverride?.toString() ?? null,
      effectivePriceMinor: effective.price.toString(),
      visible: effective.visible,
    },
  };
}

function itemSnapshot(i: MenuItem): Prisma.InputJsonObject {
  return {
    ...i,
    price: i.price.toString(),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

function page(raw: unknown, extra: string[] = []) {
  return parsed(() => {
    const q = foodObject(raw, ['cursor', 'limit', ...extra]);
    const limit =
      q.limit === undefined
        ? 100
        : foodInt(
            typeof q.limit === 'string' && /^\d+$/.test(q.limit) ? Number(q.limit) : q.limit,
            1,
            100,
          );
    return { q, limit, cursor: q.cursor === undefined ? undefined : foodId(q.cursor) };
  });
}
function paged<T extends { id: string }>(rows: T[], limit: number) {
  return {
    items: rows.slice(0, limit),
    nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
  };
}

@Injectable()
export class MenuService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async write<T>(fn: (tx: DbTx, s: FoodScope) => Promise<T>): Promise<T> {
    foodMay('settings');
    await foodWritable(this.prisma.db);
    const s = await foodScope(this.prisma.db);
    return foodTransaction(this.prisma, s, fn);
  }
  private async audit(
    tx: DbTx,
    s: FoodScope,
    id: string,
    action: string,
    after: Prisma.InputJsonObject,
    before?: Prisma.InputJsonObject,
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: s.organizationId,
        userId: currentUserId(),
        entityType: 'menu_catalog',
        entityId: id,
        action,
        after,
        ...(before ? { before } : {}),
      },
    });
  }
  private locationsFor(locationId: string) {
    return { locations: { where: { locationId } } } as const;
  }

  async categories(query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db),
      p = page(query);
    return paged(
      (
        await this.prisma.db.menuCategory.findMany({
          take: p.limit + 1,
          // Курсор ходит по id, поэтому и порядок по id; порядок показа сортирует интерфейс
          orderBy: { id: 'asc' },
          where: { ...(p.cursor ? { id: { gt: p.cursor } } : {}), businessId: s.businessId },
        })
      ).map(categoryView),
      p.limit,
    );
  }
  async createCategory(raw: unknown) {
    return this.write(async (tx, s) => {
      const b = parsed(() => parseMenuCategory(raw));
      const row = await tx.menuCategory.create({
        data: {
          businessId: s.businessId,
          name: b.name!,
          sortOrder: b.sortOrder ?? 0,
          active: b.active ?? true,
        },
      });
      await this.audit(tx, s, row.id, 'food.menu_category.created', {
        ...categoryView(row),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      });
      return categoryView(row);
    });
  }
  async updateCategory(idRaw: string, raw: unknown) {
    return this.write(async (tx, s) => {
      const id = parsed(() => foodId(idRaw)),
        b = parsed(() => parseMenuCategory(raw, true));
      const old = await tx.menuCategory.findFirst({ where: { id, businessId: s.businessId } });
      if (!old) throw new NotFoundException('Категория не найдена');
      const row = await tx.menuCategory.update({
        where: { id },
        data: {
          ...(b.name !== undefined ? { name: b.name } : {}),
          ...(b.sortOrder !== undefined ? { sortOrder: b.sortOrder } : {}),
          ...(b.active !== undefined ? { active: b.active } : {}),
        },
      });
      await this.audit(
        tx,
        s,
        row.id,
        'food.menu_category.updated',
        { ...categoryView(row), updatedAt: row.updatedAt.toISOString() },
        { ...categoryView(old), updatedAt: old.updatedAt.toISOString() },
      );
      return categoryView(row);
    });
  }

  async items(query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db),
      p = page(query, ['categoryId']);
    const categoryId =
      p.q.categoryId === undefined ? undefined : parsed(() => foodId(p.q.categoryId));
    return paged(
      (
        await this.prisma.db.menuItem.findMany({
          take: p.limit + 1,
          orderBy: { id: 'asc' },
          where: {
            ...(p.cursor ? { id: { gt: p.cursor } } : {}),
            businessId: s.businessId,
            ...(categoryId ? { categoryId } : {}),
          },
          include: this.locationsFor(s.locationId),
        })
      ).map(itemView),
      p.limit,
    );
  }
  private async categoryAvailable(tx: DbTx, s: FoodScope, categoryId: string) {
    if (
      !(await tx.menuCategory.findFirst({
        where: { id: categoryId, businessId: s.businessId, active: true },
      }))
    )
      throw new NotFoundException('Категория недоступна');
  }
  async createItem(raw: unknown) {
    return this.write(async (tx, s) => {
      const b = parsed(() => parseMenuItem(raw));
      if (b.categoryId) await this.categoryAvailable(tx, s, b.categoryId);
      const row = await tx.menuItem.create({
        data: {
          businessId: s.businessId,
          categoryId: b.categoryId ?? null,
          name: b.name!,
          sku: b.sku ?? null,
          description: b.description ?? null,
          price: BigInt(b.price!),
          currency: b.currency!,
          outputWeightGrams: b.outputWeightGrams ?? null,
          prepTimeMinutes: b.prepTimeMinutes ?? null,
          allergens: b.allergens ?? [],
          tags: b.tags ?? [],
          active: b.active ?? true,
        },
        include: this.locationsFor(s.locationId),
      });
      await this.audit(tx, s, row.id, 'food.menu_item.created', itemSnapshot(row));
      return itemView(row);
    });
  }
  async updateItem(idRaw: string, raw: unknown) {
    return this.write(async (tx, s) => {
      const id = parsed(() => foodId(idRaw)),
        b = parsed(() => parseMenuItem(raw, true));
      const old = await tx.menuItem.findFirst({ where: { id, businessId: s.businessId } });
      if (!old) throw new NotFoundException('Блюдо не найдено');
      if (b.categoryId) await this.categoryAvailable(tx, s, b.categoryId);
      const row = await tx.menuItem.update({
        where: { id },
        data: {
          ...(b.name !== undefined ? { name: b.name } : {}),
          ...(b.categoryId !== undefined ? { categoryId: b.categoryId } : {}),
          ...(b.sku !== undefined ? { sku: b.sku } : {}),
          ...(b.description !== undefined ? { description: b.description } : {}),
          ...(b.price !== undefined ? { price: BigInt(b.price) } : {}),
          ...(b.currency !== undefined ? { currency: b.currency } : {}),
          ...(b.outputWeightGrams !== undefined ? { outputWeightGrams: b.outputWeightGrams } : {}),
          ...(b.prepTimeMinutes !== undefined ? { prepTimeMinutes: b.prepTimeMinutes } : {}),
          ...(b.allergens !== undefined ? { allergens: b.allergens } : {}),
          ...(b.tags !== undefined ? { tags: b.tags } : {}),
          ...(b.active !== undefined ? { active: b.active } : {}),
        },
        include: this.locationsFor(s.locationId),
      });
      await this.audit(tx, s, row.id, 'food.menu_item.updated', itemSnapshot(row), itemSnapshot(old));
      return itemView(row);
    });
  }
  /** Переопределение текущего филиала: включение, стоп-лист, своя цена. Upsert одной строкой. */
  async setLocationItem(idRaw: string, raw: unknown) {
    return this.write(async (tx, s) => {
      const id = parsed(() => foodId(idRaw)),
        b = parsed(() => parseLocationMenuItem(raw));
      const item = await tx.menuItem.findFirst({ where: { id, businessId: s.businessId } });
      if (!item) throw new NotFoundException('Блюдо не найдено');
      const key = { locationId: s.locationId, menuItemId: id };
      const before = await tx.locationMenuItem.findUnique({
        where: { locationId_menuItemId: key },
      });
      const data = {
        ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
        ...(b.available !== undefined ? { available: b.available } : {}),
        ...(b.priceOverride !== undefined
          ? { priceOverride: b.priceOverride == null ? null : BigInt(b.priceOverride) }
          : {}),
      };
      await tx.locationMenuItem.upsert({
        where: { locationId_menuItemId: key },
        create: { ...key, ...data },
        update: data,
      });
      const row = (await tx.menuItem.findFirst({
        where: { id },
        include: this.locationsFor(s.locationId),
      }))!;
      const override = row.locations[0]!;
      await this.audit(
        tx,
        s,
        id,
        'food.menu_item.location_set',
        {
          locationId: s.locationId,
          enabled: override.enabled,
          available: override.available,
          priceOverride: override.priceOverride?.toString() ?? null,
        },
        before
          ? {
              locationId: s.locationId,
              enabled: before.enabled,
              available: before.available,
              priceOverride: before.priceOverride?.toString() ?? null,
            }
          : undefined,
      );
      return itemView(row);
    });
  }
}
