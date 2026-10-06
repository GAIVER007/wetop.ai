import type { Db } from '@pms/database';
import { randomUUID } from 'node:crypto';
/** Synthetic DB records. Domain reads and guards remain real. */
export async function seedToday(db: Db, org: string, body: Record<string, unknown>) {
  const locations = await db.location.findMany({
    where: { business: { organizationId: org }, status: 'ACTIVE' },
    include: { business: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const l of locations) {
    if (l.business.vertical === 'HOSPITALITY') continue;
    await db.location.update({ where: { id: l.id }, data: { timezone: 'Asia/Dubai' } });
    const customer = await db.customer.create({
      data: { organizationId: org, firstName: `Клиент ${l.name}`, status: 'ACTIVE' },
    });
    await db.customerBusiness.create({
      data: { customerId: customer.id, businessId: l.businessId },
    });
    if (l.business.vertical === 'BEAUTY') {
      const e = await db.employee.create({
        data: { businessId: l.businessId, name: 'Тестовый мастер' },
      });
      await db.employeeLocation.create({ data: { employeeId: e.id, locationId: l.id } });
      const s = await db.beautyService.create({
        data: {
          businessId: l.businessId,
          name: 'Тестовый маникюр',
          durationMinutes: 30,
          price: 10000n,
          currency: 'KZT',
        },
      });
      await db.locationService.create({ data: { locationId: l.id, serviceId: s.id } });
      await db.employeeService.create({ data: { employeeId: e.id, serviceId: s.id } });
      await db.workingHours.create({
        data: {
          employeeId: e.id,
          locationId: l.id,
          weekday: 1,
          timeFrom: new Date('1970-01-01T00:00:00Z'),
          timeTo: new Date('1970-01-01T23:59:00Z'),
        },
      });
      if (!body.empty)
        for (const [i, status] of (
          ['BOOKED', 'BOOKED', 'CONFIRMED', 'DONE', 'NO_SHOW', 'CANCELLED'] as const
        ).entries())
          await db.appointment.create({
            data: {
              locationId: l.id,
              customerId: customer.id,
              employeeId: e.id,
              serviceId: s.id,
              startsAt: new Date(`2026-10-05T0${i + 1}:00:00Z`),
              endsAt: new Date(`2026-10-05T0${i + 1}:30:00Z`),
              status,
              price: 10000n,
              currency: 'KZT',
            },
          });
    }
    if (l.business.vertical === 'FOOD_SERVICE') {
      const a = await db.diningArea.create({ data: { locationId: l.id, name: 'Основной зал' } });
      const ts = [];
      for (let i = 0; i < 4; i++)
        ts.push(
          await db.diningTable.create({
            data: { areaId: a.id, name: `Стол ${i + 1}`, capacity: 4 },
          }),
        );
      const p = await db.servicePeriod.create({
        data: {
          locationId: l.id,
          name: 'Ночной период',
          weekday: 0,
          timeFrom: new Date('1970-01-01T18:00:00Z'),
          timeTo: new Date('1970-01-01T05:00:00Z'),
          endsNextDay: true,
          defaultDurationMinutes: 120,
        },
      });
      if (!body.empty) {
        for (const [i, status] of (
          ['BOOKED', 'BOOKED', 'CONFIRMED', 'SEATED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const
        ).entries()) {
          const startsAt = new Date(i === 3 ? '2026-10-04T19:30:00Z' : '2026-10-04T20:00:00Z');
          const endsAt = new Date(i === 3 ? '2026-10-04T21:30:00Z' : '2026-10-04T22:00:00Z');
          const r = await db.restaurantReservation.create({
            data: {
              locationId: l.id,
              customerId: customer.id,
              servicePeriodId: p.id,
              startsAt,
              endsAt,
              partySize: 2,
              status: status === 'SEATED' ? 'BOOKED' : status,
              creationKey: randomUUID(),
              creationFingerprint: '0'.repeat(64),
            },
          });
          if (i === 0 || i === 2 || i === 3)
            await db.tableAssignment.create({
              data: { reservationId: r.id, tableId: ts[i === 0 ? 0 : i === 2 ? 1 : 2]!.id },
            });
          if (status === 'SEATED')
            await db.restaurantReservation.update({
              where: { id: r.id },
              data: { status: 'SEATED' },
            });
        }
        if (body.pagination)
          for (let i = 0; i < 101; i++)
            await db.restaurantReservation.create({
              data: {
                locationId: l.id,
                customerId: customer.id,
                servicePeriodId: p.id,
                startsAt: new Date('2026-10-05T01:00:00Z'),
                endsAt: new Date('2026-10-05T02:00:00Z'),
                partySize: 2,
                status: 'BOOKED',
                creationKey: randomUUID(),
                creationFingerprint: '0'.repeat(64),
              },
            });
      }
    }
  }
  return { ok: true };
}
