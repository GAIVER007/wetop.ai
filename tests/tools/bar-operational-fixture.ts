import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Controller, Get } from '@nestjs/common';
import { FinanceModule } from '../../apps/api/src/finance/finance.module';
import { HotelModule } from '../../apps/api/src/hotel/hotel.module';
import { currentBusinessId, currentLocationId, currentVertical } from '../../apps/api/src/auth/request-context';
import { Access } from '../../apps/api/src/auth/access.decorator';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { createPrismaClient, createPropertyInChain } from '@pms/database';
import type { MembershipRole } from '@pms/domain';
import { BarModule } from '../../apps/api/src/bar/bar.module';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { isLocalDatabase } from './seed-local';

export async function barOperationalFixture(port = 0) {
  if (!isLocalDatabase(process.env.DATABASE_URL ?? '')) throw new Error('BAR acceptance requires own localhost PostgreSQL');
  const db = createPrismaClient(process.env.DATABASE_URL, process.env.DATABASE_SCHEMA || 'pms_test');
  const user = await db.user.create({ data: { name: 'Synthetic BAR owner', email: `bar-${randomUUID()}@example.invalid` } });
  const sides: Array<{ org: string; property: string; business: string; location: string; folio: string }> = [];
  async function side() {
    const org = await db.organization.create({ data: { name: `BAR operational synthetic ${randomUUID()}`, status: 'ACTIVE' } });
    const property = await db.$transaction(tx => createPropertyInChain(tx, org.id, {
      name: 'BAR operational synthetic', timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00',
    }));
    const location = await db.location.findUniqueOrThrow({ where: { id: property.locationId } });
    const type = await db.accommodationType.create({ data: { propertyId: property.id, code: 'BAR', name: 'Synthetic room', kind: 'PRIVATE_ROOM', capacityAdults: 1 } });
    const reservation = await db.reservation.create({ data: {
      propertyId: property.id, confirmationNumber: randomUUID(), source: 'DESK', status: 'CONFIRMED',
      arrivalDate: new Date('2030-01-01'), departureDate: new Date('2030-01-02'), adults: 1, currency: 'KZT', totalAmount: 0n,
      items: { create: { accommodationTypeId: type.id, arrivalDate: new Date('2030-01-01'), departureDate: new Date('2030-01-02'), price: 0n, status: 'CONFIRMED', folio: { create: { currency: 'KZT' } } } },
    }, include: { items: { include: { folio: true } } } });
    const result = { org: org.id, property: property.id, business: location.businessId, location: location.id, folio: reservation.items[0]!.folio!.id };
    sides.push(result);
    return result;
  }
  const primary = await side();
  let browserData: unknown;
  class IdentityController {
    health() { return { ok: true }; }
    data() { return browserData; }
    async me() {
      return { user: { ...user, role: 'OWNER', organization: await db.organization.findUniqueOrThrow({ where: { id: primary.org } }) },
        context: { businessId: currentBusinessId(), locationId: currentLocationId(), vertical: currentVertical() } };
    }
  }
  Controller()(IdentityController);
  const descriptor = Object.getOwnPropertyDescriptor(IdentityController.prototype, 'me')!;
  Get('auth/me')(IdentityController.prototype, 'me', descriptor);
  Access('desk')(IdentityController.prototype, 'me', descriptor);
  for (const name of ['health', 'data'] as const) {
    const route = Object.getOwnPropertyDescriptor(IdentityController.prototype, name)!;
    Get(`__test/${name}`)(IdentityController.prototype, name, route);
    Access('desk')(IdentityController.prototype, name, route);
  }
  const module = await Test.createTestingModule({ imports: [BarModule, HotelModule, FinanceModule], controllers: [IdentityController] }).overrideProvider(PrismaService).useValue({ db }).compile();
  const app = module.createNestApplication();
  app.getHttpAdapter().getInstance().set('json replacer', (_key: string, value: unknown) => typeof value === 'bigint' ? value.toString() : value);
  app.use((req: { user?: object; headers: Record<string, string> }, _res: unknown, next: () => void) => {
    const selected = sides.find(s => s.org === req.headers['x-bar-fixture-org']) ?? primary;
    req.user = { id: user.id, organizationId: selected.org, role: req.headers['x-bar-fixture-role'] ?? 'OWNER' };
    next();
  });
  app.useGlobalGuards(new RoleGuard(new Reflector()));
  app.useGlobalInterceptors(new AuthorInterceptor({ db } as PrismaService));
  await app.listen(port, '127.0.0.1');
  const base = await app.getUrl();
  async function request(path: string, body?: unknown, options: { side?: typeof primary; role?: MembershipRole; method?: string } = {}) {
    const selected = options.side ?? primary;
    const response = await fetch(`${base}${path.startsWith('/') ? path : `/bar/${path}`}`, {
      method: options.method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json', 'x-bar-fixture-org': selected.org, 'x-bar-fixture-role': options.role ?? 'OWNER', 'x-wetop-scope': `business=${selected.business};location=${selected.location}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  async function prepare(selected = primary) {
    const options = { side: selected };
    const category = (await request('categories', { name: 'Synthetic category', defaultMarkupBasis: 0 }, options)).body;
    const supplier = (await request('suppliers', { name: 'Synthetic supplier' }, options)).body;
    const product = async (code: string) => (await request('products', {
      code, name: `Synthetic ${code}`, barcode: `BAR-${randomUUID()}`, categoryId: category.id,
      unitsPerPackage: 1, markupBasis: 10000, salePriceMinor: '100', minimumStockUnits: '0',
    }, options)).body;
    const a = await product('A'), b = await product('B');
    const receipt = async (lines: unknown[], document: string) => request('receipts', {
      supplierId: supplier.id, documentNumber: document, documentDate: '2026-10-07', receivedDate: '2026-10-07', currency: 'KZT', lines,
    }, options);
    const line = (id: string, units: string, cost: string) => ({ productId: id, quantityUnits: units, unitCostMinor: cost, markupBasis: 10000 });
    const r1 = (await receipt([line(a.id, '10', '10000'), line(b.id, '4', '5000')], 'R1')).body;
    const r2 = (await receipt([line(a.id, '10', '16000')], 'R2')).body;
    return { a, b, r1, r2, supplier, category, options };
  }
  return { db, app, base, user, primary, side, request, prepare, recoverOwnFixtures: async () => {
    const organizations = await db.organization.findMany({ where: { name: { startsWith: 'BAR operational synthetic ' } } });
    for (const organization of organizations) {
      if (sides.some(s => s.org === organization.id)) continue;
      const properties = await db.property.findMany({ where: { organizationId: organization.id }, include: { location: true } });
      for (const property of properties) {
        const folio = await db.folio.findFirstOrThrow({ where: { reservationItem: { reservation: { propertyId: property.id } } } });
        sides.push({ org: organization.id, property: property.id, location: property.locationId!, business: property.location!.businessId, folio: folio.id });
      }
    }
  }, setBrowserData: (data: unknown) => { browserData = data; }, close: async () => {
    await app.close();
    const evidence = [];
    for (const selected of sides) {
      evidence.push({ ...selected,
        receipts: await db.barReceipt.findMany({ where: { propertyId: selected.property }, include: { lines: true, payments: true } }),
        sales: await db.barSale.findMany({ where: { propertyId: selected.property }, include: { lines: true } }),
        lots: await db.barStockLot.findMany({ where: { propertyId: selected.property } }),
        movements: await db.barStockMovement.findMany({ where: { propertyId: selected.property } }),
        cash: await db.cashOperation.findMany({ where: { propertyId: selected.property } }),
        charges: await db.charge.findMany({ where: { folioId: selected.folio } }),
      });
      const marker = await db.organization.findUniqueOrThrow({ where: { id: selected.org } });
      if (!marker.name.startsWith('BAR operational synthetic ')) throw new Error('Synthetic cleanup marker mismatch');
      await db.$transaction(async tx => {
        const propertyId = selected.property;
        await tx.barSupplierPayment.deleteMany({ where: { receipt: { propertyId } } });
        await tx.barSaleLine.deleteMany({ where: { sale: { propertyId } } });
        await tx.barSale.deleteMany({ where: { propertyId } });
        await tx.barStockMovement.deleteMany({ where: { propertyId } });
        await tx.barStockLot.deleteMany({ where: { propertyId } });
        await tx.barReceiptLine.deleteMany({ where: { receipt: { propertyId } } });
        await tx.barReceipt.deleteMany({ where: { propertyId } });
        await tx.barProduct.deleteMany({ where: { propertyId } });
        await tx.barCategory.deleteMany({ where: { propertyId } });
        await tx.barSupplier.deleteMany({ where: { propertyId } });
        await tx.charge.deleteMany({ where: { folioId: selected.folio } });
        await tx.cashOperation.deleteMany({ where: { propertyId } });
        await tx.cashCategory.deleteMany({ where: { propertyId } });
        await tx.paymentAllocation.deleteMany({ where: { folioId: selected.folio } });
        await tx.payment.deleteMany({ where: { propertyId } });
        await tx.folio.deleteMany({ where: { id: selected.folio } });
        await tx.reservationItem.deleteMany({ where: { reservation: { propertyId } } });
        await tx.reservation.deleteMany({ where: { propertyId } });
        await tx.accommodationType.deleteMany({ where: { propertyId } });
        await tx.property.deleteMany({ where: { id: propertyId } });
        await tx.location.deleteMany({ where: { id: selected.location } });
        await tx.business.deleteMany({ where: { id: selected.business } });
        await tx.organization.deleteMany({ where: { id: selected.org } });
      });
    }
    const audit = await db.auditLog.findMany({ where: { userId: user.id } });
    // Preserve the append-only audit and its synthetic author; no audit purge.
    await mkdir('reports/bar-operational-20261007', { recursive: true });
    await writeFile(`reports/bar-operational-20261007/${user.id}.json`, JSON.stringify({ userId: user.id, evidence, audit, cleanup: 'own operational rows deleted after marker check; append-only audit and synthetic author retained' }, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    await db.$disconnect();
  } };
}
export type BarOperationalFixture = Awaited<ReturnType<typeof barOperationalFixture>>;
