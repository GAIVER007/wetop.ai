import 'reflect-metadata';
/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Client in this dirty tree is stale; remove after the shared generate step. */
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { allocateFifo, LUXX_APARTS_PROPERTY, salePriceFromMarkup } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef } from '../database/property-ref';
import { auditUserId } from '../accounts/actor';

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

/** Правка карточки товара (ADR-154): без кода, цены и архива, у них свои маршруты и правила */
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
export interface BarSupplierPaymentInput { amountMinor: bigint; method: string; note: string | null }
export interface BarInventoryCountInput { productId: string; actualUnits: bigint; reason: string }

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
  sellRetail(input: BarRetailSaleInput): Promise<{ kind: 'not_found' } | { kind: 'insufficient_stock'; availableUnits: bigint } | { kind: 'posted'; id: string; status: 'POSTED'; revenueMinor: string; costMinor: string }>;
  sellToFolio(input: BarFolioSaleInput): Promise<{ kind: 'folio_not_found' | 'product_not_found' } | { kind: 'insufficient_stock'; availableUnits: bigint } | { kind: 'posted'; id: string; status: 'POSTED'; chargeId: string; revenueMinor: string; costMinor: string }>;
  reverseSale(id: string, restock: boolean, reason: string): Promise<{ kind: 'not_found' | 'already_reversed' } | { kind: 'reversed'; id: string; status: 'REVERSED'; restocked: boolean }>;
  writeOff(input: BarWriteOffInput): Promise<{ kind: 'not_found' } | { kind: 'insufficient_stock'; availableUnits: bigint } | { kind: 'posted'; id: string; movementsCreated: number; costMinor: string }>;
  payReceipt(id: string, input: BarSupplierPaymentInput): Promise<{ kind: 'not_found' | 'not_posted' } | { kind: 'overpayment'; dueAmount: bigint } | { kind: 'paid'; id: string; receiptId: string; paidAmount: string; dueAmount: string }>;
  inventoryCount(input: BarInventoryCountInput): Promise<{ kind: 'not_found' } | { kind: 'surplus_requires_cost'; systemUnits: bigint } | { kind: 'adjusted'; id: string; systemUnits: string; actualUnits: string; differenceUnits: string; costMinor: string }>;
  createReceipt(input: BarReceiptInput): Promise<unknown>;
  postReceipt(id: string): Promise<{ kind: 'not_found' | 'already_posted' } | { kind: 'posted'; id: string; status: 'POSTED'; lotsCreated: number; movementsCreated: number; pricesUpdated: number }>;
}
export const BAR_REPOSITORY = Symbol('BAR_REPOSITORY');

@Injectable()
export class PrismaBarRepository implements BarRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private propertyId() { return propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name); }
  async categories() {
    return (this.prisma.db as any).barCategory.findMany({ where: { propertyId: await this.propertyId() }, orderBy: { name: 'asc' } });
  }
  async createCategory(input: BarCategoryInput) {
    const propertyId = await this.propertyId();
    const row = await (this.prisma.db as any).barCategory.create({ data: { propertyId, ...input } });
    await this.prisma.db.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_category', entityId: row.id, action: 'bar.category.created', after: { name: row.name, defaultMarkupBasis: row.defaultMarkupBasis } } });
    return row;
  }
  async setCategoryActive(id: string, active: boolean) {
    const propertyId = await this.propertyId();
    const existing = await (this.prisma.db as any).barCategory.findFirst({ where: { id, propertyId } });
    if (!existing) return null;
    const row = await (this.prisma.db as any).barCategory.update({ where: { id }, data: { active } });
    await this.prisma.db.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_category', entityId: id, action: 'bar.category.active_changed', after: { active } } });
    return row;
  }
  async products() {
    const rows = await (this.prisma.db as any).barProduct.findMany({ where: { propertyId: await this.propertyId() }, include: { category: true }, orderBy: { name: 'asc' } });
    return rows.map((row: any) => ({ ...row, salePrice: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString() }));
  }
  async createProduct(input: BarProductInput) {
    const propertyId = await this.propertyId();
    const row = await (this.prisma.db as any).barProduct.create({ data: {
      propertyId, code: input.code, name: input.name, categoryId: input.categoryId, barcode: input.barcode,
      unitsPerPackage: input.unitsPerPackage, markupBasis: input.markupBasis, salePrice: input.salePriceMinor,
      minimumStockUnits: input.minimumStockUnits,
    } });
    await this.prisma.db.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_product', entityId: row.id, action: 'bar.product.created', after: { code: row.code, name: row.name } } });
    return { ...row, salePrice: row.salePrice.toString(), salePriceMinor: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString() };
  }
  async setProductActive(id: string, active: boolean) {
    const propertyId = await this.propertyId();
    const existing = await (this.prisma.db as any).barProduct.findFirst({ where: { id, propertyId } });
    if (!existing) return null;
    const row = await (this.prisma.db as any).barProduct.update({ where: { id }, data: { active } });
    await this.prisma.db.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_product', entityId: id, action: 'bar.product.active_changed', after: { active } } });
    return { ...row, salePrice: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString() };
  }
  async updateProduct(id: string, patch: BarProductPatch) {
    const propertyId = await this.propertyId();
    const existing = await (this.prisma.db as any).barProduct.findFirst({ where: { id, propertyId } });
    if (!existing) return null;
    const row = await (this.prisma.db as any).barProduct.update({ where: { id }, data: {
      name: patch.name, categoryId: patch.categoryId, barcode: patch.barcode,
      unitsPerPackage: patch.unitsPerPackage, markupBasis: patch.markupBasis,
      minimumStockUnits: patch.minimumStockUnits,
    } });
    await this.prisma.db.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_product', entityId: id, action: 'bar.product.updated', before: { name: existing.name, barcode: existing.barcode, minimumStockUnits: existing.minimumStockUnits.toString() }, after: { name: row.name, barcode: row.barcode, minimumStockUnits: row.minimumStockUnits.toString() } } });
    return { ...row, salePrice: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString() };
  }
  async setProductPrice(id: string, salePriceMinor: bigint) {
    const propertyId = await this.propertyId();
    const existing = await (this.prisma.db as any).barProduct.findFirst({ where: { id, propertyId } });
    if (!existing) return null;
    const row = await (this.prisma.db as any).barProduct.update({ where: { id }, data: { salePrice: salePriceMinor } });
    await this.prisma.db.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_product', entityId: id, action: 'bar.product.price_changed', before: { salePrice: existing.salePrice.toString() }, after: { salePrice: salePriceMinor.toString() } } });
    return { ...row, salePrice: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString() };
  }
  async suppliers() {
    return (this.prisma.db as any).barSupplier.findMany({ where: { propertyId: await this.propertyId() }, orderBy: { name: 'asc' } });
  }
  async createSupplier(input: BarSupplierInput) {
    const propertyId = await this.propertyId();
    const row = await (this.prisma.db as any).barSupplier.create({ data: { propertyId, ...input } });
    await this.prisma.db.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_supplier', entityId: row.id, action: 'bar.supplier.created', after: { name: row.name } } });
    return row;
  }
  async setSupplierActive(id: string, active: boolean) {
    const propertyId = await this.propertyId();
    const existing = await (this.prisma.db as any).barSupplier.findFirst({ where: { id, propertyId } });
    if (!existing) return null;
    const row = await (this.prisma.db as any).barSupplier.update({ where: { id }, data: { active } });
    await this.prisma.db.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_supplier', entityId: id, action: 'bar.supplier.active_changed', after: { active } } });
    return row;
  }
  async receipts() {
    const rows = await (this.prisma.db as any).barReceipt.findMany({
      where: { propertyId: await this.propertyId() }, include: { supplier: true, payments: { select: { amount: true } }, _count: { select: { lines: true } } },
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
    const propertyId = await this.propertyId();
    const rows = await (this.prisma.db as any).barProduct.findMany({
      where: { propertyId }, include: { category: true, lots: { where: { remainingUnits: { gt: 0 } }, select: { remainingUnits: true, unitCost: true } } }, orderBy: { name: 'asc' },
    });
    return rows.map((row: any) => {
      const available = row.lots.reduce((sum: bigint, lot: any) => sum + BigInt(lot.remainingUnits), 0n);
      const stockCost = row.lots.reduce((sum: bigint, lot: any) => sum + BigInt(lot.remainingUnits) * BigInt(lot.unitCost), 0n);
      const product = { ...row };
      delete product.lots;
      return { ...product, salePrice: row.salePrice.toString(), minimumStockUnits: row.minimumStockUnits.toString(), availableUnits: available.toString(), stockCostMinor: stockCost.toString() };
    });
  }
  async sales() {
    const rows = await (this.prisma.db as any).barSale.findMany({ where: { propertyId: await this.propertyId() }, include: { lines: { include: { product: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((row: any) => ({ ...row, totalRevenue: row.totalRevenue.toString(), totalCost: row.totalCost.toString(), lines: row.lines.map((line: any) => ({ ...line, quantityUnits: line.quantityUnits.toString(), salePrice: line.salePrice.toString(), revenue: line.revenue.toString(), cost: line.cost.toString() })) }));
  }
  async folios() {
    const propertyId = await this.propertyId();
    const rows = await (this.prisma.db as any).folio.findMany({
      where: { status: 'OPEN', reservationItem: { reservation: { propertyId } } },
      include: { reservationItem: { include: { reservation: { include: { primaryGuest: true } }, allocations: { include: { inventoryUnit: true }, orderBy: { startDate: 'desc' }, take: 1 } } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    return rows.map((row: any) => ({ id: row.id, confirmationNumber: row.reservationItem.reservation.confirmationNumber, guestName: row.reservationItem.reservation.primaryGuest ? `${row.reservationItem.reservation.primaryGuest.firstName} ${row.reservationItem.reservation.primaryGuest.lastName}` : 'Гость не указан', unitCode: row.reservationItem.allocations[0]?.inventoryUnit?.code ?? null }));
  }
  async movements() {
    const rows = await (this.prisma.db as any).barStockMovement.findMany({ where: { propertyId: await this.propertyId() }, include: { product: true }, orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map((row: any) => ({ ...row, units: row.units.toString(), unitCost: row.unitCost.toString(), amountMinor: (BigInt(row.units < 0n ? -row.units : row.units) * BigInt(row.unitCost)).toString() }));
  }
  async report() {
    const propertyId = await this.propertyId();
    const [receipts, sales, lots, writeOffs] = await Promise.all([
      (this.prisma.db as any).barReceipt.findMany({ where: { propertyId, status: 'POSTED' }, include: { payments: { select: { amount: true } } } }),
      (this.prisma.db as any).barSale.findMany({ where: { propertyId, status: 'POSTED' }, select: { totalRevenue: true, totalCost: true } }),
      (this.prisma.db as any).barStockLot.findMany({ where: { propertyId, remainingUnits: { gt: 0 } }, select: { remainingUnits: true, unitCost: true } }),
      (this.prisma.db as any).barStockMovement.findMany({ where: { propertyId, kind: 'WRITE_OFF' }, select: { units: true, unitCost: true } }),
    ]);
    const purchases = receipts.reduce((sum: bigint, row: any) => sum + BigInt(row.totalAmount), 0n);
    const paid = receipts.reduce((sum: bigint, row: any) => sum + row.payments.reduce((part: bigint, payment: any) => part + BigInt(payment.amount), 0n), 0n);
    const revenue = sales.reduce((sum: bigint, row: any) => sum + BigInt(row.totalRevenue), 0n);
    const cost = sales.reduce((sum: bigint, row: any) => sum + BigInt(row.totalCost), 0n);
    const stockCost = lots.reduce((sum: bigint, row: any) => sum + BigInt(row.remainingUnits) * BigInt(row.unitCost), 0n);
    const writeOff = writeOffs.reduce((sum: bigint, row: any) => sum + (BigInt(row.units) < 0n ? -BigInt(row.units) : BigInt(row.units)) * BigInt(row.unitCost), 0n);
    return { purchasesMinor: purchases.toString(), supplierPaidMinor: paid.toString(), revenueMinor: revenue.toString(), costMinor: cost.toString(), grossProfitMinor: (revenue - cost).toString(), writeOffMinor: writeOff.toString(), stockCostMinor: stockCost.toString(), supplierDebtMinor: (purchases - paid).toString() };
  }
  async sellRetail(input: BarRetailSaleInput) {
    const propertyId = await this.propertyId();
    return this.prisma.db.$transaction(async (tx) => {
      const replay = await (tx as any).barSale.findFirst({ where: { propertyId, idempotencyKey: input.idempotencyKey } });
      if (replay) return { kind: 'posted' as const, id: replay.id, status: 'POSTED' as const, revenueMinor: replay.totalRevenue.toString(), costMinor: replay.totalCost.toString() };
      const product = await (tx as any).barProduct.findFirst({ where: { id: input.productId, propertyId, active: true } });
      if (!product) return { kind: 'not_found' as const };
      await tx.$queryRaw`SELECT id FROM bar_stock_lots WHERE property_id = ${propertyId}::uuid AND product_id = ${input.productId}::uuid AND remaining_units > 0 ORDER BY received_at, id FOR UPDATE`;
      const lots = await (tx as any).barStockLot.findMany({ where: { propertyId, productId: input.productId, remainingUnits: { gt: 0 } }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] });
      let fifo;
      try {
        fifo = allocateFifo(lots.map((lot: any) => ({ lotId: lot.id, receivedAt: lot.receivedAt.toISOString(), availableUnits: lot.remainingUnits, unitCostMinor: lot.unitCost })), input.quantityUnits);
      } catch {
        return { kind: 'insufficient_stock' as const, availableUnits: lots.reduce((sum: bigint, lot: any) => sum + lot.remainingUnits, 0n) };
      }
      const revenue = product.salePrice * input.quantityUnits;
      const cash = await (tx as any).cashOperation.create({ data: { propertyId, kind: 'INCOME', method: input.method, amount: revenue, note: `Бар: ${product.name}`, createdById: auditUserId() } });
      const sale = await (tx as any).barSale.create({ data: { propertyId, cashOperationId: cash.id, idempotencyKey: input.idempotencyKey, status: 'POSTED', currency: 'KZT', totalRevenue: revenue, totalCost: fifo.totalCostMinor, createdById: auditUserId(), lines: { create: [{ productId: product.id, quantityUnits: input.quantityUnits, salePrice: product.salePrice, revenue, cost: fifo.totalCostMinor }] } } });
      for (const allocation of fifo.allocations) {
        await (tx as any).barStockLot.update({ where: { id: allocation.lotId }, data: { remainingUnits: { decrement: allocation.units } } });
        await (tx as any).barStockMovement.create({ data: { propertyId, productId: product.id, lotId: allocation.lotId, kind: 'SALE', units: -allocation.units, unitCost: allocation.unitCostMinor, sourceType: 'BAR_SALE', sourceId: sale.id, createdById: auditUserId() } });
      }
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_sale', entityId: sale.id, action: 'bar.sale.posted', after: { quantityUnits: input.quantityUnits.toString(), revenue: revenue.toString(), cost: fifo.totalCostMinor.toString() } } });
      return { kind: 'posted' as const, id: sale.id, status: 'POSTED' as const, revenueMinor: revenue.toString(), costMinor: fifo.totalCostMinor.toString() };
    });
  }
  async sellToFolio(input: BarFolioSaleInput) {
    const propertyId = await this.propertyId();
    return this.prisma.db.$transaction(async (tx) => {
      const replay = await (tx as any).barSale.findFirst({ where: { propertyId, idempotencyKey: input.idempotencyKey } });
      if (replay) return { kind: 'posted' as const, id: replay.id, status: 'POSTED' as const, chargeId: replay.chargeId, revenueMinor: replay.totalRevenue.toString(), costMinor: replay.totalCost.toString() };
      await tx.$queryRaw`SELECT f.id FROM folios f JOIN reservation_items i ON i.id = f.reservation_item_id JOIN reservations r ON r.id = i.reservation_id WHERE f.id = ${input.folioId}::uuid AND r.property_id = ${propertyId}::uuid AND f.status = 'OPEN' FOR UPDATE OF f`;
      const folio = await (tx as any).folio.findFirst({ where: { id: input.folioId, status: 'OPEN', reservationItem: { reservation: { propertyId } } } });
      if (!folio) return { kind: 'folio_not_found' as const };
      const product = await (tx as any).barProduct.findFirst({ where: { id: input.productId, propertyId, active: true } });
      if (!product) return { kind: 'product_not_found' as const };
      await tx.$queryRaw`SELECT id FROM bar_stock_lots WHERE property_id = ${propertyId}::uuid AND product_id = ${input.productId}::uuid AND remaining_units > 0 ORDER BY received_at, id FOR UPDATE`;
      const lots = await (tx as any).barStockLot.findMany({ where: { propertyId, productId: input.productId, remainingUnits: { gt: 0 } }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] });
      let fifo;
      try {
        fifo = allocateFifo(lots.map((lot: any) => ({ lotId: lot.id, receivedAt: lot.receivedAt.toISOString(), availableUnits: lot.remainingUnits, unitCostMinor: lot.unitCost })), input.quantityUnits);
      } catch {
        return { kind: 'insufficient_stock' as const, availableUnits: lots.reduce((sum: bigint, lot: any) => sum + BigInt(lot.remainingUnits), 0n) };
      }
      const revenue = BigInt(product.salePrice) * input.quantityUnits;
      const charge = await (tx as any).charge.create({ data: { folioId: folio.id, kind: 'SERVICE', description: `Бар: ${product.name}`, quantity: Number(input.quantityUnits), unitPrice: product.salePrice, amount: revenue, createdBy: auditUserId() } });
      const sale = await (tx as any).barSale.create({ data: { propertyId, folioId: folio.id, chargeId: charge.id, idempotencyKey: input.idempotencyKey, status: 'POSTED', currency: folio.currency, totalRevenue: revenue, totalCost: fifo.totalCostMinor, createdById: auditUserId(), lines: { create: [{ productId: product.id, quantityUnits: input.quantityUnits, salePrice: product.salePrice, revenue, cost: fifo.totalCostMinor }] } } });
      for (const allocation of fifo.allocations) {
        await (tx as any).barStockLot.update({ where: { id: allocation.lotId }, data: { remainingUnits: { decrement: allocation.units } } });
        await (tx as any).barStockMovement.create({ data: { propertyId, productId: product.id, lotId: allocation.lotId, kind: 'SALE', units: -allocation.units, unitCost: allocation.unitCostMinor, sourceType: 'BAR_SALE', sourceId: sale.id, createdById: auditUserId() } });
      }
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_sale', entityId: sale.id, action: 'bar.sale.folio_posted', after: { folioId: folio.id, chargeId: charge.id, quantityUnits: input.quantityUnits.toString(), revenue: revenue.toString(), cost: fifo.totalCostMinor.toString() } } });
      return { kind: 'posted' as const, id: sale.id, status: 'POSTED' as const, chargeId: charge.id, revenueMinor: revenue.toString(), costMinor: fifo.totalCostMinor.toString() };
    });
  }
  async reverseSale(id: string, restock: boolean, reason: string) {
    const propertyId = await this.propertyId();
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM bar_sales WHERE id = ${id}::uuid AND property_id = ${propertyId}::uuid FOR UPDATE`;
      const sale = await (tx as any).barSale.findFirst({ where: { id, propertyId } });
      if (!sale) return { kind: 'not_found' as const };
      if (sale.status !== 'POSTED') return { kind: 'already_reversed' as const };
      const movements = await (tx as any).barStockMovement.findMany({ where: { propertyId, sourceType: 'BAR_SALE', sourceId: id, kind: 'SALE' } });
      if (restock) for (const movement of movements) {
        await tx.$queryRaw`SELECT id FROM bar_stock_lots WHERE id = ${movement.lotId}::uuid FOR UPDATE`;
        await (tx as any).barStockLot.update({ where: { id: movement.lotId }, data: { remainingUnits: { increment: -movement.units } } });
        await (tx as any).barStockMovement.create({ data: { propertyId, productId: movement.productId, lotId: movement.lotId, kind: 'SALE_RETURN', units: -movement.units, unitCost: movement.unitCost, sourceType: 'BAR_SALE_RETURN', sourceId: id, note: reason, createdById: auditUserId() } });
      }
      if (sale.cashOperationId) await (tx as any).cashOperation.update({ where: { id: sale.cashOperationId }, data: { status: 'VOIDED' } });
      if (sale.chargeId) await (tx as any).charge.update({ where: { id: sale.chargeId }, data: { voidedAt: new Date() } });
      await (tx as any).barSale.update({ where: { id }, data: { status: 'REVERSED', reversedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_sale', entityId: id, action: 'bar.sale.reversed', after: { restock, reason } } });
      return { kind: 'reversed' as const, id, status: 'REVERSED' as const, restocked: restock };
    });
  }
  async writeOff(input: BarWriteOffInput) {
    const propertyId = await this.propertyId();
    return this.prisma.db.$transaction(async (tx) => {
      const product = await (tx as any).barProduct.findFirst({ where: { id: input.productId, propertyId, active: true } });
      if (!product) return { kind: 'not_found' as const };
      await tx.$queryRaw`SELECT id FROM bar_stock_lots WHERE property_id = ${propertyId}::uuid AND product_id = ${input.productId}::uuid AND remaining_units > 0 ORDER BY received_at, id FOR UPDATE`;
      const lots = await (tx as any).barStockLot.findMany({ where: { propertyId, productId: input.productId, remainingUnits: { gt: 0 } }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] });
      let fifo;
      try {
        fifo = allocateFifo(lots.map((lot: any) => ({ lotId: lot.id, receivedAt: lot.receivedAt.toISOString(), availableUnits: lot.remainingUnits, unitCostMinor: lot.unitCost })), input.quantityUnits);
      } catch {
        return { kind: 'insufficient_stock' as const, availableUnits: lots.reduce((sum: bigint, lot: any) => sum + BigInt(lot.remainingUnits), 0n) };
      }
      const sourceId = randomUUID();
      for (const allocation of fifo.allocations) {
        await (tx as any).barStockLot.update({ where: { id: allocation.lotId }, data: { remainingUnits: { decrement: allocation.units } } });
        await (tx as any).barStockMovement.create({ data: { propertyId, productId: product.id, lotId: allocation.lotId, kind: 'WRITE_OFF', units: -allocation.units, unitCost: allocation.unitCostMinor, sourceType: 'BAR_WRITE_OFF', sourceId, note: input.reason, createdById: auditUserId() } });
      }
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_write_off', entityId: sourceId, action: 'bar.stock.written_off', after: { productId: product.id, quantityUnits: input.quantityUnits.toString(), cost: fifo.totalCostMinor.toString(), reason: input.reason } } });
      return { kind: 'posted' as const, id: sourceId, movementsCreated: fifo.allocations.length, costMinor: fifo.totalCostMinor.toString() };
    });
  }
  async createReceipt(input: BarReceiptInput) {
    const propertyId = await this.propertyId();
    const totalAmount = input.lines.reduce((s, l) => s + l.quantityUnits * l.unitCostMinor, 0n);
    const row = await (this.prisma.db as any).barReceipt.create({
      data: {
        propertyId, supplierId: input.supplierId, documentNumber: input.documentNumber,
        documentDate: new Date(`${input.documentDate}T00:00:00Z`), receivedDate: new Date(`${input.receivedDate}T00:00:00Z`),
        currency: input.currency, totalAmount, note: input.note, createdById: auditUserId(),
        lines: { create: input.lines.map((l) => ({ productId: l.productId, quantityUnits: l.quantityUnits, unitCost: l.unitCostMinor, amount: l.quantityUnits * l.unitCostMinor, markupBasis: Number(l.markupBasis), calculatedPrice: salePriceFromMarkup(l.unitCostMinor, l.markupBasis) })) },
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
  }
  async postReceipt(id: string) {
    const propertyId = await this.propertyId();
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM bar_receipts WHERE id = ${id}::uuid FOR UPDATE`;
      const receipt = await (tx as any).barReceipt.findFirst({ where: { id, propertyId }, include: { lines: true } });
      if (!receipt) return { kind: 'not_found' as const };
      if (receipt.status !== 'DRAFT') return { kind: 'already_posted' as const };
      const now = new Date();
      for (const line of receipt.lines) {
        await (tx as any).barProduct.update({ where: { id: line.productId }, data: { salePrice: line.calculatedPrice } });
        const lot = await (tx as any).barStockLot.create({ data: { propertyId, productId: line.productId, receiptLineId: line.id, receivedUnits: line.quantityUnits, remainingUnits: line.quantityUnits, unitCost: line.unitCost, receivedAt: now } });
        await (tx as any).barStockMovement.create({ data: { propertyId, productId: line.productId, lotId: lot.id, kind: 'RECEIPT', units: line.quantityUnits, unitCost: line.unitCost, sourceType: 'BAR_RECEIPT', sourceId: receipt.id, createdById: auditUserId() } });
      }
      await (tx as any).barReceipt.update({ where: { id }, data: { status: 'POSTED', postedAt: now } });
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_receipt', entityId: id, action: 'bar.receipt.posted', after: { lines: receipt.lines.length, totalAmount: receipt.totalAmount.toString() } } });
      return { kind: 'posted' as const, id, status: 'POSTED' as const, lotsCreated: receipt.lines.length, movementsCreated: receipt.lines.length, pricesUpdated: receipt.lines.length };
    });
  }
  async payReceipt(id: string, input: BarSupplierPaymentInput) {
    const propertyId = await this.propertyId();
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM bar_receipts WHERE id = ${id}::uuid AND property_id = ${propertyId}::uuid FOR UPDATE`;
      const receipt = await (tx as any).barReceipt.findFirst({ where: { id, propertyId }, include: { supplier: true, payments: { select: { amount: true } } } });
      if (!receipt) return { kind: 'not_found' as const };
      if (receipt.status !== 'POSTED') return { kind: 'not_posted' as const };
      const alreadyPaid = receipt.payments.reduce((sum: bigint, payment: any) => sum + BigInt(payment.amount), 0n);
      const dueAmount = BigInt(receipt.totalAmount) - alreadyPaid;
      if (input.amountMinor > dueAmount) return { kind: 'overpayment' as const, dueAmount };
      const now = new Date();
      const cash = await (tx as any).cashOperation.create({ data: {
        propertyId, kind: 'EXPENSE', method: input.method, amount: input.amountMinor,
        note: input.note ?? `Оплата поставщику ${receipt.supplier.name}, документ ${receipt.documentNumber}`,
        occurredAt: now, createdById: auditUserId(),
      } });
      const payment = await (tx as any).barSupplierPayment.create({ data: { receiptId: id, cashOperationId: cash.id, amount: input.amountMinor, paidAt: now, createdById: auditUserId() } });
      const remaining = dueAmount - input.amountMinor;
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_supplier_payment', entityId: payment.id, action: 'bar.supplier_payment.created', after: { receiptId: id, amount: input.amountMinor.toString(), dueAmount: remaining.toString(), method: input.method } } });
      return { kind: 'paid' as const, id: payment.id, receiptId: id, paidAmount: input.amountMinor.toString(), dueAmount: remaining.toString() };
    });
  }
  async inventoryCount(input: BarInventoryCountInput) {
    const propertyId = await this.propertyId();
    return this.prisma.db.$transaction(async (tx) => {
      const product = await (tx as any).barProduct.findFirst({ where: { id: input.productId, propertyId, active: true } });
      if (!product) return { kind: 'not_found' as const };
      await tx.$queryRaw`SELECT id FROM bar_stock_lots WHERE property_id = ${propertyId}::uuid AND product_id = ${input.productId}::uuid AND remaining_units > 0 ORDER BY received_at, id FOR UPDATE`;
      const lots = await (tx as any).barStockLot.findMany({ where: { propertyId, productId: input.productId, remainingUnits: { gt: 0 } }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] });
      const systemUnits = lots.reduce((sum: bigint, lot: any) => sum + BigInt(lot.remainingUnits), 0n);
      if (input.actualUnits > systemUnits) return { kind: 'surplus_requires_cost' as const, systemUnits };
      const difference = input.actualUnits - systemUnits;
      const sourceId = randomUUID();
      let cost = 0n;
      if (difference < 0n) {
        const fifo = allocateFifo(lots.map((lot: any) => ({ lotId: lot.id, receivedAt: lot.receivedAt.toISOString(), availableUnits: lot.remainingUnits, unitCostMinor: lot.unitCost })), -difference);
        cost = fifo.totalCostMinor;
        for (const allocation of fifo.allocations) {
          await (tx as any).barStockLot.update({ where: { id: allocation.lotId }, data: { remainingUnits: { decrement: allocation.units } } });
          await (tx as any).barStockMovement.create({ data: { propertyId, productId: product.id, lotId: allocation.lotId, kind: 'INVENTORY_ADJUSTMENT', units: -allocation.units, unitCost: allocation.unitCostMinor, sourceType: 'BAR_INVENTORY_COUNT', sourceId, note: `${input.reason}; по системе ${systemUnits}; факт ${input.actualUnits}`, createdById: auditUserId() } });
        }
      }
      await tx.auditLog.create({ data: { userId: auditUserId(), entityType: 'bar_inventory_count', entityId: sourceId, action: 'bar.inventory.counted', after: { productId: product.id, systemUnits: systemUnits.toString(), actualUnits: input.actualUnits.toString(), differenceUnits: difference.toString(), cost: cost.toString(), reason: input.reason } } });
      return { kind: 'adjusted' as const, id: sourceId, systemUnits: systemUnits.toString(), actualUnits: input.actualUnits.toString(), differenceUnits: difference.toString(), costMinor: cost.toString() };
    });
  }
}
