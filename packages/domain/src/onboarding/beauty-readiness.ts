import {
  effectiveService,
  type BeautyServiceRef,
  type LocationServiceRef,
  type WorkingHoursRef,
} from '../beauty/beauty';
import { parseWorkingHoursWeek } from '../beauty/schedule';

export interface BeautySetupService extends BeautyServiceRef {
  id: string;
  location: LocationServiceRef | null;
}
export interface BeautySetupEmployee {
  id: string;
  active: boolean;
  worksHere: boolean;
  serviceIds: readonly string[];
  hours: readonly WorkingHoursRef[];
}
/** Configuration only: dates, bookings and finite TimeOff do not invalidate a weekly template. */
export function beautyReadiness(input: {
  currency: string;
  profileApplied: boolean;
  services: readonly BeautySetupService[];
  employees: readonly BeautySetupEmployee[];
}) {
  const services = input.services.flatMap((service) => {
    const effective = effectiveService({
      service,
      locationCurrency: input.currency,
      locationService: service.location,
    });
    return effective.sellable &&
      effective.priceMinor >= 0n &&
      Number.isInteger(effective.durationMinutes) &&
      effective.durationMinutes > 0
      ? [{ id: service.id, duration: effective.durationMinutes }]
      : [];
  });
  const employees = input.employees.filter((e) => e.active && e.worksHere);
  const links = employees.flatMap((employee) =>
    services
      .filter((s) => employee.serviceIds.includes(s.id))
      .map((service) => ({ employee, service })),
  );
  const chains = links.filter(({ employee, service }) => {
    const parsed = parseWorkingHoursWeek({ intervals: employee.hours });
    return (
      parsed.ok && parsed.value.some((h) => clock(h.timeTo) - clock(h.timeFrom) >= service.duration)
    );
  });
  const steps = [
    {
      id: 'services',
      done: services.length > 0,
      count: services.length,
      reason: 'Добавьте активную услугу и включите её в этом филиале.',
    },
    {
      id: 'masters',
      done: employees.length > 0,
      count: employees.length,
      reason: 'Добавьте действующего мастера этого филиала.',
    },
    {
      id: 'skills',
      done: links.length > 0,
      count: links.length,
      reason: 'Назначьте мастеру пригодную услугу этого филиала.',
    },
    {
      id: 'schedule',
      done: chains.length > 0,
      count: chains.length,
      reason: 'Настройте интервал мастера, в который целиком помещается его услуга.',
    },
  ];
  return {
    ready: input.profileApplied && chains.length > 0,
    steps,
    chain: chains[0]
      ? { employeeId: chains[0].employee.id, serviceId: chains[0].service.id }
      : null,
  };
}
function clock(value: string) {
  const [h, m] = value.split(':').map(Number);
  return h! * 60 + m!;
}
