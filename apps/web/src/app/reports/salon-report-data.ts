import { msg } from '../../i18n';
import { branchReportDay, type BeautyDay, type BranchItem } from '../../lib/api';
import { localInput } from '../beauty/time';
import { beautyPeriod, periodDates } from '../management/analytics/vertical/metrics';

interface Breakdown {
  id: string;
  name: string;
  currency: string;
  visits: number;
  services: number;
  costMinor: string;
}
export function buildSalonReport(days: BeautyDay[]) {
  const rows = days.flatMap((day) => day.appointments);
  const base = beautyPeriod(rows);
  const names = new Map(
    days.flatMap((day) => day.columns.map((column) => [column.id, column.name] as const)),
  );
  const services = new Map<string, Breakdown>();
  const masters = new Map<string, Breakdown>();
  const currencies = new Map<string, { currency: string; visits: number; costMinor: string }>();
  const add = (
    map: Map<string, Breakdown>,
    id: string,
    name: string,
    currency: string,
    minor: string,
    first: boolean,
  ) => {
    if (!id || !/^\d+$/.test(minor)) throw new Error(msg('Некорректная строка услуг отчёта'));
    const key = `${currency}:${id}`;
    const value = map.get(key) ?? { id, name, currency, visits: 0, services: 0, costMinor: '0' };
    value.visits += first ? 1 : 0;
    value.services += 1;
    value.costMinor = (BigInt(value.costMinor) + BigInt(minor)).toString();
    map.set(key, value);
  };
  for (const row of rows.filter((row) => row.status === 'DONE')) {
    const value = currencies.get(row.currency) ?? {
      currency: row.currency,
      visits: 0,
      costMinor: '0',
    };
    value.visits += 1;
    value.costMinor = (BigInt(value.costMinor) + BigInt(row.priceMinor)).toString();
    currencies.set(row.currency, value);
    const items = row.items?.length ? row.items : [row];
    if (
      items.some((item) => !/^\d+$/.test(item.priceMinor)) ||
      items.reduce((sum, item) => sum + BigInt(item.priceMinor), 0n) !== BigInt(row.priceMinor)
    )
      throw new Error(msg('Стоимость услуг не совпадает с записью'));
    const seenMasters = new Set<string>();
    const seenServices = new Set<string>();
    for (const item of items) {
      add(
        services,
        item.serviceId,
        item.serviceName,
        row.currency,
        item.priceMinor,
        !seenServices.has(item.serviceId),
      );
      const historicalName =
        'employeeName' in item && typeof item.employeeName === 'string'
          ? item.employeeName
          : undefined;
      add(
        masters,
        item.employeeId,
        historicalName ?? names.get(item.employeeId) ?? msg('Мастер'),
        row.currency,
        item.priceMinor,
        !seenMasters.has(item.employeeId),
      );
      seenServices.add(item.serviceId);
      seenMasters.add(item.employeeId);
    }
  }
  const sorted = (map: Map<string, Breakdown>) =>
    [...map.values()].sort(
      (a, b) =>
        a.currency.localeCompare(b.currency) ||
        (BigInt(a.costMinor) === BigInt(b.costMinor)
          ? a.name.localeCompare(b.name)
          : BigInt(a.costMinor) > BigInt(b.costMinor)
            ? -1
            : 1),
    );
  return {
    counts: base.counts,
    currencies: [...currencies.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    services: sorted(services),
    masters: sorted(masters),
  };
}

export async function loadSalonReport(branch: BranchItem, dates: string[]) {
  if (
    branch.vertical !== 'BEAUTY' ||
    !dates.length ||
    periodDates(dates[0]!, dates.at(-1)!).join(',') !== dates.join(',')
  )
    throw new Error(msg('Некорректная область отчёта'));
  const days: BeautyDay[] = [];
  for (const date of dates) {
    const day = (await branchReportDay(branch, date)) as BeautyDay;
    if (
      day.date !== date ||
      day.location.id !== branch.locationId ||
      day.location.timezone !== branch.timezone ||
      !Array.isArray(day.columns) ||
      !Array.isArray(day.appointments)
    )
      throw new Error(msg('Контекст отчёта изменился. Обновите страницу.'));
    // Calendar days include tails from earlier dates. Attribute a visit only to its local start day.
    days.push({
      ...day,
      appointments: day.appointments.filter(
        (row) => localInput(row.startsAt, branch.timezone).slice(0, 10) === date,
      ),
    });
  }
  return buildSalonReport(days);
}
