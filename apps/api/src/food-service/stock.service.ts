import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  allocateStock,
  orderConsumption,
  splitShortage,
  foodId,
  foodInt,
  foodLocal,
  foodObject,
  inventoryDelta,
  surplusUnitCost,
  milliOf,
  milliText,
  parseInventory,
  parseKitchenProduct,
  parseKitchenReceipt,
  parseWriteOff,
  parsePrepRecipe,
  parseProduction,
  prepCycle,
  prepNeed,
  prepUnitCost,
  stockCost,
  type Permission,
} from '@pms/domain';
import type { DbTx, KitchenProduct, KitchenStockLot, Prisma } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { foodMay, foodScope, foodTransaction, foodWritable, type FoodScope, BRANCH_STOCK_VERTICALS } from './scope';

/** Склад кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS). Записи сериализует замок филиала в foodTransaction. */
function parsed<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new BadRequestException(e instanceof Error ? e.message : 'Некорректный запрос');
  }
}
const day = (d: Date) => d.toISOString().slice(0, 10);
const live = (l: KitchenStockLot) => l.reversedAt === null && milliOf(l.remainingQty) > 0n;

function productView(p: KitchenProduct, lots: KitchenStockLot[]) {
  const mine = lots.filter((l) => l.productId === p.id && live(l));
  const onHand = mine.reduce((sum, l) => sum + milliOf(l.remainingQty), 0n);
  const value = mine.reduce((sum, l) => sum + stockCost(milliOf(l.remainingQty), p.unit, l.unitCost), 0n);
  const expiries = mine.map((l) => l.expiresOn).filter((d): d is Date => d !== null).map(day).sort();
  const minQty = milliOf(p.minQty);
  return {
    id: p.id,
    name: p.name,
    unit: p.unit,
    minQty: milliText(minQty),
    active: p.active,
    kind: p.kind,
    onHand: milliText(onHand),
    valueMinor: value.toString(),
    low: minQty > 0n && onHand < minQty,
    nearestExpiry: expiries[0] ?? null,
  };
}
function lotView(l: KitchenStockLot) {
  return {
    id: l.id,
    productId: l.productId,
    supplier: l.supplier,
    document: l.document,
    receivedOn: day(l.receivedOn),
    receivedQty: milliText(milliOf(l.receivedQty)),
    remainingQty: milliText(milliOf(l.remainingQty)),
    unitCostMinor: l.unitCost.toString(),
    expiresOn: l.expiresOn ? day(l.expiresOn) : null,
    reversed: l.reversedAt !== null,
    reversible: l.reversedAt === null && milliOf(l.remainingQty) === milliOf(l.receivedQty),
  };
}

@Injectable()
export class StockService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async write<T>(
    permission: Permission,
    fn: (tx: DbTx, s: FoodScope) => Promise<T>,
  ): Promise<T> {
    foodMay(permission);
    await foodWritable(this.prisma.db);
    const s = await foodScope(this.prisma.db, BRANCH_STOCK_VERTICALS);
    return foodTransaction(this.prisma, s, fn, BRANCH_STOCK_VERTICALS);
  }
  private async audit(tx: DbTx, s: FoodScope, id: string, action: string, after: Prisma.InputJsonObject) {
    await tx.auditLog.create({
      data: {
        organizationId: s.organizationId,
        userId: currentUserId(),
        entityType: 'kitchen_stock',
        entityId: id,
        action,
        after,
      },
    });
  }
  private async product(tx: DbTx, s: FoodScope, id: string, activeOnly = true) {
    const p = await tx.kitchenProduct.findFirst({
      where: { id, businessId: s.businessId, ...(activeOnly ? { active: true } : {}) },
    });
    if (!p) throw new NotFoundException('Расходник недоступен');
    return p;
  }
  private liveLots(tx: DbTx, s: FoodScope, productId: string) {
    return tx.kitchenStockLot.findMany({
      where: { locationId: s.locationId, productId, reversedAt: null, remainingQty: { gt: 0 } },
    });
  }

  /** Справочник бизнеса с остатком текущего филиала; полный список, ингредиентов у кухни сотни, не тысячи */
  async products() {
    foodMay('desk');
    const s = await foodScope(this.prisma.db, BRANCH_STOCK_VERTICALS);
    const [products, lots] = await Promise.all([
      this.prisma.db.kitchenProduct.findMany({
        where: { businessId: s.businessId },
        orderBy: { name: 'asc' },
        take: 2000,
      }),
      this.prisma.db.kitchenStockLot.findMany({
        where: { locationId: s.locationId, reversedAt: null, remainingQty: { gt: 0 } },
      }),
    ]);
    return { items: products.map((p) => productView(p, lots)) };
  }
  async createProduct(raw: unknown) {
    return this.write('property', async (tx, s) => {
      const b = parsed(() => parseKitchenProduct(raw));
      const p = await tx.kitchenProduct.create({
        data: {
          businessId: s.businessId,
          name: b.name!,
          unit: b.unit!,
          minQty: milliText(b.minQty ?? 0n),
          active: b.active ?? true,
          kind: b.kind ?? 'RAW',
        },
      });
      await this.audit(tx, s, p.id, 'kitchen.product.created', { name: p.name, unit: p.unit, kind: p.kind });
      return productView(p, []);
    });
  }
  async updateProduct(idRaw: string, raw: unknown) {
    return this.write('property', async (tx, s) => {
      const id = parsed(() => foodId(idRaw)),
        b = parsed(() => parseKitchenProduct(raw, true));
      const old = await this.product(tx, s, id, false);
      if (b.unit !== undefined && b.unit !== old.unit && (await tx.kitchenStockLot.count({ where: { productId: id } })) > 0)
        throw new ConflictException('Единицу нельзя сменить: по ингредиенту уже есть приходы');
      if (
        b.kind !== undefined &&
        b.kind !== old.kind &&
        ((await tx.kitchenStockLot.count({ where: { productId: id } })) > 0 ||
          (await tx.kitchenPrepRecipe.count({ where: { productId: id } })) > 0)
      )
        throw new ConflictException('Вид нельзя сменить: по продукту уже есть приходы или техкарта');
      const p = await tx.kitchenProduct.update({
        where: { id },
        data: {
          ...(b.name !== undefined ? { name: b.name } : {}),
          ...(b.unit !== undefined ? { unit: b.unit } : {}),
          ...(b.minQty !== undefined ? { minQty: milliText(b.minQty) } : {}),
          ...(b.active !== undefined ? { active: b.active } : {}),
          ...(b.kind !== undefined ? { kind: b.kind } : {}),
        },
      });
      await this.audit(tx, s, id, 'kitchen.product.updated', {
        name: p.name,
        unit: p.unit,
        minQty: p.minQty.toString(),
        active: p.active,
        kind: p.kind,
      });
      return productView(p, await this.liveLots(tx, s, id));
    });
  }

  async lots(query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db, BRANCH_STOCK_VERTICALS);
    const q = parsed(() => foodObject(query, ['productId']));
    const productId = parsed(() => foodId(q.productId));
    const rows = await this.prisma.db.kitchenStockLot.findMany({
      where: { locationId: s.locationId, productId },
      orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return { items: rows.map(lotView) };
  }
  /** Последние движения филиала (до 200), новые сверху: история, а не основание для расчёта */
  async movements(query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db, BRANCH_STOCK_VERTICALS);
    const q = parsed(() => foodObject(query, ['productId', 'limit']));
    const productId = q.productId === undefined ? undefined : parsed(() => foodId(q.productId));
    const limit =
      q.limit === undefined
        ? 200
        : parsed(() => foodInt(typeof q.limit === 'string' ? Number(q.limit) : q.limit, 1, 200));
    const rows = await this.prisma.db.kitchenStockMovement.findMany({
      where: { locationId: s.locationId, ...(productId ? { productId } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: { product: { select: { name: true, unit: true } } },
    });
    return {
      items: rows.map((m) => ({
        id: m.id,
        productId: m.productId,
        productName: m.product.name,
        unit: m.product.unit,
        lotId: m.lotId,
        kind: m.kind,
        qty: milliText(milliOf(m.qty)),
        costMinor: m.cost.toString(),
        reason: m.reason,
        createdAt: m.createdAt,
      })),
    };
  }

  /** Приход: каждая строка — партия и движение RECEIPT, всё одной транзакцией */
  async receipt(raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => parseKitchenReceipt(raw));
      const receivedOn = b.receivedOn ?? foodLocal(new Date(), s.timezone).date;
      const created = [];
      for (const line of b.lines) {
        const p = await this.product(tx, s, line.productId);
        const lot = await tx.kitchenStockLot.create({
          data: {
            locationId: s.locationId,
            productId: p.id,
            supplier: b.supplier,
            document: b.document,
            receivedOn: new Date(`${receivedOn}T00:00:00Z`),
            receivedQty: milliText(line.qty),
            remainingQty: milliText(line.qty),
            unitCost: line.unitCost,
            expiresOn: line.expiresOn ? new Date(`${line.expiresOn}T00:00:00Z`) : null,
            createdById: currentUserId() ?? null,
          },
        });
        await tx.kitchenStockMovement.create({
          data: {
            locationId: s.locationId,
            productId: p.id,
            lotId: lot.id,
            kind: 'RECEIPT',
            qty: milliText(line.qty),
            cost: stockCost(line.qty, p.unit, line.unitCost),
            reason: b.document ? `Приход ${b.document}` : 'Приход',
            createdById: currentUserId() ?? null,
          },
        });
        created.push(lot);
      }
      await this.audit(tx, s, created[0]!.id, 'kitchen.receipt.posted', {
        supplier: b.supplier,
        document: b.document,
        receivedOn,
        lots: created.map((l) => l.id),
      });
      return { items: created.map(lotView) };
    });
  }
  /** Сторно партии, пока из неё ничего не списано (инвариант 4 §34) */
  async reverseLot(idRaw: string) {
    return this.write('property', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const lot = await tx.kitchenStockLot.findFirst({ where: { id, locationId: s.locationId } });
      if (!lot) throw new NotFoundException('Партия не найдена');
      if (lot.reversedAt) throw new ConflictException('Приход уже сторнирован');
      if (milliOf(lot.remainingQty) !== milliOf(lot.receivedQty))
        throw new ConflictException('Из партии уже списано: сторно невозможно, оформите списание');
      const p = await this.product(tx, s, lot.productId, false);
      const qty = milliOf(lot.receivedQty);
      // партия заготовки (§62): ингредиенты возвращаются в свои партии, недостача гасится возвратом без партии
      const spent = await tx.kitchenStockMovement.findMany({
        where: { productionLotId: id, locationId: s.locationId, kind: { in: ['PRODUCTION_OUT', 'SHORTAGE'] } },
      });
      for (const m of spent) {
        const milli = -milliOf(m.qty);
        if (m.lotId) {
          const from = await tx.kitchenStockLot.findUniqueOrThrow({ where: { id: m.lotId } });
          await tx.kitchenStockLot.update({
            where: { id: m.lotId },
            data: { remainingQty: milliText(milliOf(from.remainingQty) + milli) },
          });
        }
        await tx.kitchenStockMovement.create({
          data: {
            locationId: s.locationId,
            productId: m.productId,
            lotId: m.lotId,
            productionLotId: id,
            kind: 'REVERSAL',
            qty: milliText(milli),
            cost: -m.cost,
            reason: `Сторно заготовки «${p.name}»`,
            createdById: currentUserId() ?? null,
          },
        });
      }
      const updated = await tx.kitchenStockLot.update({
        where: { id },
        data: { remainingQty: '0', reversedAt: new Date() },
      });
      await tx.kitchenStockMovement.create({
        data: {
          locationId: s.locationId,
          productId: p.id,
          lotId: id,
          kind: 'REVERSAL',
          qty: milliText(-qty),
          cost: -stockCost(qty, p.unit, lot.unitCost),
          reason: 'Сторно прихода',
          createdById: currentUserId() ?? null,
        },
      });
      await this.audit(tx, s, id, 'kitchen.receipt.reversed', { qty: milliText(qty) });
      return lotView(updated);
    });
  }
  private async consume(
    tx: DbTx,
    s: FoodScope,
    p: KitchenProduct,
    milli: bigint,
    kind: 'WRITE_OFF' | 'INVENTORY',
    reason: string,
  ) {
    const lots = await this.liveLots(tx, s, p.id);
    const { allocations, cost } = parsed(() =>
      allocateStock(
        lots.map((l) => ({
          id: l.id,
          receivedOn: day(l.receivedOn),
          createdAt: l.createdAt,
          remaining: milliOf(l.remainingQty),
          unitCost: l.unitCost,
        })),
        milli,
        p.unit,
      ),
    );
    for (const a of allocations) {
      const lot = lots.find((l) => l.id === a.lotId)!;
      await tx.kitchenStockLot.update({
        where: { id: a.lotId },
        data: { remainingQty: milliText(milliOf(lot.remainingQty) - a.milli) },
      });
      await tx.kitchenStockMovement.create({
        data: {
          locationId: s.locationId,
          productId: p.id,
          lotId: a.lotId,
          kind,
          qty: milliText(-a.milli),
          cost: -a.cost,
          reason,
          createdById: currentUserId() ?? null,
        },
      });
    }
    return cost;
  }
  /**
   * Списание по заказу при «Готово» (§38, Q-KITCHEN-5): одна транзакция с переходом статуса под замком заказа.
   * Не хватает остатка: списать весь остаток, разницу записать недостачей (Q-KITCHEN-6 А), кухню не останавливать.
   */
  async consumeForOrder(
    tx: DbTx,
    s: FoodScope,
    order: { id: string; number: number; items: Array<{ menuItemId: string | null; qty: number }> },
  ) {
    const menuIds = [...new Set(order.items.map((i) => i.menuItemId).filter((x): x is string => !!x))];
    if (!menuIds.length) return;
    const rows = await tx.menuItemIngredient.findMany({
      where: { menuItemId: { in: menuIds }, productId: { not: null } },
      select: { menuItemId: true, productId: true, normQty: true },
    });
    const need = orderConsumption(
      order.items.map((i) => ({
        qty: i.qty,
        ingredients: rows
          .filter((r) => r.menuItemId === i.menuItemId)
          .map((r) => ({ productId: r.productId, normQty: r.normQty.toString() })),
      })),
    );
    if (!need.size) return;
    const products = await tx.kitchenProduct.findMany({ where: { id: { in: [...need.keys()] } } });
    const reason = `Заказ №${order.number}`;
    for (const p of products) {
      const lots = await this.liveLots(tx, s, p.id);
      const available = lots.reduce((sum, l) => sum + milliOf(l.remainingQty), 0n);
      const { take, shortage } = splitShortage(available, need.get(p.id)!);
      if (take > 0n) {
        const { allocations } = allocateStock(
          lots.map((l) => ({
            id: l.id,
            receivedOn: day(l.receivedOn),
            createdAt: l.createdAt,
            remaining: milliOf(l.remainingQty),
            unitCost: l.unitCost,
          })),
          take,
          p.unit,
        );
        for (const a of allocations) {
          const lot = lots.find((l) => l.id === a.lotId)!;
          await tx.kitchenStockLot.update({
            where: { id: a.lotId },
            data: { remainingQty: milliText(milliOf(lot.remainingQty) - a.milli) },
          });
          await tx.kitchenStockMovement.create({
            data: {
              locationId: s.locationId,
              productId: p.id,
              lotId: a.lotId,
              orderId: order.id,
              kind: 'CONSUMPTION',
              qty: milliText(-a.milli),
              cost: -a.cost,
              reason,
              createdById: currentUserId() ?? null,
            },
          });
        }
      }
      if (shortage > 0n)
        await tx.kitchenStockMovement.create({
          data: {
            locationId: s.locationId,
            productId: p.id,
            orderId: order.id,
            kind: 'SHORTAGE',
            qty: milliText(-shortage),
            cost: 0n,
            reason: `${reason}: не хватило на складе`,
            createdById: currentUserId() ?? null,
          },
        });
    }
  }

  /** Отмена после «Готово» (§38): каждая партия получает списанное назад, недостача гасится возвратом без партии */
  async returnForOrder(tx: DbTx, s: FoodScope, order: { id: string; number: number }) {
    const spent = await tx.kitchenStockMovement.findMany({
      where: { orderId: order.id, locationId: s.locationId, kind: { in: ['CONSUMPTION', 'SHORTAGE'] } },
    });
    for (const m of spent) {
      const milli = -milliOf(m.qty);
      if (m.lotId) {
        const lot = await tx.kitchenStockLot.findUniqueOrThrow({ where: { id: m.lotId } });
        await tx.kitchenStockLot.update({
          where: { id: m.lotId },
          data: { remainingQty: milliText(milliOf(lot.remainingQty) + milli) },
        });
      }
      await tx.kitchenStockMovement.create({
        data: {
          locationId: s.locationId,
          productId: m.productId,
          lotId: m.lotId,
          orderId: order.id,
          kind: 'CONSUMPTION_RETURN',
          qty: milliText(milli),
          cost: -m.cost,
          reason: `Заказ №${order.number} отменён`,
          createdById: currentUserId() ?? null,
        },
      });
    }
  }

  /** Техкарта заготовки (§62): выход и ингредиенты с остатком филиала */
  async prepRecipe(idRaw: string) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db, BRANCH_STOCK_VERTICALS);
    const id = parsed(() => foodId(idRaw));
    const p = await this.prisma.db.kitchenProduct.findFirst({ where: { id, businessId: s.businessId } });
    if (!p) throw new NotFoundException('Расходник недоступен');
    const recipe = await this.prisma.db.kitchenPrepRecipe.findUnique({
      where: { productId: id },
      include: { lines: { orderBy: { sortOrder: 'asc' }, include: { ingredient: { select: { name: true, unit: true } } } } },
    });
    return {
      productId: id,
      kind: p.kind,
      unit: p.unit,
      yieldQty: recipe ? milliText(milliOf(recipe.yieldQty)) : null,
      lines: (recipe?.lines ?? []).map((l) => ({
        ingredientId: l.ingredientId,
        ingredientName: l.ingredient.name,
        unit: l.ingredient.unit,
        normQty: milliText(milliOf(l.normQty)),
      })),
    };
  }

  /** Сохранить техкарту заготовки целиком: только у вида PREP, ингредиенты своего бизнеса, без циклов */
  async setPrepRecipe(idRaw: string, raw: unknown) {
    await this.write('property', async (tx, s) => {
      const id = parsed(() => foodId(idRaw)),
        b = parsed(() => parsePrepRecipe(raw));
      const p = await this.product(tx, s, id, false);
      if (p.kind !== 'PREP') throw new ConflictException('Продукт не заготовка: техкарта есть только у заготовки');
      const ingredients = await tx.kitchenProduct.findMany({
        where: { id: { in: b.lines.map((l) => l.ingredientId) }, businessId: s.businessId },
      });
      if (ingredients.length !== b.lines.length) throw new NotFoundException('Ингредиент недоступен');
      const rows = await tx.kitchenPrepRecipeLine.findMany({
        where: { recipe: { product: { businessId: s.businessId } } },
        select: { productId: true, ingredientId: true },
      });
      const graph = new Map<string, string[]>();
      for (const r of rows) if (r.productId !== id) graph.set(r.productId, [...(graph.get(r.productId) ?? []), r.ingredientId]);
      if (prepCycle(graph, id, b.lines.map((l) => l.ingredientId)))
        throw new ConflictException('Заготовка не может входить сама в себя, даже по кругу через другую');
      await tx.kitchenPrepRecipe.upsert({
        where: { productId: id },
        create: { productId: id, yieldQty: milliText(b.yieldQty) },
        update: { yieldQty: milliText(b.yieldQty) },
      });
      await tx.kitchenPrepRecipeLine.deleteMany({ where: { productId: id } });
      await tx.kitchenPrepRecipeLine.createMany({
        data: b.lines.map((l, i) => ({ productId: id, ingredientId: l.ingredientId, normQty: milliText(l.normQty), sortOrder: i })),
      });
      await this.audit(tx, s, id, 'kitchen.prep.recipe_saved', {
        yieldQty: milliText(b.yieldQty),
        lines: b.lines.map((l) => ({ ingredientId: l.ingredientId, normQty: milliText(l.normQty) })),
      });
    });
    return this.prepRecipe(idRaw);
  }

  /**
   * «Приготовили» (§62, Q-KITCHEN-ALL-2 «а»): ингредиенты по техкарте списываются FIFO в эту же минуту, не хватает:
   * списать остаток, разницу недостачей (как §38); партия заготовки приходуется по себестоимости списанного.
   */
  async produce(raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => parseProduction(raw));
      const p = await this.product(tx, s, b.productId);
      if (p.kind !== 'PREP') throw new ConflictException('Продукт не заготовка: готовить можно только заготовку');
      const recipe = await tx.kitchenPrepRecipe.findUnique({ where: { productId: p.id }, include: { lines: true } });
      if (!recipe || recipe.lines.length === 0) throw new ConflictException('У заготовки нет техкарты: сначала укажите состав');
      const need = prepNeed(
        recipe.lines.map((l) => ({ ingredientId: l.ingredientId, normQty: milliOf(l.normQty) })),
        milliOf(recipe.yieldQty),
        b.qty,
      );
      const today = foodLocal(new Date(), s.timezone).date;
      // партия заводится до расхода, чтобы движения ингредиентов ссылались на неё; цена уточняется после расхода
      const lot = await tx.kitchenStockLot.create({
        data: {
          locationId: s.locationId,
          productId: p.id,
          document: 'Приготовлено',
          receivedOn: new Date(`${today}T00:00:00Z`),
          receivedQty: milliText(b.qty),
          remainingQty: milliText(b.qty),
          unitCost: 1n,
          expiresOn: b.expiresOn ? new Date(`${b.expiresOn}T00:00:00Z`) : null,
          createdById: currentUserId() ?? null,
        },
      });
      const reason = `Заготовка «${p.name}»`;
      let total = 0n;
      const shortages: Array<{ productId: string; name: string; qty: string }> = [];
      const ingredients = await tx.kitchenProduct.findMany({ where: { id: { in: [...need.keys()] } }, orderBy: { name: 'asc' } });
      for (const ing of ingredients) {
        const lots = await this.liveLots(tx, s, ing.id);
        const available = lots.reduce((sum, l) => sum + milliOf(l.remainingQty), 0n);
        const { take, shortage } = splitShortage(available, need.get(ing.id)!);
        if (take > 0n) {
          const { allocations } = allocateStock(
            lots.map((l) => ({
              id: l.id,
              receivedOn: day(l.receivedOn),
              createdAt: l.createdAt,
              remaining: milliOf(l.remainingQty),
              unitCost: l.unitCost,
            })),
            take,
            ing.unit,
          );
          for (const a of allocations) {
            const from = lots.find((l) => l.id === a.lotId)!;
            await tx.kitchenStockLot.update({
              where: { id: a.lotId },
              data: { remainingQty: milliText(milliOf(from.remainingQty) - a.milli) },
            });
            await tx.kitchenStockMovement.create({
              data: {
                locationId: s.locationId,
                productId: ing.id,
                lotId: a.lotId,
                productionLotId: lot.id,
                kind: 'PRODUCTION_OUT',
                qty: milliText(-a.milli),
                cost: -a.cost,
                reason,
                createdById: currentUserId() ?? null,
              },
            });
            total += a.cost;
          }
        }
        if (shortage > 0n) {
          shortages.push({ productId: ing.id, name: ing.name, qty: milliText(shortage) });
          await tx.kitchenStockMovement.create({
            data: {
              locationId: s.locationId,
              productId: ing.id,
              productionLotId: lot.id,
              kind: 'SHORTAGE',
              qty: milliText(-shortage),
              cost: 0n,
              reason: `${reason}: не хватило на складе`,
              createdById: currentUserId() ?? null,
            },
          });
        }
      }
      const unitCost = prepUnitCost(total, b.qty, p.unit);
      const priced = await tx.kitchenStockLot.update({ where: { id: lot.id }, data: { unitCost } });
      await tx.kitchenStockMovement.create({
        data: {
          locationId: s.locationId,
          productId: p.id,
          lotId: lot.id,
          kind: 'PRODUCTION_IN',
          qty: milliText(b.qty),
          cost: total,
          reason: 'Приготовлено',
          createdById: currentUserId() ?? null,
        },
      });
      await this.audit(tx, s, p.id, 'kitchen.prep.produced', {
        lot: lot.id,
        qty: milliText(b.qty),
        cost: total.toString(),
        shortages: shortages.map((x) => ({ productId: x.productId, qty: x.qty })),
      });
      return { lot: lotView(priced), costMinor: total.toString(), shortages };
    });
  }

  async writeOff(raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => parseWriteOff(raw));
      const p = await this.product(tx, s, b.productId, false);
      const cost = await this.consume(tx, s, p, b.qty, 'WRITE_OFF', b.reason);
      await this.audit(tx, s, p.id, 'kitchen.write_off', {
        qty: milliText(b.qty),
        cost: cost.toString(),
        reason: b.reason,
      });
      return productView(p, await this.liveLots(tx, s, p.id));
    });
  }
  /** Инвентаризация: недостача списывается FIFO, излишек приходуется по средней остатка (Q-KITCHEN-9, ADR-175) */
  async inventory(raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => parseInventory(raw));
      const p = await this.product(tx, s, b.productId, false);
      const lots = await this.liveLots(tx, s, p.id);
      const onHand = lots.reduce((sum, l) => sum + milliOf(l.remainingQty), 0n);
      const delta = inventoryDelta(onHand, b.actualQty);
      if (delta.kind === 'surplus') {
        const unitCost =
          b.unitCost ?? surplusUnitCost(lots.map((l) => ({ remaining: milliOf(l.remainingQty), unitCost: l.unitCost })));
        if (unitCost === null)
          throw new ConflictException('На складе пусто: укажите цену излишка, по ней он будет принят');
        const lot = await tx.kitchenStockLot.create({
          data: {
            locationId: s.locationId,
            productId: p.id,
            document: 'Инвентаризация',
            receivedOn: new Date(`${foodLocal(new Date(), s.timezone).date}T00:00:00Z`),
            receivedQty: milliText(delta.milli),
            remainingQty: milliText(delta.milli),
            unitCost,
            createdById: currentUserId() ?? null,
          },
        });
        const cost = stockCost(delta.milli, p.unit, unitCost);
        await tx.kitchenStockMovement.create({
          data: {
            locationId: s.locationId,
            productId: p.id,
            lotId: lot.id,
            kind: 'INVENTORY',
            qty: milliText(delta.milli),
            cost,
            reason: b.reason ?? 'Инвентаризация: излишек',
            createdById: currentUserId() ?? null,
          },
        });
        await this.audit(tx, s, p.id, 'kitchen.inventory', {
          counted: milliText(b.actualQty),
          surplus: milliText(delta.milli),
          unitCost: unitCost.toString(),
          cost: cost.toString(),
          manualPrice: b.unitCost !== null,
        });
      }
      if (delta.kind === 'shortage') {
        const cost = await this.consume(tx, s, p, delta.milli, 'INVENTORY', b.reason ?? 'Инвентаризация');
        await this.audit(tx, s, p.id, 'kitchen.inventory', {
          counted: milliText(b.actualQty),
          shortage: milliText(delta.milli),
          cost: cost.toString(),
        });
      }
      return productView(p, await this.liveLots(tx, s, p.id));
    });
  }
}
