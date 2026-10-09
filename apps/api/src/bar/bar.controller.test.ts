import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BarModule } from './bar.module';
import { BAR_REPOSITORY, type BarRepository } from './bar.repository';
import { PrismaService } from '../database/prisma.provider';

describe('бар: приходы (BAR2)', () => {
  let app: INestApplication;
  let posted = false;
  const repo: BarRepository = {
    async categories() { return []; },
    async createCategory(input) { return { id: '50000000-0000-4000-8000-000000000001', ...input }; },
    async setCategoryActive(id, active) { return id.endsWith('001') ? { id, active } : null; },
    async products() { return []; },
    async createProduct(input) {
      return {
        id: '40000000-0000-4000-8000-000000000001', ...input,
        salePriceMinor: input.salePriceMinor.toString(), minimumStockUnits: input.minimumStockUnits.toString(),
      };
    },
    async setProductActive(id, active) { return id.endsWith('001') ? { id, active } : null; },
    async updateProduct(id, patch) { return id.endsWith('001') ? { id, ...patch, minimumStockUnits: patch.minimumStockUnits.toString() } : null; },
    async setProductPrice(id, salePriceMinor) { return id.endsWith('001') ? { id, salePrice: salePriceMinor.toString() } : null; },
    async suppliers() { return []; },
    async createSupplier(input) { return { id: '20000000-0000-4000-8000-000000000001', ...input }; },
    async setSupplierActive(id, active) { return id.endsWith('001') ? { id, active } : null; },
    async receipts() { return []; },
    async stock() { return [{ productId: '30000000-0000-4000-8000-000000000001', availableUnits: '12' }]; },
    async sales() { return []; },
    async folios() { return [{ id: '90000000-0000-4000-8000-000000000001', confirmationNumber: 'WTP-101', guestName: 'Айдана Тестова' }]; },
    async movements() { return [{ id: 'movement-1', kind: 'RECEIPT', units: '12' }]; },
    async report() { return { purchasesMinor: '180000', supplierPaidMinor: '80000', revenueMinor: '70000', costMinor: '15000', grossProfitMinor: '55000', writeOffMinor: '0', stockCostMinor: '165000', supplierDebtMinor: '100000' }; },
    async inventoryCount(input) {
      if (input.actualUnits > 12n) return { kind: 'surplus_requires_cost', systemUnits: 12n };
      return { kind: 'adjusted', id: '92000000-0000-4000-8000-000000000001', systemUnits: '12', actualUnits: input.actualUnits.toString(), differenceUnits: (input.actualUnits - 12n).toString(), costMinor: '15000' };
    },
    async sellRetail(input) {
      if (input.quantityUnits > 12n) return { kind: 'insufficient_stock', availableUnits: 12n };
      return { kind: 'posted', id: '60000000-0000-4000-8000-000000000001', status: 'POSTED', revenueMinor: '70000', costMinor: '15000' };
    },
    async sellToFolio(input) {
      if (!input.folioId.endsWith('001')) return { kind: 'folio_not_found' };
      return { kind: 'posted', id: '61000000-0000-4000-8000-000000000001', status: 'POSTED', chargeId: '91000000-0000-4000-8000-000000000001', revenueMinor: '70000', costMinor: '15000' };
    },
    async reverseSale(id, restock) {
      return id.endsWith('001') ? { kind: 'reversed', id, status: 'REVERSED', restocked: restock } : { kind: 'not_found' };
    },
    async writeOff(input) {
      if (input.quantityUnits > 12n) return { kind: 'insufficient_stock', availableUnits: 12n };
      return { kind: 'posted', id: '70000000-0000-4000-8000-000000000001', movementsCreated: 1, costMinor: '15000' };
    },
    async payReceipt(id, input) {
      if (!id.endsWith('001')) return { kind: 'not_found' };
      if (input.amountMinor > 180000n) return { kind: 'overpayment', dueAmount: 180000n };
      return { kind: 'paid', id: '80000000-0000-4000-8000-000000000001', receiptId: id, paidAmount: input.amountMinor.toString(), dueAmount: (180000n - input.amountMinor).toString() };
    },
    async createReceipt() { return { id: '10000000-0000-4000-8000-000000000001', status: 'DRAFT', totalAmountMinor: '180000' }; },
    async postReceipt(id) {
      if (posted) return { kind: 'already_posted' };
      posted = true;
      return { kind: 'posted', id, status: 'POSTED', lotsCreated: 1, movementsCreated: 1, pricesUpdated: 1 };
    },
  };

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [BarModule] })
      .overrideProvider(BAR_REPOSITORY).useValue(repo)
      .overrideProvider(PrismaService).useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('создает черновик и проводит его один раз', async () => {
    const body = {
      supplierId: '20000000-0000-4000-8000-000000000001', documentNumber: 'SF-12',
      documentDate: '2026-10-04', receivedDate: '2026-10-04', currency: 'KZT',
      lines: [{ productId: '30000000-0000-4000-8000-000000000001', quantityUnits: '12', unitCostMinor: '15000', markupBasis: 3500 }],
    };
    const created = await request(app.getHttpServer()).post('/bar/receipts').send(body).expect(201);
    const postedReceipt = await request(app.getHttpServer()).post(`/bar/receipts/${created.body.id}/post`).expect(201);
    expect(postedReceipt.body.pricesUpdated).toBe(1);
    expect((await request(app.getHttpServer()).post(`/bar/receipts/${created.body.id}/post`)).status).toBe(409);
  });

  it('отклоняет пустой приход и сумму float', async () => {
    expect((await request(app.getHttpServer()).post('/bar/receipts').send({})).status).toBe(400);
    expect((await request(app.getHttpServer()).post('/bar/receipts').send({
      supplierId: '20000000-0000-4000-8000-000000000001', documentNumber: 'x', documentDate: '2026-10-04',
      receivedDate: '2026-10-04', currency: 'KZT',
      lines: [{ productId: '30000000-0000-4000-8000-000000000001', quantityUnits: 1.5, unitCostMinor: '100', markupBasis: 0 }],
    })).status).toBe(400);
  });

  it('создает товар и поставщика, архивирует без удаления', async () => {
    const category = await request(app.getHttpServer()).post('/bar/categories').send({
      name: 'Безалкогольные напитки', defaultMarkupBasis: 3500,
    }).expect(201);
    await request(app.getHttpServer()).patch(`/bar/categories/${category.body.id}/active`).send({ active: false }).expect(200);

    const product = await request(app.getHttpServer()).post('/bar/products').send({
      code: 'COLA-05', name: 'Cola 0,5', unitsPerPackage: 12, markupBasis: 3500,
      salePriceMinor: '70000', minimumStockUnits: '6',
    }).expect(201);
    expect(product.body.salePriceMinor).toBe('70000');
    const repriced = await request(app.getHttpServer()).patch(`/bar/products/${product.body.id}/price`).send({ salePriceMinor: '85000' }).expect(200);
    expect(repriced.body.salePrice).toBe('85000');
    await request(app.getHttpServer()).patch(`/bar/products/${product.body.id}/active`).send({ active: false }).expect(200);

    const supplier = await request(app.getHttpServer()).post('/bar/suppliers').send({ name: 'Алматы Напитки' }).expect(201);
    await request(app.getHttpServer()).patch(`/bar/suppliers/${supplier.body.id}/active`).send({ active: false }).expect(200);
  });

  it('правит карточку товара: название, категорию, штрихкод, наценку и минимум, но не цену', async () => {
    const id = '40000000-0000-4000-8000-000000000001';
    const updated = await request(app.getHttpServer()).patch(`/bar/products/${id}`).send({
      name: 'Cola 0,5 ж/б', categoryId: null, barcode: '4870001234567',
      unitsPerPackage: 12, markupBasis: 3500, minimumStockUnits: '8',
    }).expect(200);
    expect(updated.body).toMatchObject({ name: 'Cola 0,5 ж/б', barcode: '4870001234567', minimumStockUnits: '8' });
    // цена правится своим маршрутом с аудитом до и после: здесь её нет
    expect((await request(app.getHttpServer()).patch(`/bar/products/${id}`).send({ name: 'x', salePriceMinor: '100', unitsPerPackage: 1, markupBasis: null, minimumStockUnits: '0', categoryId: null, barcode: null })).status).toBe(400);
    expect((await request(app.getHttpServer()).patch(`/bar/products/${id}`).send({ name: '', categoryId: null, barcode: null, unitsPerPackage: 1, markupBasis: null, minimumStockUnits: '0' })).status).toBe(400);
    expect((await request(app.getHttpServer()).patch('/bar/products/40000000-0000-4000-8000-000000000002').send({ name: 'Нет такого', categoryId: null, barcode: null, unitsPerPackage: 1, markupBasis: null, minimumStockUnits: '0' })).status).toBe(404);
  });

  it('продает без брони и запрещает минусовой остаток', async () => {
    const body = { productId: '30000000-0000-4000-8000-000000000001', quantityUnits: '2', method: 'CASH', idempotencyKey: 'sale-1' };
    const sold = await request(app.getHttpServer()).post('/bar/sales/retail').send(body).expect(201);
    expect(sold.body.status).toBe('POSTED');
    await request(app.getHttpServer()).post('/bar/sales/retail').send({ ...body, quantityUnits: '13', idempotencyKey: 'sale-2' }).expect(409);
  });

  it('возвращает продажу и восстанавливает остаток только по флагу', async () => {
    const id = '60000000-0000-4000-8000-000000000001';
    const result = await request(app.getHttpServer()).post(`/bar/sales/${id}/reverse`).send({ restock: true, reason: 'Возврат гостя' }).expect(201);
    expect(result.body).toMatchObject({ status: 'REVERSED', restocked: true });
  });

  it('списывает товар с причиной и не уходит в минус', async () => {
    const body = { productId: '30000000-0000-4000-8000-000000000001', quantityUnits: '2', reason: 'Бой' };
    await request(app.getHttpServer()).post('/bar/write-offs').send(body).expect(201);
    await request(app.getHttpServer()).post('/bar/write-offs').send({ ...body, quantityUnits: '13' }).expect(409);
    await request(app.getHttpServer()).post('/bar/write-offs').send({ ...body, reason: '' }).expect(400);
  });

  it('принимает частичную оплату поставщику и запрещает переплату', async () => {
    const id = '10000000-0000-4000-8000-000000000001';
    const paid = await request(app.getHttpServer()).post(`/bar/receipts/${id}/payments`).send({ amountMinor: '80000', method: 'BANK_TRANSFER_LEGAL' }).expect(201);
    expect(paid.body).toMatchObject({ paidAmount: '80000', dueAmount: '100000' });
    await request(app.getHttpServer()).post(`/bar/receipts/${id}/payments`).send({ amountMinor: '180001', method: 'CASH' }).expect(409);
  });

  it('добавляет товар в открытый счет гостя', async () => {
    const body = { folioId: '90000000-0000-4000-8000-000000000001', productId: '30000000-0000-4000-8000-000000000001', quantityUnits: '2', idempotencyKey: 'folio-sale-1' };
    const sold = await request(app.getHttpServer()).post('/bar/sales/folio').send(body).expect(201);
    expect(sold.body).toMatchObject({ status: 'POSTED', chargeId: '91000000-0000-4000-8000-000000000001' });
  });

  it('фиксирует недостачу и блокирует излишек без цены', async () => {
    const productId = '30000000-0000-4000-8000-000000000001';
    const adjusted = await request(app.getHttpServer()).post('/bar/inventory-counts').send({ productId, actualUnits: '10', reason: 'Пересчет смены' }).expect(201);
    expect(adjusted.body.differenceUnits).toBe('-2');
    await request(app.getHttpServer()).post('/bar/inventory-counts').send({ productId, actualUnits: '13', reason: 'Найден излишек' }).expect(409);
  });
});
