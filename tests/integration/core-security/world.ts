import { randomUUID } from 'node:crypto';
import type { Db } from '@pms/database';
import { actorOf, seedLocation, seedUser, type Actor } from './harness';

/**
 * CORE-SECURITY-FIX-01: стенд салона и ресторана для проверок границы филиала/бизнеса/организации.
 *
 * Организация `org`:
 *   Beauty-бизнес BZ: филиалы BL1, BL2;  второй Beauty-бизнес BZ2: филиал BL3
 *   Food-бизнес FB: филиалы FL1, FL2;    второй Food-бизнес FB2: филиал FL3
 * Чужая организация `foreignOrg`: свой салон FBZ с филиалом FBL1 (клиент, мастер).
 *
 * Мастера Beauty (бизнес BZ): `eBl1` работает в BL1 (пн 09:00-18:00, услуга назначена),
 * `eBl1b` второй такой же в BL1, `eBl2` только в BL2 с графиком вт 09:00-18:00. Мастер чужого бизнеса BZ2: `eBz2`.
 * Клиенты: `cBz` (виден бизнесу BZ), `cBz2` (виден только BZ2), `cFood` (виден только FB), `cForeign` (чужая организация),
 * `cArchived` (организация `org`, архивный, виден BZ).
 *
 * Действующие лица (ключ в `actors`):
 *   owner        OWNER без назначений
 *   orgMgr       MANAGER без назначений (вся организация)
 *   mgrBl1       MANAGER, назначение только на филиал BL1
 *   staffBl1     STAFF, назначение только на филиал BL1
 *   mgrBz        MANAGER, назначение на весь бизнес BZ
 *   mgrFl1       MANAGER, назначение только на филиал FL1
 *   staffFl1     STAFF, назначение только на филиал FL1
 *   foreignOwner OWNER чужой организации
 */
export interface BeautyFoodWorld {
  org: string;
  foreignOrg: string;
  ids: Record<string, string>;
  actors: Map<string, Actor>;
}

export const sameDayAfter = (day: string, plus: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + plus);
  return d.toISOString().slice(0, 10);
};

export async function seedBeautyFoodWorld(admin: Db): Promise<BeautyFoodWorld> {
  const org = randomUUID();
  const foreignOrg = randomUUID();
  await admin.organization.create({ data: { id: org, name: `CSF-${org}`, status: 'ACTIVE' } });
  await admin.organization.create({
    data: { id: foreignOrg, name: `CSF-foreign-${foreignOrg}`, status: 'ACTIVE' },
  });

  const bl1 = await seedLocation(admin, org, 'CSF Salon 1', 'BEAUTY');
  const bl2 = await seedLocation(admin, org, 'CSF Salon 2', 'BEAUTY', bl1.businessId);
  const bz2 = await admin.business.create({
    data: { organizationId: org, name: 'CSF Salon B2', vertical: 'BEAUTY' },
  });
  const bl3 = await seedLocation(admin, org, 'CSF Salon 3', 'BEAUTY', bz2.id);
  const fl1 = await seedLocation(admin, org, 'CSF Rest 1', 'FOOD_SERVICE');
  const fl2 = await seedLocation(admin, org, 'CSF Rest 2', 'FOOD_SERVICE', fl1.businessId);
  const fb2 = await admin.business.create({
    data: { organizationId: org, name: 'CSF Rest B2', vertical: 'FOOD_SERVICE' },
  });
  const fl3 = await seedLocation(admin, org, 'CSF Rest 3', 'FOOD_SERVICE', fb2.id);
  const fbl1 = await seedLocation(admin, foreignOrg, 'CSF Foreign Salon', 'BEAUTY');

  const ids: Record<string, string> = {
    bz: bl1.businessId,
    bl1: bl1.id,
    bl2: bl2.id,
    bz2: bz2.id,
    bl3: bl3.id,
    fb: fl1.businessId,
    fl1: fl1.id,
    fl2: fl2.id,
    fb2: fb2.id,
    fl3: fl3.id,
    fbz: fbl1.businessId,
    fbl1: fbl1.id,
  };

  // услуга бизнеса BZ, включена в BL1 и BL2
  const svc = await admin.beautyService.create({
    data: {
      businessId: bl1.businessId,
      name: 'Manicure',
      durationMinutes: 60,
      price: 800_000n,
      currency: 'KZT',
    },
  });
  await admin.locationService.create({
    data: { locationId: bl1.id, serviceId: svc.id, enabled: true },
  });
  await admin.locationService.create({
    data: { locationId: bl2.id, serviceId: svc.id, enabled: true },
  });

  const hours = (employeeId: string, locationId: string, weekday: number) =>
    admin.workingHours.create({
      data: {
        employeeId,
        locationId,
        weekday,
        timeFrom: new Date('1970-01-01T09:00:00Z'),
        timeTo: new Date('1970-01-01T18:00:00Z'),
      },
    });
  const master = async (
    businessId: string,
    name: string,
    locationId: string,
    withService: boolean,
  ) => {
    const e = await admin.employee.create({ data: { businessId, name } });
    await admin.employeeLocation.create({ data: { employeeId: e.id, locationId } });
    if (withService)
      await admin.employeeService.create({ data: { employeeId: e.id, serviceId: svc.id } });
    return e;
  };
  const eBl1 = await master(bl1.businessId, 'CSF master BL1', bl1.id, true);
  await hours(eBl1.id, bl1.id, 1);
  const eBl1b = await master(bl1.businessId, 'CSF master BL1 second', bl1.id, true);
  await hours(eBl1b.id, bl1.id, 1);
  const eBl2 = await master(bl1.businessId, 'CSF master BL2 only', bl2.id, true);
  await hours(eBl2.id, bl2.id, 2);
  const eBz2 = await master(bz2.id, 'CSF master other business', bl3.id, false);
  const eForeign = await master(fbl1.businessId, 'CSF master foreign org', fbl1.id, false);

  const customer = async (
    organizationId: string,
    businessId: string,
    firstName: string,
    phone: string,
    status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE',
  ) => {
    const c = await admin.customer.create({
      data: { organizationId, firstName, lastName: 'Client', phone, status },
    });
    await admin.customerBusiness.create({ data: { customerId: c.id, businessId } });
    return c;
  };
  const cBz = await customer(org, bl1.businessId, 'CsfBz', '+77005550001');
  const cBz2 = await customer(org, bz2.id, 'CsfBz2', '+77005550002');
  const cFood = await customer(org, fl1.businessId, 'CsfFood', '+77005550003');
  const cForeign = await customer(foreignOrg, fbl1.businessId, 'CsfForeign', '+77005550004');
  const cArchived = await customer(org, bl1.businessId, 'CsfArchived', '+77005550005', 'ARCHIVED');

  Object.assign(ids, {
    svc: svc.id,
    eBl1: eBl1.id,
    eBl1b: eBl1b.id,
    eBl2: eBl2.id,
    eBz2: eBz2.id,
    eForeign: eForeign.id,
    cBz: cBz.id,
    cBz2: cBz2.id,
    cFood: cFood.id,
    cForeign: cForeign.id,
    cArchived: cArchived.id,
  });

  const actors = new Map<string, Actor>();
  const user = async (role: 'OWNER' | 'MANAGER' | 'STAFF', tag: string, orgId = org) =>
    seedUser(admin, orgId, role, tag);
  actors.set('owner', actorOf(await user('OWNER', 'owner'), org, 'OWNER'));
  actors.set('orgMgr', actorOf(await user('MANAGER', 'orgmgr'), org, 'MANAGER'));
  actors.set(
    'mgrBl1',
    actorOf(await user('MANAGER', 'mgrbl1'), org, 'MANAGER', [
      { role: 'MANAGER', businessId: ids.bz!, locationId: ids.bl1! },
    ]),
  );
  actors.set(
    'staffBl1',
    actorOf(await user('STAFF', 'staffbl1'), org, 'STAFF', [
      { role: 'STAFF', businessId: ids.bz!, locationId: ids.bl1! },
    ]),
  );
  actors.set(
    'mgrBz',
    actorOf(await user('MANAGER', 'mgrbz'), org, 'MANAGER', [
      { role: 'MANAGER', businessId: ids.bz!, locationId: null },
    ]),
  );
  actors.set(
    'mgrFl1',
    actorOf(await user('MANAGER', 'mgrfl1'), org, 'MANAGER', [
      { role: 'MANAGER', businessId: ids.fb!, locationId: ids.fl1! },
    ]),
  );
  actors.set(
    'staffFl1',
    actorOf(await user('STAFF', 'stafffl1'), org, 'STAFF', [
      { role: 'STAFF', businessId: ids.fb!, locationId: ids.fl1! },
    ]),
  );
  actors.set(
    'foreignOwner',
    actorOf(await user('OWNER', 'foreignowner', foreignOrg), foreignOrg, 'OWNER'),
  );
  // Beauty writes revalidate the live assignments against the request actor.
  // Persist only the same declared fixture scopes, never broaden actors to OWNER.
  for (const actor of actors.values()) {
    if (!actor.scopes?.length) continue;
    await admin.membershipScope.createMany({
      data: actor.scopes.map((scope) => ({
        userId: actor.id,
        organizationId: actor.organizationId,
        role: scope.role,
        businessId: scope.businessId,
        locationId: scope.locationId,
      })),
    });
  }
  return { org, foreignOrg, ids, actors };
}
