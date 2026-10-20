import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { EmployeePortalController } from '../../apps/api/src/employee-portal/employee-portal.module';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { assertPortalDatabase, seedPortalFixture } from '../employee-portal-ui/fixture-support';

const db = createPrismaClient(assertPortalDatabase(), 'pms_test');
const service = new EmployeePortalService({ db } as PrismaService, null);
let f: Awaited<ReturnType<typeof seedPortalFixture>>;
let app: INestApplication;
let base: string;
const self = <T>(fn: () => Promise<T>) => withSignedInUser({ ...f.actors.staffA, scope: 'LOCATION', locationId: f.locationA }, fn);
const owner = <T>(fn: () => Promise<T>) => withSignedInUser({ ...f.actors.ownerA, scope: 'LOCATION', locationId: f.locationA }, fn);
let own: string;
let branch: string;
let other: string;
let ownLineId: string;
let branchLineId: string;
let otherLineId: string;
let before: unknown;
const snapshot = async () => ({ appointments: await db.appointment.findMany({ where: { location: { businessId: f.businessA } }, orderBy: { id: 'asc' } }), lines: await db.appointmentLine.findMany({ where: { appointment: { location: { businessId: f.businessA } } }, orderBy: { id: 'asc' } }), payments: await db.restaurantCashOperation.findMany({ where: { location: { businessId: f.businessA } }, orderBy: { id: 'asc' } }) });

describe('portal schedule warnings and anonymous cache revocation', () => {
  beforeAll(async () => {
    f = await seedPortalFixture(db);
    await db.location.update({ where: { id: f.locationB }, data: { timezone: 'Pacific/Honolulu' } });
    const customer = await db.customer.create({ data: { organizationId: f.organizationA, firstName: 'Synthetic private customer' } });
    const appointment = async (locationId: string, employeeId: string, startsAt: string, status: 'BOOKED' | 'CANCELLED' = 'BOOKED') => db.appointment.create({ data: { locationId, employeeId, customerId: customer.id, serviceId: f.serviceId!, startsAt: new Date(startsAt), endsAt: new Date(new Date(startsAt).getTime() + 30 * 60000), status, price: 6500n, currency: 'KZT' } });
    own = (await appointment(f.locationA, f.employeeA, '2035-01-08T05:00:00Z')).id;
    branch = (await appointment(f.locationB, f.employeeA, '2035-01-09T05:00:00Z')).id;
    other = (await appointment(f.locationA, f.employeeB, '2035-01-08T05:00:00Z')).id;
    // Canonical warnings identify individual service lines, not the shared visit envelope.
    // Derive IDs through the actual FK and assert the complete intended synthetic relation;
    // do not replace expected UUIDs with arbitrary observed warning IDs.
    const lineId = async (appointmentId: string, employeeId: string) => {
      const lines = await db.appointmentLine.findMany({ where: { appointmentId }, include: { appointment: true }, orderBy: { position: 'asc' } });
      expect(lines).toHaveLength(1);
      const line = lines[0]!;
      expect(line).toMatchObject({ appointmentId, employeeId, serviceId: f.serviceId, position: 0, startsAt: line.appointment.startsAt, endsAt: line.appointment.endsAt });
      expect(line.id).not.toBe(appointmentId);
      return line.id;
    };
    ownLineId = await lineId(own, f.employeeA);
    branchLineId = await lineId(branch, f.employeeA);
    otherLineId = await lineId(other, f.employeeB);
    await appointment(f.locationA, f.employeeA, '2035-01-08T07:00:00Z', 'CANCELLED');
    for (const locationId of [f.locationA, f.locationB]) await db.workingHours.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({ employeeId: f.employeeA, locationId, weekday, timeFrom: new Date('1970-01-01T00:00:00Z'), timeTo: new Date('1970-01-01T23:59:00Z') })) });
    await db.restaurantCashOperation.create({ data: { locationId: f.locationA, kind: 'INCOME', method: 'CASH', amount: 1000n, currency: 'KZT', appointmentId: own, createdById: f.actors.ownerA.userId } });
    before = await snapshot();
    const module = await Test.createTestingModule({ controllers: [EmployeePortalController], providers: [{ provide: EmployeePortalService, useValue: service }] }).compile();
    app = module.createNestApplication(); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); await db.$disconnect(); });

  it('shows a booked own appointment outside a replacement week, not only the selected date', async () => {
    let dto = await self(() => service.get(null, { date: '2034-01-01' }));
    const old = dto.weekRevision;
    expect(dto.scheduleConflicts.items).toEqual([]);
    dto = await owner(() => service.mutate(f.employeeA, 'week', { intervals: [], expectedRevision: old }));
    expect(dto.scheduleConflicts.items.map(a => a.id)).toEqual([ownLineId]);
    expect(dto.scheduleConflicts.items[0]).toMatchObject({ reason: 'OUTSIDE_WORKING_HOURS', locationId: f.locationA });
    expect(dto.scheduleConflicts.items.map(a => a.id)).not.toContain(otherLineId);
    expect(JSON.stringify(dto.scheduleConflicts)).not.toContain('Synthetic private customer');
    await expect(owner(() => service.mutate(f.employeeA, 'week', { intervals: [], expectedRevision: old }))).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it('checks own absence across assigned branches in each appointment timezone and clears on delete', async () => {
    let dto = await self(() => service.get(null, {}));
    dto = await owner(() => service.mutate(f.employeeA, 'week', { intervals: Array.from({ length: 7 }, (_, weekday) => ({ weekday, timeFrom: '00:00', timeTo: '23:59' })), expectedRevision: dto.weekRevision }));
    expect(dto.scheduleConflicts.items).toEqual([]);
    dto = await owner(() => service.mutate(f.employeeA, 'time-off', { dateFrom: '2035-01-08', dateTo: '2035-01-08', reason: 'Synthetic leave' }));
    expect(dto.scheduleConflicts.items.map(a => a.id)).toEqual([ownLineId, branchLineId]);
    expect(dto.scheduleConflicts.items.every(a => a.reason === 'TIME_OFF')).toBe(true);
    expect(dto.scheduleConflicts.items[1]).toMatchObject({ date: '2035-01-08', timezone: 'Pacific/Honolulu', locationId: f.locationB });
    dto = await owner(() => service.mutate(f.employeeA, 'delete-time-off', {}, dto.timeOffs[0]!.id));
    expect(dto.scheduleConflicts.items).toEqual([]);
    await expect(withSignedInUser(f.actors.ownerB, () => service.get(f.employeeA, {}))).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it('bounds the upcoming read and marks incomplete checks rather than claiming all-clear', async () => {
    const fresh = await seedPortalFixture(db);
    const customer = await db.customer.create({ data: { organizationId: fresh.organizationA, firstName: 'Synthetic bounded check' } });
    await db.appointment.createMany({ data: Array.from({ length: 501 }, (_, n) => ({ locationId: fresh.locationA, employeeId: fresh.employeeA, customerId: customer.id, serviceId: fresh.serviceId!, startsAt: new Date(Date.UTC(2036, 0, 1, n)), endsAt: new Date(Date.UTC(2036, 0, 1, n, 30)), price: 100n, currency: 'KZT' })) });
    const dto = await withSignedInUser({ ...fresh.actors.staffA, scope: 'LOCATION', locationId: fresh.locationA }, () => service.get(null, {}));
    expect(dto.scheduleConflicts.checkedCount).toBe(500);
    expect(dto.scheduleConflicts.truncated).toBe(true);
    expect(dto.scheduleConflicts.items).toHaveLength(500);
  });

  it('serves public JSON and unpublish 404 with explicit no-store', async () => {
    let dto = await owner(() => service.get(f.employeeA, {}));
    dto = await owner(() => service.mutate(f.employeeA, 'publication', { published: true, publicationConsent: true, expectedRevision: dto.profile.revision }));
    const published = await fetch(`${base}/employee-portal/public/${dto.profile.slug}`);
    expect(published.status).toBe(200);
    expect(published.headers.get('cache-control')).toBe('no-store');
    await owner(() => service.mutate(f.employeeA, 'publication', { published: false, publicationConsent: true, expectedRevision: dto.profile.revision }));
    const invalid = await fetch(`${base}/employee-portal/public/${dto.profile.slug}?locationId=not-a-uuid`);
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get('cache-control')).toBe('no-store');
    const hidden = await fetch(`${base}/employee-portal/public/${dto.profile.slug}`);
    expect(hidden.status).toBe(404);
    expect(hidden.headers.get('cache-control')).toBe('no-store');
  });
});
