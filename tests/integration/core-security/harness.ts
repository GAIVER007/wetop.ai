import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  createBeautyLocationInChain,
  createPrismaClient,
  createPropertyInChain,
  type Db,
} from '@pms/database';
import { isLocalDatabase } from '../../tools/seed-local';
import { AuthorInterceptor } from '../../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../../apps/api/src/auth/role.guard';
import { PrismaService } from '../../../apps/api/src/database/prisma.provider';
import {
  attachAuthor,
  currentOrganizationId,
  currentUserId,
  databaseTenant,
} from '../../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../../apps/api/src/database/property-ref';

/**
 * CORE-SECURITY-FIX-01: общая оснастка регрессионных тестов границы филиала/бизнеса/организации.
 * Основа: harness из CORE-01 U2. Данные вымышленные (ADR-010). Тесты не зависят друг от друга: у каждого файла своя
 * организация (случайные идентификаторы), общая только база `pms_test`.
 *
 * Two clients on the same local PostgreSQL:
 *  - admin: service role, seeds data, bypasses RLS;
 *  - tenant: the production shape. Requests of an organization go through role `wetop_app` with `app.org_id`
 *    (RLS active), exactly like PrismaService in apps/api.
 */
export const url = process.env.DATABASE_URL;

export type Scopes = Array<{
  role: 'MANAGER' | 'STAFF';
  businessId: string;
  locationId: string | null;
}>;

export interface Actor {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  platformAdmin: boolean;
  scopes?: Scopes;
}

export function makeClients(): { admin: Db; tenant: Db } {
  if (!url || !isLocalDatabase(url)) throw new Error('Own local database required');
  const appUrl = new URL(url);
  appUrl.username = 'wetop_app';
  appUrl.password = '';
  const admin = createPrismaClient(url, 'pms_test');
  const tenantRaw = createPrismaClient(url, 'pms_test', {
    of: databaseTenant,
    appConnectionString: appUrl.toString(),
  });
  // same audit-author extension as apps/api PrismaService.withAuthor
  const tenant = tenantRaw.$extends({
    query: {
      auditLog: {
        create({ args, query }) {
          return query(attachAuthor(args, currentUserId(), currentOrganizationId()));
        },
      },
    },
  }) as unknown as Db;
  return { admin, tenant };
}

/** Application with real modules, real guards, real interceptor; actor is chosen per request by header `x-test-actor` */
export async function bootApp(
  modules: Array<Type<unknown>>,
  tenant: Db,
  actors: Map<string, Actor>,
): Promise<{ app: INestApplication; base: string }> {
  const prisma = { db: tenant } as unknown as PrismaService;
  const mod = await Test.createTestingModule({ imports: modules })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();
  const app = mod.createNestApplication();
  app.use(
    (
      req: { headers: Record<string, string | undefined>; user?: object },
      _res: unknown,
      next: () => void,
    ) => {
      const key = req.headers['x-test-actor'];
      const actor = key ? actors.get(key) : undefined;
      if (actor) req.user = actor;
      next();
    },
  );
  app.useGlobalGuards(new RoleGuard(new Reflector()));
  app.useGlobalInterceptors(new AuthorInterceptor(prisma));
  await app.listen(0, '127.0.0.1');
  return { app, base: await app.getUrl() };
}

export const scopeHeader = (businessId?: string, locationId?: string): Record<string, string> =>
  businessId
    ? {
        'x-wetop-scope': locationId
          ? `business=${businessId};location=${locationId}`
          : `business=${businessId}`,
      }
    : {};

export interface CallResult {
  status: number;
  // тело ответа произвольной формы: тесты читают из него то, что проверяют
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
  text: string;
}

export async function call(
  base: string,
  actor: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  scope: { businessId?: string; locationId?: string } = {},
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<CallResult> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'x-test-actor': actor,
      'content-type': 'application/json',
      ...extraHeaders,
      ...scopeHeader(scope.businessId, scope.locationId),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text };
}

export interface Hotel {
  propertyId: string;
  locationId: string;
  businessId: string;
  typeId: string;
  unitCode: string;
  ratePlanId: string;
}

/** A hotel property inside the given Hospitality business (creates the business when absent) */
export async function seedHotel(
  admin: Db,
  organizationId: string,
  name: string,
  businessId?: string,
  code = 'T',
): Promise<Hotel> {
  return admin.$transaction(async (tx) => {
    const property = await createPropertyInChain(
      tx,
      organizationId,
      {
        name,
        address: `Test address ${name}`,
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      },
      businessId,
    );
    const location = await tx.location.findUniqueOrThrow({ where: { id: property.locationId } });
    const type = await tx.accommodationType.create({
      data: {
        propertyId: property.id,
        code: `${code}-DBL`,
        name: 'Double',
        kind: 'PRIVATE_ROOM',
        capacityAdults: 2,
        capacityChildren: 0,
      },
    });
    const building = await tx.building.create({ data: { propertyId: property.id, name: 'B' } });
    const floor = await tx.floor.create({ data: { buildingId: building.id, name: '1' } });
    const room = await tx.physicalRoom.create({
      data: { floorId: floor.id, roomNumber: '1', capacity: 2 },
    });
    const unitCode = `${code}1`;
    await tx.inventoryUnit.create({
      data: {
        propertyId: property.id,
        physicalRoomId: room.id,
        accommodationTypeId: type.id,
        code: unitCode,
        kind: 'ROOM',
        active: true,
      },
    });
    const plan = await tx.ratePlan.create({
      data: {
        propertyId: property.id,
        code: `${code}-BASE`,
        name: 'Base',
        currency: 'KZT',
        active: true,
      },
    });
    return {
      propertyId: property.id,
      locationId: location.id,
      businessId: location.businessId,
      typeId: type.id,
      unitCode,
      ratePlanId: plan.id,
    };
  });
}

export interface HotelGuest {
  guestId: string;
  reservationId: string;
  confirmationNumber: string;
  itemId: string;
  folioId: string;
  chargeId: string;
  paymentId: string;
}

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/** A guest with one confirmed reservation, folio, one charge and one payment in the given hotel */
export async function seedGuestStay(
  admin: Db,
  organizationId: string,
  hotel: Hotel,
  lastName: string,
  number: string,
): Promise<HotelGuest> {
  const guest = await admin.guest.create({
    data: {
      organizationId,
      firstName: 'Test',
      lastName,
      phone: '+77000000001',
      email: `${lastName.toLowerCase()}@example.invalid`,
      notes: `secret note ${lastName}`,
    },
  });
  const reservation = await admin.reservation.create({
    data: {
      propertyId: hotel.propertyId,
      confirmationNumber: number,
      source: 'WALK_IN',
      status: 'CONFIRMED',
      arrivalDate: new Date(day(5)),
      departureDate: new Date(day(7)),
      adults: 1,
      currency: 'KZT',
      totalAmount: 2_000_000n,
      primaryGuestId: guest.id,
      bookedAt: new Date(),
    },
  });
  const item = await admin.reservationItem.create({
    data: {
      reservationId: reservation.id,
      accommodationTypeId: hotel.typeId,
      arrivalDate: new Date(day(5)),
      departureDate: new Date(day(7)),
      price: 2_000_000n,
      status: 'CONFIRMED',
      ratePlanId: hotel.ratePlanId,
      adults: 1,
    },
  });
  await admin.stayGuest.create({
    data: { reservationItemId: item.id, guestId: guest.id, isPrimary: true },
  });
  const folio = await admin.folio.create({
    data: { reservationItemId: item.id, currency: 'KZT' },
  });
  const charge = await admin.charge.create({
    data: {
      folioId: folio.id,
      kind: 'ACCOMMODATION',
      description: 'Accommodation',
      quantity: 1,
      unitPrice: 2_000_000n,
      amount: 2_000_000n,
    },
  });
  const payment = await admin.payment.create({
    data: {
      propertyId: hotel.propertyId,
      method: 'CASH',
      amount: 500_000n,
      currency: 'KZT',
      status: 'COMPLETED',
    },
  });
  await admin.paymentAllocation.create({
    data: { paymentId: payment.id, folioId: folio.id, amount: 500_000n },
  });
  return {
    guestId: guest.id,
    reservationId: reservation.id,
    confirmationNumber: number,
    itemId: item.id,
    folioId: folio.id,
    chargeId: charge.id,
    paymentId: payment.id,
  };
}

export async function seedLocation(
  admin: Db,
  organizationId: string,
  name: string,
  vertical: 'BEAUTY' | 'FOOD_SERVICE',
  businessId?: string,
) {
  return admin.$transaction((tx) =>
    createBeautyLocationInChain(
      tx,
      organizationId,
      { name, timezone: 'Asia/Almaty', currency: 'KZT' },
      vertical,
      businessId,
    ),
  );
}

export async function seedUser(
  admin: Db,
  organizationId: string,
  role: 'OWNER' | 'MANAGER' | 'STAFF',
  tag: string,
) {
  const id = randomUUID();
  await admin.user.create({
    data: { id, email: `csf-${tag.toLowerCase()}-${id}@example.invalid`, name: `CSF ${tag}` },
  });
  await admin.membership.create({ data: { userId: id, organizationId, role } });
  return id;
}

export const actorOf = (
  id: string,
  organizationId: string,
  role: Actor['role'],
  scopes?: Scopes,
): Actor => ({
  id,
  email: `${id}@example.invalid`,
  name: 'CSF',
  organizationId,
  role,
  platformAdmin: false,
  ...(scopes ? { scopes } : {}),
});

export { forgetPropertyRef };

/** Ближайший понедельник строго после сегодняшнего дня по Алматы, плюс `plusWeeks` недель (YYYY-MM-DD) */
export function nextMonday(plusWeeks = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 1);
  d.setUTCDate(d.getUTCDate() + 7 * plusWeeks);
  return d.toISOString().slice(0, 10);
}

/** Момент `hhmm` по Алматы (UTC+5) в день `day` в виде ISO-строки */
export function almatyAt(day: string, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y as number, (mo as number) - 1, d, (h as number) - 5, m)).toISOString();
}
