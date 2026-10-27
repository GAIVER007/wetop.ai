import { beautyReadiness, endClockOf } from '@pms/domain';
import type { DbTx } from '@pms/database';

export async function readBeautyReadiness(
  db: Pick<DbTx, 'beautyService' | 'employee'>,
  businessId: string,
  locationId: string,
  currency: string,
  profileApplied: boolean,
) {
  const services = await db.beautyService.findMany({
    where: { businessId },
    select: {
      id: true,
      active: true,
      price: true,
      currency: true,
      durationMinutes: true,
      locations: {
        where: { locationId },
        select: { enabled: true, priceOverride: true, durationOverride: true },
      },
    },
  });
  const employees = await db.employee.findMany({
    where: { businessId },
    select: {
      id: true,
      status: true,
      locations: { where: { locationId }, select: { locationId: true } },
      services: { select: { serviceId: true } },
      workingHours: {
        where: { locationId },
        select: { weekday: true, timeFrom: true, timeTo: true },
      },
    },
  });
  return beautyReadiness({
    currency,
    profileApplied,
    services: services.map((s) => ({
      ...s,
      priceMinor: s.price,
      location: s.locations[0]
        ? {
            enabled: s.locations[0].enabled,
            priceOverrideMinor: s.locations[0].priceOverride,
            durationOverrideMinutes: s.locations[0].durationOverride,
          }
        : null,
    })),
    employees: employees.map((e) => ({
      id: e.id,
      active: e.status === 'ACTIVE',
      worksHere: e.locations.length > 0,
      serviceIds: e.services.map((s) => s.serviceId),
      hours: e.workingHours.map((h) => ({
        weekday: h.weekday,
        timeFrom: h.timeFrom.toISOString().slice(11, 16),
        timeTo: endClockOf(h.timeTo),
      })),
    })),
  });
}
