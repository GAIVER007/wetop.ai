import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { BeautyAppointmentHistoryService } from '../../apps/api/src/beauty/appointment-history';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('Beauty: scoped appointment history', () => {
  let db: Db;
  let service: BeautyAppointmentHistoryService;
  const organizationId = randomUUID();
  const userId = randomUUID();
  const businessId = randomUUID();
  const locationA = randomUUID();
  const locationB = randomUUID();
  const employeeId = randomUUID();
  const serviceId = randomUUID();
  const customerId = randomUUID();
  const appointmentA = randomUUID();
  const appointmentB = randomUUID();

  const asLocation = <T>(locationId: string, run: () => Promise<T>) =>
    withSignedInUser(
      {
        userId,
        organizationId,
        role: 'OWNER',
        scope: 'LOCATION',
        vertical: 'BEAUTY',
        businessId,
        locationId,
      },
      run,
    );

  beforeAll(async () => {
    const database = new URL(url!);
    if (!['127.0.0.1', 'localhost', '::1'].includes(database.hostname)) {
      throw new Error('Beauty appointment history test requires a loopback database');
    }
    db = createPrismaClient(url);
    service = new BeautyAppointmentHistoryService({ db } as unknown as PrismaService);
    await cleanup();
    await db.organization.create({
      data: { id: organizationId, name: 'Synthetic history network', status: 'ACTIVE' },
    });
    await db.user.create({
      data: {
        id: userId,
        name: 'Тестовый администратор',
        email: `history-${userId}@example.invalid`,
      },
    });
    await db.business.create({
      data: { id: businessId, organizationId, name: 'Synthetic history salon', vertical: 'BEAUTY' },
    });
    await db.location.createMany({
      data: [
        {
          id: locationA,
          businessId,
          name: 'Synthetic branch A',
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        },
        {
          id: locationB,
          businessId,
          name: 'Synthetic branch B',
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        },
      ],
    });
    await db.employee.create({
      data: { id: employeeId, businessId, name: 'Synthetic master' },
    });
    await db.beautyService.create({
      data: {
        id: serviceId,
        businessId,
        name: 'Synthetic service',
        durationMinutes: 60,
        price: 12_000n,
        currency: 'KZT',
      },
    });
    await db.employeeLocation.createMany({
      data: [
        { employeeId, locationId: locationA },
        { employeeId, locationId: locationB },
      ],
    });
    await db.employeeService.create({ data: { employeeId, serviceId } });
    await db.locationService.createMany({
      data: [
        { locationId: locationA, serviceId },
        { locationId: locationB, serviceId },
      ],
    });
    await db.customer.create({
      data: { id: customerId, organizationId, firstName: 'Тестовый клиент' },
    });
    await db.customerBusiness.create({ data: { customerId, businessId } });
    await db.appointment.createMany({
      data: [
        {
          id: appointmentA,
          locationId: locationA,
          customerId,
          employeeId,
          serviceId,
          startsAt: new Date('2036-10-19T05:00:00.000Z'),
          endsAt: new Date('2036-10-19T06:00:00.000Z'),
          price: 12_000n,
          currency: 'KZT',
          createdById: userId,
        },
        {
          id: appointmentB,
          locationId: locationB,
          customerId,
          employeeId,
          serviceId,
          startsAt: new Date('2036-10-20T05:00:00.000Z'),
          endsAt: new Date('2036-10-20T06:00:00.000Z'),
          price: 12_000n,
          currency: 'KZT',
          createdById: userId,
        },
      ],
    });
    await db.auditLog.createMany({
      data: [
        {
          organizationId,
          userId,
          entityType: 'appointment',
          entityId: appointmentA,
          action: 'beauty.appointment.status',
          before: { status: 'CONFIRMED', ignored: 'do-not-return' },
          after: { status: 'DONE', ignored: 'do-not-return' },
        },
        {
          organizationId,
          userId,
          entityType: 'appointment',
          entityId: appointmentA,
          action: 'synthetic.secret',
          after: { hidden: 'do-not-return' },
        },
      ],
    });
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  async function cleanup() {
    if (!db) return;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('wetop.audit_purge','on',true)`;
      await tx.auditLog.deleteMany({ where: { organizationId } });
      await tx.appointmentLine.deleteMany({
        where: { appointmentId: { in: [appointmentA, appointmentB] } },
      });
      await tx.appointment.deleteMany({ where: { id: { in: [appointmentA, appointmentB] } } });
      await tx.employeeService.deleteMany({ where: { employeeId } });
      await tx.employeeLocation.deleteMany({ where: { employeeId } });
      await tx.locationService.deleteMany({ where: { serviceId } });
      await tx.customerBusiness.deleteMany({ where: { customerId } });
      await tx.customer.deleteMany({ where: { id: customerId } });
      await tx.beautyService.deleteMany({ where: { id: serviceId } });
      await tx.employee.deleteMany({ where: { id: employeeId } });
      await tx.location.deleteMany({ where: { id: { in: [locationA, locationB] } } });
      await tx.business.deleteMany({ where: { id: businessId } });
      await tx.organization.deleteMany({ where: { id: organizationId } });
      await tx.user.deleteMany({ where: { id: userId } });
    });
  }

  it('returns known audit rows with author and sanitized snapshots', async () => {
    const history = await asLocation(locationA, () => service.history(appointmentA));
    expect(history).toMatchObject({
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      truncated: false,
      items: [
        {
          action: 'beauty.appointment.status',
          author: { id: userId, name: 'Тестовый администратор' },
          before: { status: 'CONFIRMED' },
          after: { status: 'DONE' },
        },
      ],
    });
    expect(JSON.stringify(history)).not.toContain('do-not-return');
  });

  it('does not expose an appointment from another selected location', async () => {
    await expect(asLocation(locationA, () => service.history(appointmentB))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
