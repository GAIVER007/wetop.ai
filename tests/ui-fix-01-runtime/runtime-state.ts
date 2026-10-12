import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createPrismaClient, type Db } from '@pms/database';
import { hashPassword, LUXX_APARTS_PROPERTY } from '@pms/domain';
import { isLocalDatabase } from '../tools/seed-local';
import { purgeAuditRows } from '../tools/audit-purge';

export const STATE_PATH = process.env.UI_FIX_01_STATE ?? '/tmp/wetop-ui-fix-01-runtime-state.json';
export const PASSWORD = 'UI-FIX-01-local-only-2026';

export interface RuntimeState {
  run: string;
  organizationId: string;
  foreignOrganizationId: string;
  userId: string;
  email: string;
  businessId: string;
  locationId: string;
  foreignBusinessId: string;
  foreignLocationId: string;
  customerId: string;
  customerName: string;
  foreignCustomerId: string;
  foreignCustomerName: string;
  beautyBusinessId: string;
  beautyLocationId: string;
  beautyLocationName: string;
  hospitalityBusinessId: string;
  hospitalityLocationId: string;
  hospitalityLocationName: string;
  propertyId: string;
  privateCategoryId: string;
  privateCategoryCode: string;
  dormCategoryId: string;
  dormCategoryCode: string;
}

function adminDb(): Db {
  const url = process.env.DATABASE_URL ?? '';
  if (!isLocalDatabase(url)) throw new Error('UI-FIX-01 runtime requires a loopback DATABASE_URL');
  const schema = process.env.DATABASE_SCHEMA;
  if (schema !== 'pms_test') throw new Error('UI-FIX-01 runtime requires DATABASE_SCHEMA=pms_test');
  return createPrismaClient(url, schema);
}

export async function seedRuntime(): Promise<RuntimeState> {
  if (existsSync(STATE_PATH)) await cleanupRuntime();
  const db = adminDb();
  const run = randomUUID().slice(0, 8);
  const state: RuntimeState = {
    run,
    organizationId: randomUUID(),
    foreignOrganizationId: randomUUID(),
    userId: randomUUID(),
    email: `ui-fix-01-owner-${run}@example.invalid`,
    businessId: randomUUID(),
    locationId: randomUUID(),
    foreignBusinessId: randomUUID(),
    foreignLocationId: randomUUID(),
    customerId: randomUUID(),
    customerName: `Клиент Runtime ${run}`,
    foreignCustomerId: randomUUID(),
    foreignCustomerName: `Чужой клиент Runtime ${run}`,
    beautyBusinessId: randomUUID(),
    beautyLocationId: randomUUID(),
    beautyLocationName: `Салон Runtime ${run}`,
    hospitalityBusinessId: randomUUID(),
    hospitalityLocationId: randomUUID(),
    hospitalityLocationName: LUXX_APARTS_PROPERTY.name,
    propertyId: randomUUID(),
    privateCategoryId: randomUUID(),
    privateCategoryCode: `PRIVATE-${run}`,
    dormCategoryId: randomUUID(),
    dormCategoryCode: `DORM-${run}`,
  };
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  try {
    await db.organization.createMany({
      data: [
        { id: state.organizationId, name: `UI-FIX-01 ${run}`, status: 'ACTIVE' },
        { id: state.foreignOrganizationId, name: `UI-FIX-01 foreign ${run}`, status: 'ACTIVE' },
      ],
    });
    await db.user.create({
      data: {
        id: state.userId,
        email: state.email,
        name: 'Владелец Runtime',
        passwordHash: hashPassword(PASSWORD),
        emailVerifiedAt: new Date(),
      },
    });
    await db.membership.create({
      data: { userId: state.userId, organizationId: state.organizationId, role: 'OWNER' },
    });
    await db.platformAdmin.create({
      data: { userId: state.userId, note: `UI-FIX-01 ${run}` },
    });
    await db.business.createMany({
      data: [
        {
          id: state.businessId,
          organizationId: state.organizationId,
          name: `Ресторан Runtime ${run}`,
          vertical: 'FOOD_SERVICE',
        },
        {
          id: state.foreignBusinessId,
          organizationId: state.foreignOrganizationId,
          name: `Чужой ресторан Runtime ${run}`,
          vertical: 'FOOD_SERVICE',
        },
        {
          id: state.hospitalityBusinessId,
          organizationId: state.organizationId,
          name: `Гостиница Runtime ${run}`,
          vertical: 'HOSPITALITY',
        },
        {
          id: state.beautyBusinessId,
          organizationId: state.organizationId,
          name: `Beauty Runtime ${run}`,
          vertical: 'BEAUTY',
        },
      ],
    });
    await db.location.createMany({
      data: [
        {
          id: state.locationId,
          businessId: state.businessId,
          name: `Филиал Runtime ${run}`,
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        },
        {
          id: state.foreignLocationId,
          businessId: state.foreignBusinessId,
          name: `Чужой филиал Runtime ${run}`,
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        },
        {
          id: state.hospitalityLocationId,
          businessId: state.hospitalityBusinessId,
          name: state.hospitalityLocationName,
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        },
        {
          id: state.beautyLocationId,
          businessId: state.beautyBusinessId,
          name: state.beautyLocationName,
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        },
      ],
    });
    await db.property.create({
      data: {
        id: state.propertyId,
        organizationId: state.organizationId,
        locationId: state.hospitalityLocationId,
        name: state.hospitalityLocationName,
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      },
    });
    await db.accommodationType.createMany({
      data: [
        {
          id: state.privateCategoryId,
          propertyId: state.propertyId,
          code: state.privateCategoryCode,
          name: `Номер Runtime ${run}`,
          kind: 'PRIVATE_ROOM',
          capacityAdults: 2,
        },
        {
          id: state.dormCategoryId,
          propertyId: state.propertyId,
          code: state.dormCategoryCode,
          name: `Койка Runtime ${run}`,
          kind: 'DORM_BED',
          capacityAdults: 1,
        },
      ],
    });
    await db.customer.createMany({
      data: [
        {
          id: state.customerId,
          organizationId: state.organizationId,
          firstName: state.customerName,
          lastName: 'Синтетический',
          phone: '+77000000001',
          email: `customer-${run}@example.invalid`,
          status: 'ACTIVE',
          isVip: false,
          birthDate: new Date('1990-05-01T00:00:00Z'),
        },
        {
          id: state.foreignCustomerId,
          organizationId: state.foreignOrganizationId,
          firstName: state.foreignCustomerName,
          lastName: 'Изолированный',
          phone: '+77000000002',
          email: `foreign-customer-${run}@example.invalid`,
          status: 'ACTIVE',
          isVip: false,
          birthDate: new Date('1988-04-03T00:00:00Z'),
        },
      ],
    });
    await db.customerBusiness.createMany({
      data: [
        { customerId: state.customerId, businessId: state.businessId },
        { customerId: state.foreignCustomerId, businessId: state.foreignBusinessId },
      ],
    });
    return state;
  } catch (error) {
    await cleanupRuntime(state, db).catch(() => undefined);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

export function readRuntimeState(): RuntimeState {
  return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as RuntimeState;
}

export async function cleanupRuntime(state = readRuntimeState(), openDb?: Db): Promise<void> {
  const db = openDb ?? adminDb();
  try {
    await purgeAuditRows(db, { organizationId: state.organizationId });
    await db.invite.deleteMany({ where: { organizationId: state.organizationId } });
    await db.session.deleteMany({ where: { organizationId: state.organizationId } });
    await db.membershipScope.deleteMany({ where: { organizationId: state.organizationId } });
    await db.customerBusiness.deleteMany({
      where: { customerId: { in: [state.customerId, state.foreignCustomerId] } },
    });
    await db.customer.deleteMany({
      where: { id: { in: [state.customerId, state.foreignCustomerId] } },
    });
    await db.inventoryUnit.deleteMany({ where: { propertyId: state.propertyId } });
    await db.physicalRoom.deleteMany({
      where: { floor: { building: { propertyId: state.propertyId } } },
    });
    await db.floor.deleteMany({ where: { building: { propertyId: state.propertyId } } });
    await db.building.deleteMany({ where: { propertyId: state.propertyId } });
    await db.accommodationType.deleteMany({ where: { propertyId: state.propertyId } });
    // Finance reads seed categories for this isolated property; remove them before its parent.
    await db.cashCategory.deleteMany({ where: { propertyId: state.propertyId } });
    await db.property.deleteMany({ where: { id: state.propertyId } });
    await db.location.deleteMany({
      where: {
        id: {
          in: [
            state.locationId,
            state.foreignLocationId,
            state.hospitalityLocationId,
            state.beautyLocationId,
          ],
        },
      },
    });
    await db.business.deleteMany({
      where: {
        id: {
          in: [
            state.businessId,
            state.foreignBusinessId,
            state.hospitalityBusinessId,
            state.beautyBusinessId,
          ],
        },
      },
    });
    await db.platformAdmin.deleteMany({ where: { userId: state.userId } });
    await db.membership.deleteMany({ where: { userId: state.userId } });
    await db.user.deleteMany({ where: { id: state.userId } });
    await db.organization.deleteMany({
      where: { id: { in: [state.organizationId, state.foreignOrganizationId] } },
    });
  } finally {
    if (!openDb) await db.$disconnect();
  }
}
