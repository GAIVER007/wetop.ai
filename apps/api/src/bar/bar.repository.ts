import 'reflect-metadata';
import { createHotelCash } from '../finance/hotel-cash';
import { FolioClosedError, lockOpenFolios } from '@pms/database';
/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Client in this dirty tree is stale; remove after the shared generate step. */
import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { allocateFifo, enabledPaymentMethods, foodCashBalances, foodLocal, LUXX_APARTS_PROPERTY, resolvePaymentMethodSettings, salePriceFromMarkup, surplusUnitCost, zonedStartOfDay } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyRef } from '../database/property-ref';
import { currentLocationId, currentOrganizationId, currentVertical } from '../auth/request-context';
import { growthPercent, monthBounds, shiftDate } from './bar-period';
import { auditUserId } from '../accounts/actor';
import { assertBeautyOperation, runWithBeautyWriteAuthorization } from '../beauty/access';

export interface BarReceiptInput {
  supplierId: string;
  documentNumber: string;
  documentDate: string;
  receivedDate: string;
  currency: string;
  note: string | null;
  lines: Array<{ productId: string; quantityUnits: bigint; unitCostMinor: bigint; markupBasis: bigint }>;
}

export interface BarCategoryInput {
  name: string;
  defaultMarkupBasis: number;
}

export interface BarProductInput {
  code: string;
  name: string;
  categoryId: string | null;
  barcode: string | null;
  unitsPerPackage: number;
  markupBasis: number | null;
  salePriceMinor: bigint;
  minimumStockUnits: bigint;
}

/** Правка карточки товара (ADR-157): без кода, цены и архива, у них свои маршруты и правила */
export interface BarProductPatch {
  name: string;
  categoryId: string | null;
  barcode: string | null;
  unitsPerPackage: number;
  markupBasis: number | null;
  minimumStockUnits: bigint;
}

export interface BarSupplierInput {
  name: string;
  phone: string | null;
  email: string | null;
  details: string | null;
}
export interface BarRetailSaleInput { productId: string; quantityUnits: bigint; method: string; idempotencyKey: string }
export interface BarFolioSaleInput { folioId: string; productId: string; quantityUnits: bigint; idempotencyKey: string }
export interface BarWriteOffInput { productId: string; quantityUnits: bigint; reason: string }
export interface BarSupplierPaymentInput { amountMinor: bigint; method: string; note: string | null; /** ключ повтора (§50, ADR-186 M6) */ idempotencyKey: string }
export interface BarInventoryCountInput { productId: string; actualUnits: bigint; reason: string; /** цена излишка вручную, тиын за шт (ADR-175) */ unitCostMinor: bigint | null }

export interface BarRepository {
  categories(): Promise<unknown[]>;
  createCategory(input: BarCategoryInput): Promise<unknown>;
  setCategoryActive(id: string, active: boolean): Promise<unknown | null>;
  products(): Promise<unknown[]>;
  createProduct(input: BarProductInput): Promise<unknown>;
  setProductActive(id: string, active: boolean): Promise<unknown | null>;
  setProductPrice(id: string, salePriceMinor: bigint): Promise<unknown | null>;
  updateProduct(id: string, patch: BarProductPatch): Promise<unknown | null>;
  suppliers(): Promise<unknown[]>;
  createSupplier(input: BarSupplierInput): Promise<unknown>;
  setSupplierActive(id: string, active: boolean): Promise<unknown | null>;
  receipts(): Promise<unknown[]>;
  stock(): Promise<unknown[]>;
  sales(): Promise<unknown[]>;
  folios(): Promise<unknown[]>;
  movements(): Promise<unknown[]>;
  report(): Promise<unknown>;
  /** Включённые способы объекта бара в порядке настройки (§21.6); `null` у бара без объекта: настройки нет */
  enabledPaymentMethods(): Promise<string[] | null>;
  sellRetail(input: BarRetailSaleInput): Promise<{ kind: 'not_found' | 'no_cash' } | { kind: 'insufficient_stock'; availableUnits: bigint } | { kind: 'posted'; id: string; status: 'POSTED' | 'REVERSED'; revenueMinor: string; costMinor: string }>;
  sellToFolio(input: BarFolioSaleInput): Promise<{ kind: 'folio_not_found' | 'product_not_found' | 'no_folio' } | { kind: 'insufficient_stock'; availableUnits: bigint } | { kind: 'posted'; id: string; status: 'POSTED' | 'REVERSED'; chargeId: string; revenueMinor: string; costMinor: string }>;
  reverseSale(id: string, restock: boolean, reason: string): Promise<{ kind: 'not_found' | 'already_reversed' } | { kind: 'reversed'; id: string; status: 'REVERSED'; restocked: boolean }>;
  writeOff(input: BarWriteOffInput): Promise<{ kind: 'not_found' } | { kind: 'insufficient_stock'; availableUnits: bigint } | { kind: 'posted'; id: string; movementsCreated: number; costMinor: string }>;
  payReceipt(id: string, input: BarSupplierPaymentInput): Promise<{ kind: 'not_found' | 'not_posted' | 'no_cash' } | { kind: 'overpayment'; dueAmount: bigint } | { kind: 'insufficient_cash'; available: bigint } | { kind: 'paid'; id: string; receiptId: string; paidAmount: string; dueAmount: string }>;
  inventoryCount(input: BarInventoryCountInput): Promise<{ kind: 'not_found' } | { kind: 'surplus_requires_cost'; systemUnits: bigint } | { kind: 'adjusted'; id: string; systemUnits: string; actualUnits: string; differenceUnits: string; costMinor: string }>;
  createReceipt(input: BarReceiptInput): Promise<unknown>;
  postReceipt(id: string): Promise<{ kind: 'not_found' | 'already_posted' } | { kind: 'posted'; id: string; status: 'POSTED'; lotsCreated: number; movementsCreated: number; pricesUpdated: number }>;
}
export const BAR_REPOSITORY = Symbol('BAR_REPOSITORY');

@Injectable()
export class PrismaBarRepository implements BarRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  /**
   * Область бара (§44, ADR-178): выбранный филиал любого направления; у гостиницы ещё её объект (счёт гостя и касса
   * гостиницы). Без выбранного филиала прежний гостиничный путь через объект организации.
   */
  private async scope(): Promise<{ locationId: string; propertyId: string | null; vertical: string; timezone: string; currency: string }> {
    const chosen = currentLocationId();
    if (chosen) {
      const organizationId = currentOrganizationId();
      const location = await this.prisma.db.location.findFirst({
        where: { id: chosen, status: 'ACTIVE', business: { status: 'ACTIVE', ...(organizationId ? { organizationId } : {}) } },
        select: { id: true, timezone: true, currency: true, business: { select: { vertical: true } }, property: { select: { id: true } } },
      });
      if (!location) throw new ForbiddenException('Выберите доступный филиал');
      return { locationId: location.id, propertyId: location.property?.id ?? null, vertical: location.business.vertical, timezone: location.timezone, currency: location.currency };
    }
    if (currentVertical() && currentVertical() !== 'HOSPITALITY')
      throw new ForbiddenException('Выберите доступный филиал');
    const ref = await propertyRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const property = await this.prisma.db.property.findUniqueOrThrow({ where: { id: ref.id }, select: { locationId: true, currency: true } });
    return { locationId: property.locationId, propertyId: ref.id, vertical: 'HOSPITALITY', timezone: ref.timezone, currency: property.currency };
  }
  /** Способы оплаты объекта (§21.6, ADR-186): у бара салона и ресторана объекта нет, настройка к ним не относится */
  async enabledPaymentMethods(): Promise<string[] | null> {
    const { propertyId } = await this.scope();
    if (!propertyId) return null;
    const rows = await this.prisma.db.paymentMethodSetting.findMany({
      where: { propertyId },
      orderBy: { sortOrder: 'asc' },
      select: { method: true, enabled: true, sortOrder: true },
    });
    return enabledPaymentMethods(resolvePaymentMethodSettings(rows));
  }
  /** Остатки кассы ресторана по способам (§35, §45): тот же расчёт, что у самой кассы */
  private async restaurantBalances(tx: any, locationId: string) {
    const [payments, ops] = await Promise.all([
      tx.restaurantPayment.groupBy({ by: ['method'], where: { locationId, status: 'COMPLETED' }, _sum: { amount: true } }),
      tx.restaurantCashOperation.groupBy({ by: ['kind', 'method', 'methodTo'], where: { locationId, status: 'COMPLETED' }, _sum: { amount: true } }),
    ]);
    return foodCashBalances(
      payments.map((p: any) => ({ method: p.method, amount: p._sum.amount ?? 0n, status: 'COMPLETED' as const })),
      ops.map((o: any) => ({ kind: o.kind, method: o.method, methodTo: o.methodTo, amount: o._sum.amount ?? 0n, status: 'COMPLETED' as const })),
    ) as Record<string, bigint>;
  }
  /** Валюта бара это валюта филиала (D-CUR, §44): строка блокируется на время денежной команды */
  private async currency(tx: any, locationId: string): Promise<string> {
    const rows = await tx.$queryRaw`SELECT currency FROM locations WHERE id = ${locationId}::uuid FOR SHARE`;
    if (!rows[0]) throw new ConflictException('Филиал не настроен');
    return rows[0].currency;
  }
  private compatible(actual: string, expected: string) {
    if (actual !== expected) throw new ConflictException({ code: 'BAR_CURRENCY_MISMATCH', message: 'Валюта операции несовместима с валютой объекта. Пересчет без утвержденного курса запрещен.' });
  }
  private async costSources(tx: any, locationId: string, currency: string, productId: string | null = null) {
    const mismatches = await tx.$queryRaw`SELECT DISTINCT r.id, r.currency FROM bar_receipts r
      JOIN bar_receipt_lines l ON l.receipt_id = r.id
      WHERE r.location_id = ${locationId}::uuid AND r.status = 'POSTED' AND r.currency <> ${currency}
        AND (${productId}::uuid IS NULL OR l.product_id = ${productId}::uuid) LIMIT 1`;
    if (mismatches.length) throw new ConflictException({ code: 'BAR_MIXED_CURRENCY_HISTORY', message: 'История закупок содержит несовместимую валюту. Денежный расчет требует отдельной сверки.' });
  }
  /** Оплата поставщику уменьшает долг, только пока её операция в кассе завершена: гостиничная или ресторанная (§45) */
  private static readonly COMPLETED_PAYMENTS = { OR: [{ cashOperation: { status: 'COMPLETED' } }, { restaurantCashOperation: { status: 'COMPLETED' } }] };
  async categories() {
    return (this.prisma.db as any).barCategory.findMany({ where: { locationId: (await this.scope()).locationId }, orderBy: { name: 'asc' } });
  }
  async createCategory(input: BarCategoryInput) {
    const { propertyId, locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async()=>{
      const row = await (tx as any).barCategory.create({ data: { propertyId, locationId, ...input } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_category', entityId: row.id, action: 'bar.category.created', after: { name: row.name, defaultMarkupBasis: row.defaultMarkupBasis } } });
      return row;
    }));
  }
  async setCategoryActive(id: string, active: boolean) {
    const { locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async()=>{
      const existing = await (tx as any).barCategory.findFirst({ where: { id, locationId } });
      if (!existing) return null;
      const row = await (tx as any).barCategory.update({ where: { id }, data: { active } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_category', entityId: id, action: 'bar.category.active_changed', after: { active } } });
      return row;
    }));
  }
  async products() {
    const rows = await (this.prisma.db as any).barProduct.findMany({ where: { locationId: (await this.scope()).locationId }, include: { category: true }, orderBy: { name: 'asc' } });
    return rows.map((row: any) => ({ ...row, salePrice: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString() }));
  }
  /** N6 (ADR-186): архивная категория остаётся у прежних товаров, новые в неё не попадают */
  private async activeCategory(db:any, locationId: string, categoryId: string | null, keep: string | null = null) {
    if (!categoryId || categoryId === keep) return;
    const category = await db.barCategory.findFirst({ where: { id: categoryId, locationId } });
    if (!category) throw new ConflictException('Категория недоступна в этом объекте');
    if (!category.active) throw new ConflictException('Категория в архиве: выберите действующую или верните её из архива');
  }
  async createProduct(input: BarProductInput) {
    const { propertyId, locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async()=>{
      await this.activeCategory(tx,locationId, input.categoryId);
      const row = await (tx as any).barProduct.create({ data: {
        propertyId, locationId, code: input.code, name: input.name, categoryId: input.categoryId, barcode: input.barcode,
        unitsPerPackage: input.unitsPerPackage, markupBasis: input.markupBasis, salePrice: input.salePriceMinor,
        minimumStockUnits: input.minimumStockUnits,
      } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_product', entityId: row.id, action: 'bar.product.created', after: { code: row.code, name: row.name } } });
      return { ...row, salePrice: row.salePrice.toString(), salePriceMinor: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString() };
    }));
  }
  async setProductActive(id: string, active: boolean) {
    const { locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async()=>{
      const existing = await (tx as any).barProduct.findFirst({ where: { id, locationId } });
      if (!existing) return null;
      const row = await (tx as any).barProduct.update({ where: { id }, data: { active } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_product', entityId: id, action: 'bar.product.active_changed', after: { active } } });
      return { ...row, salePrice: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString() };
    }));
  }
  async updateProduct(id: string, patch: BarProductPatch) {
    const { locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async()=>{
      const existing = await (tx as any).barProduct.findFirst({ where: { id, locationId } });
      if (!existing) return null;
      await this.activeCategory(tx,locationId, patch.categoryId, existing.categoryId);
      const row = await (tx as any).barProduct.update({ where: { id }, data: {
        name: patch.name, categoryId: patch.categoryId, barcode: patch.barcode,
        unitsPerPackage: patch.unitsPerPackage, markupBasis: patch.markupBasis,
        minimumStockUnits: patch.minimumStockUnits,
      } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_product', entityId: id, action: 'bar.product.updated', before: { name: existing.name, barcode: existing.barcode, minimumStockUnits: existing.minimumStockUnits.toString() }, after: { name: row.name, barcode: row.barcode, minimumStockUnits: row.minimumStockUnits.toString() } } });
      return { ...row, salePrice: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString() };
    }));
  }
  async setProductPrice(id: string, salePriceMinor: bigint) {
    const { locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async()=>{
      const existing = await (tx as any).barProduct.findFirst({ where: { id, locationId } });
      if (!existing) return null;
      const row = await (tx as any).barProduct.update({ where: { id }, data: { salePrice: salePriceMinor } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_product', entityId: id, action: 'bar.product.price_changed', before: { salePrice: existing.salePrice.toString() }, after: { salePrice: salePriceMinor.toString() } } });
      return { ...row, salePrice: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString() };
    }));
  }
  async suppliers() {
    return (this.prisma.db as any).barSupplier.findMany({ where: { locationId: (await this.scope()).locationId }, orderBy: { name: 'asc' } });
  }
  async createSupplier(input: BarSupplierInput) {
    const { propertyId, locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async()=>{
      const row = await (tx as any).barSupplier.create({ data: { propertyId, locationId, ...input } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_supplier', entityId: row.id, action: 'bar.supplier.created', after: { name: row.name } } });
      return row;
    }));
  }
  async setSupplierActive(id: string, active: boolean) {
    const { locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async()=>{
      const existing = await (tx as any).barSupplier.findFirst({ where: { id, locationId } });
      if (!existing) return null;
      const row = await (tx as any).barSupplier.update({ where: { id }, data: { active } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_supplier', entityId: id, action: 'bar.supplier.active_changed', after: { active } } });
      return row;
    }));
  }
  async receipts() {
    const rows = await (this.prisma.db as any).barReceipt.findMany({
      where: { locationId: (await this.scope()).locationId }, include: { supplier: true, payments: { where: PrismaBarRepository.COMPLETED_PAYMENTS, select: { amount: true } }, _count: { select: { lines: true } } },
      orderBy: [{ receivedDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row: any) => {
      const paidAmount = row.payments.reduce((sum: bigint, payment: any) => sum + payment.amount, 0n);
      const receipt = { ...row };
      delete receipt.payments;
      return { ...receipt, totalAmount: row.totalAmount.toString(), paidAmount: paidAmount.toString(), dueAmount: (row.totalAmount - paidAmount).toString() };
    });
  }
  async stock() {
    const { locationId } = await this.scope();
    const currency = await this.currency(this.prisma.db, locationId);
    await this.costSources(this.prisma.db, locationId, currency);
    const rows = await (this.prisma.db as any).barProduct.findMany({
      where: { locationId },
      include: {
        category: true,
        lots: { where: { remainingUnits: { gt: 0 } }, select: { remainingUnits: true, unitCost: true, expiresOn: true } },
        // последний проведённый приход товара (ADR-157, макет): поставщик, цена закупки и дата; у товара своего поставщика в модели нет
        receiptLines: {
          where: { receipt: { status: 'POSTED' } }, orderBy: { receipt: { receivedDate: 'desc' } }, take: 1,
          select: { unitCost: true, receipt: { select: { receivedDate: true, supplier: { select: { id: true, name: true } } } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((row: any) => {
      const available = row.lots.reduce((sum: bigint, lot: any) => sum + BigInt(lot.remainingUnits), 0n);
      const stockCost = row.lots.reduce((sum: bigint, lot: any) => sum + BigInt(lot.remainingUnits) * BigInt(lot.unitCost), 0n);
      const expiries = row.lots.map((lot: any) => lot.expiresOn).filter(Boolean).map((day: Date) => day.toISOString().slice(0, 10)).sort();
      const last = row.receiptLines[0] ?? null;
      const product = { ...row };
      delete product.lots;
      delete product.receiptLines;
      return {
        ...product, currency, salePrice: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString(),
        availableUnits: available.toString(), stockCostMinor: stockCost.toString(),
        lastUnitCostMinor: last ? last.unitCost.toString() : null,
        lastReceivedDate: last ? last.receipt.receivedDate.toISOString().slice(0, 10) : null,
        lastSupplier: last ? last.receipt.supplier : null,
        nearestExpiry: expiries[0] ?? null,
      };
    });
  }
  async sales() {
    const rows = await (this.prisma.db as any).barSale.findMany({ where: { locationId: (await this.scope()).locationId }, include: { lines: { include: { product: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((row: any) => ({ ...row, totalRevenue: row.totalRevenue.toString(), totalCost: row.totalCost.toString(), lines: row.lines.map((line: any) => ({ ...line, quantityUnits: line.quantityUnits.toString(), salePrice: line.salePrice.toString(), revenue: line.revenue.toString(), cost: line.cost.toString(), product: { ...line.product, salePrice: line.product.salePrice.toString(), minimumStockUnits: line.product.minimumStockUnits.toString() } })) }));
  }
  async folios() {
    const { propertyId } = await this.scope();
    // счёт гостя есть только у гостиницы
    if (!propertyId) return [];
    const rows = await (this.prisma.db as any).folio.findMany({
      where: { status: 'OPEN', reservationItem: { reservation: { propertyId } } },
      include: { reservationItem: { include: { reservation: { include: { primaryGuest: true } }, allocations: { include: { inventoryUnit: true }, orderBy: { startDate: 'desc' }, take: 1 } } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    return rows.map((row: any) => ({ id: row.id, confirmationNumber: row.reservationItem.reservation.confirmationNumber, guestName: row.reservationItem.reservation.primaryGuest ? `${row.reservationItem.reservation.primaryGuest.firstName} ${row.reservationItem.reservation.primaryGuest.lastName}` : 'Гость не указан', unitCode: row.reservationItem.allocations[0]?.inventoryUnit?.code ?? null }));
  }
  async movements() {
    const { locationId } = await this.scope();
    const currency = await this.currency(this.prisma.db, locationId);
    await this.costSources(this.prisma.db, locationId, currency);
    const rows = await (this.prisma.db as any).barStockMovement.findMany({ where: { locationId }, include: { product: true }, orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map((row: any) => ({ ...row, units: row.units.toString(), unitCost: row.unitCost.toString(), product: { ...row.product, salePrice: row.product.salePrice.toString(), minimumStockUnits: row.product.minimumStockUnits.toString() }, amountMinor: (BigInt(row.units < 0n ? -row.units : row.units) * BigInt(row.unitCost)).toString() }));
  }
  async report() {
    const { locationId, timezone } = await this.scope();
    const currency = await this.currency(this.prisma.db, locationId);
    await this.costSources(this.prisma.db, locationId, currency);
    const today = foodLocal(new Date(), timezone).date;
    const { prevMonthStart, monthStart, nextMonthStart } = monthBounds(today);
    // границы месяца для продаж: начало суток в поясе объекта, а не по UTC (AGENTS.md §13)
    const at = (day: string) => zonedStartOfDay(day, timezone);
    const popularFrom = at(shiftDate(today, -29));
    const [receipts, sales, lots, writeOffs, popularLines, reversed, returned] = await Promise.all([
      (this.prisma.db as any).barReceipt.findMany({ where: { locationId, status: 'POSTED' }, include: { payments: { where: PrismaBarRepository.COMPLETED_PAYMENTS, select: { amount: true } } } }),
      (this.prisma.db as any).barSale.findMany({ where: { locationId, status: 'POSTED' }, select: { totalRevenue: true, totalCost: true, createdAt: true, currency: true } }),
      (this.prisma.db as any).barStockLot.findMany({ where: { locationId, remainingUnits: { gt: 0 } }, select: { remainingUnits: true, unitCost: true } }),
      (this.prisma.db as any).barStockMovement.findMany({ where: { locationId, kind: 'WRITE_OFF' }, select: { units: true, unitCost: true } }),
      (this.prisma.db as any).barSaleLine.findMany({
        where: { sale: { locationId, status: 'POSTED', createdAt: { gte: popularFrom } } },
        select: { productId: true, quantityUnits: true, product: { select: { name: true } } },
      }),
      // M9 (ADR-186): отменённая без возврата на склад продажа это потеря товара, её себестоимость идёт в списание
      (this.prisma.db as any).barSale.findMany({ where: { locationId, status: 'REVERSED' }, select: { id: true, totalCost: true, currency: true } }),
      (this.prisma.db as any).barStockMovement.findMany({ where: { locationId, sourceType: 'BAR_SALE_RETURN' }, select: { sourceId: true }, distinct: ['sourceId'] }),
    ]);
    for (const sale of [...sales, ...reversed]) this.compatible(sale.currency, currency);
    const restocked = new Set(returned.map((row: any) => row.sourceId));
    const lostCost = reversed.filter((sale: any) => !restocked.has(sale.id)).reduce((sum: bigint, sale: any) => sum + BigInt(sale.totalCost), 0n);
    const inMonth = (from: string, to: string) => (day: string) => day >= from && day < to;
    const thisMonth = inMonth(monthStart, nextMonthStart);
    const lastMonth = inMonth(prevMonthStart, monthStart);
    const receiptDay = (row: any) => row.receivedDate.toISOString().slice(0, 10);
    const sumReceipts = (match: (day: string) => boolean) =>
      receipts.filter((row: any) => match(receiptDay(row))).reduce((sum: bigint, row: any) => sum + BigInt(row.totalAmount), 0n);
    const saleIn = (from: Date, to: Date) => sales.filter((row: any) => row.createdAt >= from && row.createdAt < to);
    const salesMonth = saleIn(at(monthStart), at(nextMonthStart));
    const salesPrev = saleIn(at(prevMonthStart), at(monthStart));
    const revenueOf = (rows: any[]) => rows.reduce((sum: bigint, row: any) => sum + BigInt(row.totalRevenue), 0n);
    const costOf = (rows: any[]) => rows.reduce((sum: bigint, row: any) => sum + BigInt(row.totalCost), 0n);
    const popularMap = new Map<string, { productId: string; name: string; units: bigint }>();
    for (const line of popularLines) {
      const entry = popularMap.get(line.productId) ?? { productId: line.productId, name: line.product.name, units: 0n };
      entry.units += BigInt(line.quantityUnits);
      popularMap.set(line.productId, entry);
    }
    const popular = [...popularMap.values()]
      .sort((a, b) => (a.units === b.units ? a.name.localeCompare(b.name, 'ru') : a.units > b.units ? -1 : 1))
      .slice(0, 5)
      .map((entry) => ({ productId: entry.productId, name: entry.name, units: entry.units.toString() }));
    const month = {
      monthStart,
      purchasesMinor: sumReceipts(thisMonth).toString(),
      purchasesPrevMinor: sumReceipts(lastMonth).toString(),
      revenueMinor: revenueOf(salesMonth).toString(),
      revenuePrevMinor: revenueOf(salesPrev).toString(),
      grossProfitMinor: (revenueOf(salesMonth) - costOf(salesMonth)).toString(),
      purchasesGrowth: growthPercent(sumReceipts(thisMonth), sumReceipts(lastMonth)),
      revenueGrowth: growthPercent(revenueOf(salesMonth), revenueOf(salesPrev)),
    };
    const purchases = receipts.reduce((sum: bigint, row: any) => sum + BigInt(row.totalAmount), 0n);
    const paid = receipts.reduce((sum: bigint, row: any) => sum + row.payments.reduce((part: bigint, payment: any) => part + BigInt(payment.amount), 0n), 0n);
    const revenue = sales.reduce((sum: bigint, row: any) => sum + BigInt(row.totalRevenue), 0n);
    const cost = sales.reduce((sum: bigint, row: any) => sum + BigInt(row.totalCost), 0n);
    const stockCost = lots.reduce((sum: bigint, row: any) => sum + BigInt(row.remainingUnits) * BigInt(row.unitCost), 0n);
    const writeOff = lostCost + writeOffs.reduce((sum: bigint, row: any) => sum + (BigInt(row.units) < 0n ? -BigInt(row.units) : BigInt(row.units)) * BigInt(row.unitCost), 0n);
    return { currency, purchasesMinor: purchases.toString(), supplierPaidMinor: paid.toString(), revenueMinor: revenue.toString(), costMinor: cost.toString(), grossProfitMinor: (revenue - cost).toString(), writeOffMinor: writeOff.toString(), stockCostMinor: stockCost.toString(), supplierDebtMinor: (purchases - paid).toString(), month, popular };
  }
  /** Повтор продажи тем же ключом (D-KEY): ключ уникален по филиалу (§44), исходная операция возвращается как есть */
  private async replaySale(tx: any, locationId: string, input: BarRetailSaleInput | BarFolioSaleInput) {
    const sale = await tx.barSale.findFirst({ where: { locationId, idempotencyKey: input.idempotencyKey }, include: { lines: true, cashOperation: { select: { method: true } }, restaurantCashOperation: { select: { method: true } } } });
    if (!sale) return null;
    const folio = 'folioId' in input;
    const line = sale.lines[0];
    const cashMethod = sale.cashOperation?.method ?? sale.restaurantCashOperation?.method;
    const paidByCash = Boolean(sale.cashOperationId || sale.restaurantCashOperationId);
    if (sale.lines.length !== 1 || line.productId !== input.productId.toLowerCase() || line.quantityUnits !== input.quantityUnits ||
      (folio ? sale.folioId !== input.folioId.toLowerCase() || !sale.chargeId || paidByCash : sale.folioId !== null || !paidByCash || cashMethod !== input.method))
      throw new ConflictException('Ключ повтора уже использован для другой продажи');
    return { kind: 'posted' as const, id: sale.id, status: sale.status as 'POSTED' | 'REVERSED', ...(folio ? { chargeId: sale.chargeId as string } : {}), revenueMinor: sale.totalRevenue.toString(), costMinor: sale.totalCost.toString() };
  }
  private async saleTransaction<T>(locationId: string, input: BarRetailSaleInput | BarFolioSaleInput, run: (tx: any) => Promise<T>): Promise<T> {
    try { return await this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,()=>run(tx))); }
    catch (error) {
      const e = error as { code?: string; meta?: { modelName?: string; target?: string[]; driverAdapterError?: { cause?: { constraint?: { index?: string } } } } };
      const target = e.meta?.target;
      // Ключ продажи уникален по филиалу (§44, миграция 102 переименовала индекс property_id → location_id)
      const sameKey = e.meta?.driverAdapterError?.cause?.constraint?.index === 'bar_sales_location_id_idempotency_key_key' ||
        (e.meta?.modelName === 'BarSale' && Array.isArray(target) && target.length === 2 && target.includes('location_id') && target.includes('idempotency_key'));
      if (e.code !== 'P2002' || !sameKey) throw error;
      // The failed transaction has rolled back before this scoped reread.
      const replay = await this.prisma.db.$transaction(tx => this.replaySale(tx, locationId, input));
      if (!replay) throw error;
      return replay as T;
    }
  }
  async sellRetail(input: BarRetailSaleInput) {
    const { propertyId, locationId, vertical } = await this.scope();
    // деньги бара: касса гостиницы или касса филиала ресторана и салона (§45, §48)
    if (!propertyId && vertical !== 'FOOD_SERVICE' && vertical !== 'BEAUTY') return { kind: 'no_cash' as const };
    return this.saleTransaction(locationId, input, async (tx) => {
      // касса ресторана: одна запись за раз на филиал, как у самой кассы
      if (!propertyId) await tx.$queryRaw`SELECT id FROM locations WHERE id = ${locationId}::uuid FOR UPDATE`;
      const replay = await this.replaySale(tx, locationId, input);
      if (replay) return replay;
      const product = await (tx as any).barProduct.findFirst({ where: { id: input.productId, locationId, active: true } });
      if (!product) return { kind: 'not_found' as const };
      const currency = await this.currency(tx, locationId);
      await this.costSources(tx, locationId, currency, product.id);
      await tx.$queryRaw`SELECT id FROM bar_stock_lots WHERE location_id = ${locationId}::uuid AND product_id = ${input.productId}::uuid AND remaining_units > 0 ORDER BY received_at, id FOR UPDATE`;
      const lockedReplay = await this.replaySale(tx, locationId, input);
      if (lockedReplay) return lockedReplay;
      const lots = await (tx as any).barStockLot.findMany({ where: { locationId, productId: input.productId, remainingUnits: { gt: 0 } }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] });
      let fifo;
      try {
        fifo = allocateFifo(lots.map((lot: any) => ({ lotId: lot.id, receivedAt: lot.receivedAt.toISOString(), availableUnits: lot.remainingUnits, unitCostMinor: lot.unitCost })), input.quantityUnits);
      } catch {
        return { kind: 'insufficient_stock' as const, availableUnits: lots.reduce((sum: bigint, lot: any) => sum + lot.remainingUnits, 0n) };
      }
      const revenue = product.salePrice * input.quantityUnits;
      if (revenue > 9_223_372_036_854_775_807n || fifo.totalCostMinor > 9_223_372_036_854_775_807n) throw new BadRequestException('Сумма продажи превышает диапазон Int64');
      const note = `Бар: ${product.name}`;
      const cashLink = propertyId
        ? { cashOperationId: (await createHotelCash(tx, { propertyId, kind: 'INCOME', method: input.method as import('../finance/finance.repository').PaymentMethod, amount: revenue, note, createdById: auditUserId() })).id }
        : { restaurantCashOperationId: (await (tx as any).restaurantCashOperation.create({ data: { locationId, kind: 'INCOME', method: input.method, amount: revenue, currency, note, createdById: auditUserId() } })).id };
      const sale = await (tx as any).barSale.create({ data: { propertyId, locationId, ...cashLink, idempotencyKey: input.idempotencyKey, status: 'POSTED', currency, totalRevenue: revenue, totalCost: fifo.totalCostMinor, createdById: auditUserId(), lines: { create: [{ productId: product.id, quantityUnits: input.quantityUnits, salePrice: product.salePrice, revenue, cost: fifo.totalCostMinor }] } } });
      for (const allocation of fifo.allocations) {
        await (tx as any).barStockLot.update({ where: { id: allocation.lotId }, data: { remainingUnits: { decrement: allocation.units } } });
        await (tx as any).barStockMovement.create({ data: { propertyId, locationId, productId: product.id, lotId: allocation.lotId, kind: 'SALE', units: -allocation.units, unitCost: allocation.unitCostMinor, sourceType: 'BAR_SALE', sourceId: sale.id, createdById: auditUserId() } });
      }
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_sale', entityId: sale.id, action: 'bar.sale.posted', after: { quantityUnits: input.quantityUnits.toString(), revenue: revenue.toString(), cost: fifo.totalCostMinor.toString() } } });
      return { kind: 'posted' as const, id: sale.id, status: 'POSTED' as const, revenueMinor: revenue.toString(), costMinor: fifo.totalCostMinor.toString() };
    });
  }
  async sellToFolio(input: BarFolioSaleInput) {
    const { propertyId, locationId, timezone } = await this.scope();
    // счёт гостя есть только у гостиницы (§44)
    if (!propertyId) return { kind: 'no_folio' as const };
    // дата услуги: сегодня по часам объекта (docs/metrics.md §5, Q-292); без неё начисление выпадало из периодных отчётов
    const serviceDate = new Date(`${foodLocal(new Date(), timezone).date}T00:00:00Z`);
    return this.saleTransaction(locationId, input, async (tx) => {
      const replay = await this.replaySale(tx, locationId, input);
      if (replay) return { ...replay, chargeId: replay.chargeId! };
      await tx.$queryRaw`SELECT f.id FROM folios f JOIN reservation_items i ON i.id = f.reservation_item_id JOIN reservations r ON r.id = i.reservation_id WHERE f.id = ${input.folioId}::uuid AND r.property_id = ${propertyId}::uuid AND f.status = 'OPEN' FOR UPDATE OF f`;
      const folio = await (tx as any).folio.findFirst({ where: { id: input.folioId, status: 'OPEN', reservationItem: { reservation: { propertyId } } } });
      if (!folio) return { kind: 'folio_not_found' as const };
      const product = await (tx as any).barProduct.findFirst({ where: { id: input.productId, locationId, active: true } });
      if (!product) return { kind: 'product_not_found' as const };
      const currency = await this.currency(tx, locationId);
      await this.costSources(tx, locationId, currency, product.id);
      this.compatible(folio.currency, currency);
      await tx.$queryRaw`SELECT id FROM bar_stock_lots WHERE location_id = ${locationId}::uuid AND product_id = ${input.productId}::uuid AND remaining_units > 0 ORDER BY received_at, id FOR UPDATE`;
      const lockedReplay = await this.replaySale(tx, locationId, input);
      if (lockedReplay) return { ...lockedReplay, chargeId: lockedReplay.chargeId! };
      const lots = await (tx as any).barStockLot.findMany({ where: { locationId, productId: input.productId, remainingUnits: { gt: 0 } }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] });
      let fifo;
      try {
        fifo = allocateFifo(lots.map((lot: any) => ({ lotId: lot.id, receivedAt: lot.receivedAt.toISOString(), availableUnits: lot.remainingUnits, unitCostMinor: lot.unitCost })), input.quantityUnits);
      } catch {
        return { kind: 'insufficient_stock' as const, availableUnits: lots.reduce((sum: bigint, lot: any) => sum + BigInt(lot.remainingUnits), 0n) };
      }
      const revenue = BigInt(product.salePrice) * input.quantityUnits;
      if (revenue > 9_223_372_036_854_775_807n || fifo.totalCostMinor > 9_223_372_036_854_775_807n) throw new BadRequestException('Сумма продажи превышает диапазон Int64');
      const charge = await (tx as any).charge.create({ data: { folioId: folio.id, kind: 'SERVICE', description: `Бар: ${product.name}`, quantity: Number(input.quantityUnits), unitPrice: product.salePrice, amount: revenue, serviceDate, createdBy: auditUserId() } });
      const sale = await (tx as any).barSale.create({ data: { propertyId, locationId, folioId: folio.id, chargeId: charge.id, idempotencyKey: input.idempotencyKey, status: 'POSTED', currency: folio.currency, totalRevenue: revenue, totalCost: fifo.totalCostMinor, createdById: auditUserId(), lines: { create: [{ productId: product.id, quantityUnits: input.quantityUnits, salePrice: product.salePrice, revenue, cost: fifo.totalCostMinor }] } } });
      for (const allocation of fifo.allocations) {
        await (tx as any).barStockLot.update({ where: { id: allocation.lotId }, data: { remainingUnits: { decrement: allocation.units } } });
        await (tx as any).barStockMovement.create({ data: { propertyId, locationId, productId: product.id, lotId: allocation.lotId, kind: 'SALE', units: -allocation.units, unitCost: allocation.unitCostMinor, sourceType: 'BAR_SALE', sourceId: sale.id, createdById: auditUserId() } });
      }
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_sale', entityId: sale.id, action: 'bar.sale.folio_posted', after: { folioId: folio.id, chargeId: charge.id, quantityUnits: input.quantityUnits.toString(), revenue: revenue.toString(), cost: fifo.totalCostMinor.toString() } } });
      return { kind: 'posted' as const, id: sale.id, status: 'POSTED' as const, chargeId: charge.id, revenueMinor: revenue.toString(), costMinor: fifo.totalCostMinor.toString() };
    });
  }
  async reverseSale(id: string, restock: boolean, reason: string) {
    const { propertyId, locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async () => {
      if (restock && currentVertical() === 'BEAUTY')
        await assertBeautyOperation(tx, 'stock', 'update', { legacy: 'refunds' });
      await tx.$queryRaw`SELECT id FROM bar_sales WHERE id = ${id}::uuid AND location_id = ${locationId}::uuid FOR UPDATE`;
      const sale = await (tx as any).barSale.findFirst({ where: { id, locationId } });
      if (!sale) return { kind: 'not_found' as const };
      if (sale.status !== 'POSTED') return { kind: 'already_reversed' as const };
      if (sale.chargeId) {
        const charge = await tx.charge.findUniqueOrThrow({ where: { id: sale.chargeId }, select: { folioId: true } });
        try {
          await lockOpenFolios(tx, [charge.folioId]);
        } catch (e) {
          if (e instanceof FolioClosedError) throw new ConflictException(e.message);
          throw e;
        }
      }
      const movements = await (tx as any).barStockMovement.findMany({ where: { locationId, sourceType: 'BAR_SALE', sourceId: id, kind: 'SALE' } });
      if (restock) for (const movement of movements) {
        await tx.$queryRaw`SELECT id FROM bar_stock_lots WHERE id = ${movement.lotId}::uuid FOR UPDATE`;
        await (tx as any).barStockLot.update({ where: { id: movement.lotId }, data: { remainingUnits: { increment: -movement.units } } });
        await (tx as any).barStockMovement.create({ data: { propertyId, locationId, productId: movement.productId, lotId: movement.lotId, kind: 'SALE_RETURN', units: -movement.units, unitCost: movement.unitCost, sourceType: 'BAR_SALE_RETURN', sourceId: id, note: reason, createdById: auditUserId() } });
      }
      if (sale.cashOperationId) await (tx as any).cashOperation.update({ where: { id: sale.cashOperationId }, data: { status: 'VOIDED' } });
      if (sale.restaurantCashOperationId)
        await (tx as any).restaurantCashOperation.update({ where: { id: sale.restaurantCashOperationId }, data: { status: 'VOIDED', voidedAt: new Date(), voidedById: auditUserId() } });
      if (sale.chargeId) await (tx as any).charge.update({ where: { id: sale.chargeId }, data: { voidedAt: new Date() } });
      await (tx as any).barSale.update({ where: { id }, data: { status: 'REVERSED', reversedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_sale', entityId: id, action: 'bar.sale.reversed', after: { restock, reason } } });
      return { kind: 'reversed' as const, id, status: 'REVERSED' as const, restocked: restock };
    }));
  }
  async writeOff(input: BarWriteOffInput) {
    const { propertyId, locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async () => {
      const product = await (tx as any).barProduct.findFirst({ where: { id: input.productId, locationId, active: true } });
      if (!product) return { kind: 'not_found' as const };
      const currency = await this.currency(tx, locationId);
      await this.costSources(tx, locationId, currency, product.id);
      await tx.$queryRaw`SELECT id FROM bar_stock_lots WHERE location_id = ${locationId}::uuid AND product_id = ${input.productId}::uuid AND remaining_units > 0 ORDER BY received_at, id FOR UPDATE`;
      const lots = await (tx as any).barStockLot.findMany({ where: { locationId, productId: input.productId, remainingUnits: { gt: 0 } }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] });
      let fifo;
      try {
        fifo = allocateFifo(lots.map((lot: any) => ({ lotId: lot.id, receivedAt: lot.receivedAt.toISOString(), availableUnits: lot.remainingUnits, unitCostMinor: lot.unitCost })), input.quantityUnits);
      } catch {
        return { kind: 'insufficient_stock' as const, availableUnits: lots.reduce((sum: bigint, lot: any) => sum + BigInt(lot.remainingUnits), 0n) };
      }
      const sourceId = randomUUID();
      for (const allocation of fifo.allocations) {
        await (tx as any).barStockLot.update({ where: { id: allocation.lotId }, data: { remainingUnits: { decrement: allocation.units } } });
        await (tx as any).barStockMovement.create({ data: { propertyId, locationId, productId: product.id, lotId: allocation.lotId, kind: 'WRITE_OFF', units: -allocation.units, unitCost: allocation.unitCostMinor, sourceType: 'BAR_WRITE_OFF', sourceId, note: input.reason, createdById: auditUserId() } });
      }
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_write_off', entityId: sourceId, action: 'bar.stock.written_off', after: { productId: product.id, quantityUnits: input.quantityUnits.toString(), cost: fifo.totalCostMinor.toString(), reason: input.reason } } });
      return { kind: 'posted' as const, id: sourceId, movementsCreated: fifo.allocations.length, costMinor: fifo.totalCostMinor.toString() };
    }));
  }
  async createReceipt(input: BarReceiptInput) {
    const { propertyId, locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async () => {
    const currency = await this.currency(tx, locationId);
    const supplier = await (tx as any).barSupplier.findFirst({ where: { id: input.supplierId, locationId } });
    const products = await (tx as any).barProduct.count({ where: { locationId, id: { in: [...new Set(input.lines.map(line => line.productId))] } } });
    if (!supplier || products !== new Set(input.lines.map(line => line.productId)).size) throw new ConflictException('Поставщик или товар недоступен в этом объекте');
    if (!supplier.active) throw new ConflictException('Поставщик в архиве: верните его из архива, чтобы принять приход');
    this.compatible(input.currency, currency);
    const totalAmount = input.lines.reduce((s, l) => s + l.quantityUnits * l.unitCostMinor, 0n);
    const row = await (tx as any).barReceipt.create({
      data: {
        propertyId, locationId, supplierId: input.supplierId, documentNumber: input.documentNumber,
        documentDate: new Date(`${input.documentDate}T00:00:00Z`), receivedDate: new Date(`${input.receivedDate}T00:00:00Z`),
        currency: input.currency, totalAmount, note: input.note, createdById: auditUserId(),
        lines: { create: input.lines.map((l) => ({ productId: l.productId, quantityUnits: l.quantityUnits, unitCost: l.unitCostMinor, amount: l.quantityUnits * l.unitCostMinor, markupBasis: Number(l.markupBasis), calculatedPrice: salePriceFromMarkup(l.unitCostMinor, l.markupBasis, currency) })) },
      }, include: { lines: true },
    });
    return {
      ...row,
      totalAmount: row.totalAmount.toString(),
      lines: row.lines.map((line: any) => ({
        ...line,
        quantityUnits: line.quantityUnits.toString(),
        unitCost: line.unitCost.toString(),
        amount: line.amount.toString(),
        calculatedPrice: line.calculatedPrice.toString(),
      })),
    };
    }));
  }
  async postReceipt(id: string) {
    const { propertyId, locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async () => {
      await tx.$queryRaw`SELECT id FROM bar_receipts WHERE id = ${id}::uuid FOR UPDATE`;
      const receipt = await (tx as any).barReceipt.findFirst({ where: { id, locationId }, include: { lines: true } });
      if (!receipt) return { kind: 'not_found' as const };
      if (receipt.status !== 'DRAFT') return { kind: 'already_posted' as const };
      const currency = await this.currency(tx, locationId);
      this.compatible(receipt.currency, currency);
      for (const line of receipt.lines) await this.costSources(tx, locationId, currency, line.productId);
      const now = new Date();
      for (const line of receipt.lines) {
        await (tx as any).barProduct.update({ where: { id: line.productId }, data: { salePrice: line.calculatedPrice } });
        const lot = await (tx as any).barStockLot.create({ data: { propertyId, locationId, productId: line.productId, receiptLineId: line.id, receivedUnits: line.quantityUnits, remainingUnits: line.quantityUnits, unitCost: line.unitCost, receivedAt: now } });
        await (tx as any).barStockMovement.create({ data: { propertyId, locationId, productId: line.productId, lotId: lot.id, kind: 'RECEIPT', units: line.quantityUnits, unitCost: line.unitCost, sourceType: 'BAR_RECEIPT', sourceId: receipt.id, createdById: auditUserId() } });
      }
      await (tx as any).barReceipt.update({ where: { id }, data: { status: 'POSTED', postedAt: now } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_receipt', entityId: id, action: 'bar.receipt.posted', after: { lines: receipt.lines.length, totalAmount: receipt.totalAmount.toString() } } });
      return { kind: 'posted' as const, id, status: 'POSTED' as const, lotsCreated: receipt.lines.length, movementsCreated: receipt.lines.length, pricesUpdated: receipt.lines.length };
    }));
  }
  async payReceipt(id: string, input: BarSupplierPaymentInput) {
    const enabled = process.env.EXPENSE_LINKS_ENABLED === '1';
    const key = input.idempotencyKey;
    if (enabled && (typeof key !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(key))) throw new BadRequestException('Нужен ключ намерения оплаты');
    const { propertyId, locationId, vertical, currency } = await this.scope();
    if (!propertyId && vertical !== 'FOOD_SERVICE' && vertical !== 'BEAUTY') return { kind: 'no_cash' as const };
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async () => {
      // A pending retry fails closed rather than waiting and risking another debit.
      const hash = createHash('sha256').update(JSON.stringify(['SUPPLIER_PAYMENT',id,input.amountMinor.toString(),currency,input.method,input.note ?? null])).digest('hex');
      if (enabled) {
        const claim = await tx.$queryRaw<Array<{locked:boolean}>>`SELECT pg_try_advisory_xact_lock(hashtextextended(${locationId+':'+key},0)) AS locked`;
        if (!claim[0]?.locked) throw new ConflictException('Оплата уже выполняется, повторите с тем же ключом');
        await tx.$queryRaw`SELECT id FROM locations WHERE id = ${locationId}::uuid FOR NO KEY UPDATE`;
        const old = await tx.$queryRaw<Array<{normalized_payload_hash:string;result_id:string;action:string}>>`SELECT normalized_payload_hash,result_id,action FROM payment_write_intents WHERE location_id=${locationId}::uuid AND intent_key=${key}`;
        if (old[0]) {
          if (old[0].action !== 'SUPPLIER_PAYMENT' || old[0].normalized_payload_hash !== hash) throw new ConflictException('Payment intent payload conflict');
          const audit = await tx.auditLog.findFirst({where:{entityId:old[0].result_id,action:'bar.supplier_payment.created'}});
          const saved = audit?.after as {receiptId:string;amount:string;dueAmount:string} | null;
          if (!saved) throw new ConflictException('Payment intent result unavailable');
          return {kind:'paid' as const,id:old[0].result_id,receiptId:saved.receiptId,paidAmount:saved.amount,dueAmount:saved.dueAmount};
        }
      }
      await tx.$queryRaw`SELECT id FROM locations WHERE id = ${locationId}::uuid FOR NO KEY UPDATE`;
      await tx.$queryRaw`SELECT id FROM bar_receipts WHERE id = ${id}::uuid AND location_id = ${locationId}::uuid FOR UPDATE`;
      const receipt = await (tx as any).barReceipt.findFirst({ where: { id, locationId }, include: { supplier: true, payments: { where: PrismaBarRepository.COMPLETED_PAYMENTS, select: { amount: true } } } });
      if (!receipt) return { kind: 'not_found' as const };
      // M6 (ADR-186): повтор с тем же ключом возвращает первую оплату; приход заперт выше, второй запрос ждёт первый
      // пустой ключ Prisma выбросил бы из условия, и «повтором» стала бы любая оплата прихода
      if (!input.idempotencyKey) throw new BadRequestException('Нужен ключ повтора оплаты');
      const replay = await (tx as any).barSupplierPayment.findFirst({
        where: { receiptId: id, idempotencyKey: input.idempotencyKey },
        include: { cashOperation: { select: { method: true } }, restaurantCashOperation: { select: { method: true } } },
      });
      if (replay) {
        const method = replay.cashOperation?.method ?? replay.restaurantCashOperation?.method;
        if (BigInt(replay.amount) !== input.amountMinor || method !== input.method) throw new ConflictException('Ключ повтора уже использован для другой оплаты');
        const paidNow = receipt.payments.reduce((sum: bigint, payment: any) => sum + BigInt(payment.amount), 0n);
        return { kind: 'paid' as const, id: replay.id, receiptId: id, paidAmount: replay.amount.toString(), dueAmount: (BigInt(receipt.totalAmount) - paidNow).toString() };
      }
      if (receipt.status !== 'POSTED') return { kind: 'not_posted' as const };
      this.compatible(receipt.currency, await this.currency(tx, locationId));
      const alreadyPaid = receipt.payments.reduce((sum: bigint, payment: any) => sum + BigInt(payment.amount), 0n);
      const dueAmount = BigInt(receipt.totalAmount) - alreadyPaid;
      if (input.amountMinor > dueAmount) return { kind: 'overpayment' as const, dueAmount };
      const now = new Date();
      const note = input.note ?? `Оплата поставщику ${receipt.supplier.name}, документ ${receipt.documentNumber}`;
      let cashLink: { cashOperationId: string } | { restaurantCashOperationId: string };
      if (propertyId) {
        const cash = await createHotelCash(tx, { propertyId, kind: 'EXPENSE', method: input.method as import('../finance/finance.repository').PaymentMethod, amount: input.amountMinor, note, occurredAt: now, createdById: auditUserId() });
        cashLink = { cashOperationId: cash.id };
      } else {
        // расход кассы ресторана не уводит способ оплаты в минус (§35, §45)
        const available = (await this.restaurantBalances(tx, locationId))[input.method] ?? 0n;
        if (input.amountMinor > available) return { kind: 'insufficient_cash' as const, available };
        const cash = await (tx as any).restaurantCashOperation.create({ data: { locationId, kind: 'EXPENSE', method: input.method, amount: input.amountMinor, currency, note, occurredAt: now, createdById: auditUserId() } });
        cashLink = { restaurantCashOperationId: cash.id };
      }
      const payment = await (tx as any).barSupplierPayment.create({ data: { receiptId: id, ...cashLink, amount: input.amountMinor, paidAt: now, idempotencyKey: input.idempotencyKey, createdById: auditUserId() } });
      if (enabled) await tx.$executeRaw`INSERT INTO payment_write_intents(id,location_id,intent_key,action,normalized_payload_hash,result_id,created_by_id) VALUES(${randomUUID()}::uuid,${locationId}::uuid,${key},'SUPPLIER_PAYMENT',${hash},${payment.id}::uuid,${auditUserId()}::uuid)`;
      const remaining = dueAmount - input.amountMinor;
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_supplier_payment', entityId: payment.id, action: 'bar.supplier_payment.created', after: { receiptId: id, amount: input.amountMinor.toString(), dueAmount: remaining.toString(), method: input.method } } });
      return { kind: 'paid' as const, id: payment.id, receiptId: id, paidAmount: input.amountMinor.toString(), dueAmount: remaining.toString() };
    }));
  }
  async inventoryCount(input: BarInventoryCountInput) {
    const { propertyId, locationId } = await this.scope();
    return this.prisma.db.$transaction(tx=>runWithBeautyWriteAuthorization(tx,async () => {
      const product = await (tx as any).barProduct.findFirst({ where: { id: input.productId, locationId, active: true } });
      if (!product) return { kind: 'not_found' as const };
      const currency = await this.currency(tx, locationId);
      await this.costSources(tx, locationId, currency, product.id);
      await tx.$queryRaw`SELECT id FROM bar_stock_lots WHERE location_id = ${locationId}::uuid AND product_id = ${input.productId}::uuid AND remaining_units > 0 ORDER BY received_at, id FOR UPDATE`;
      const lots = await (tx as any).barStockLot.findMany({ where: { locationId, productId: input.productId, remainingUnits: { gt: 0 } }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] });
      const systemUnits = lots.reduce((sum: bigint, lot: any) => sum + BigInt(lot.remainingUnits), 0n);
      const difference = input.actualUnits - systemUnits;
      const sourceId = randomUUID();
      let cost = 0n;
      let surplusCost: bigint | null = null;
      if (difference > 0n) {
        // излишек (ADR-175, §47): новая партия без прихода по средней себестоимости остатка, без остатка по цене человека
        surplusCost = input.unitCostMinor ?? surplusUnitCost(lots.map((lot: any) => ({ remaining: BigInt(lot.remainingUnits), unitCost: BigInt(lot.unitCost) })));
        if (surplusCost === null) return { kind: 'surplus_requires_cost' as const, systemUnits };
        cost = difference * surplusCost;
        const lot = await (tx as any).barStockLot.create({ data: { propertyId, locationId, productId: product.id, receiptLineId: null, receivedUnits: difference, remainingUnits: difference, unitCost: surplusCost, receivedAt: new Date() } });
        await (tx as any).barStockMovement.create({ data: { propertyId, locationId, productId: product.id, lotId: lot.id, kind: 'INVENTORY_ADJUSTMENT', units: difference, unitCost: surplusCost, sourceType: 'BAR_INVENTORY_COUNT', sourceId, note: `${input.reason}; по системе ${systemUnits}; факт ${input.actualUnits}`, createdById: auditUserId() } });
      }
      if (difference < 0n) {
        const fifo = allocateFifo(lots.map((lot: any) => ({ lotId: lot.id, receivedAt: lot.receivedAt.toISOString(), availableUnits: lot.remainingUnits, unitCostMinor: lot.unitCost })), -difference);
        cost = fifo.totalCostMinor;
        for (const allocation of fifo.allocations) {
          await (tx as any).barStockLot.update({ where: { id: allocation.lotId }, data: { remainingUnits: { decrement: allocation.units } } });
          await (tx as any).barStockMovement.create({ data: { propertyId, locationId, productId: product.id, lotId: allocation.lotId, kind: 'INVENTORY_ADJUSTMENT', units: -allocation.units, unitCost: allocation.unitCostMinor, sourceType: 'BAR_INVENTORY_COUNT', sourceId, note: `${input.reason}; по системе ${systemUnits}; факт ${input.actualUnits}`, createdById: auditUserId() } });
        }
      }
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_inventory_count', entityId: sourceId, action: 'bar.inventory.counted', after: { productId: product.id, systemUnits: systemUnits.toString(), actualUnits: input.actualUnits.toString(), differenceUnits: difference.toString(), cost: cost.toString(), reason: input.reason, ...(surplusCost === null ? {} : { unitCost: surplusCost.toString(), manualPrice: input.unitCostMinor !== null }) } } });
      return { kind: 'adjusted' as const, id: sourceId, systemUnits: systemUnits.toString(), actualUnits: input.actualUnits.toString(), differenceUnits: difference.toString(), costMinor: cost.toString() };
    }));
  }
}
