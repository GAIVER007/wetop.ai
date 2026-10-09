import type { PlatformOverview } from '@pms/domain';
import { csvField, csvTenge } from '../finance/csv';
import { VERTICAL_NAME } from '../../lib/platform-overview';

const STATUS: Record<string, string> = {
  ACTIVE: 'работает',
  READ_ONLY: 'только чтение',
  SUSPENDED: 'приостановлена',
};

/** Ячейка, которую Excel мог бы принять за формулу, получает апостроф: названия вводят люди */
const safe = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

/**
 * Организации и филиалы платформы в Excel («Экспорт» на странице): по строке на филиал, цифры за период обзора в
 * формате выгрузок финансов («;», UTF-8 с BOM, CRLF). Нет данных, это пустая ячейка, а не ноль. Контактов людей нет.
 */
export function organizationsCsv(data: Pick<PlatformOverview, 'organizations' | 'period'>): string {
  const head = [
    'Организация',
    'Состояние',
    'Направление',
    'Филиал',
    'Адрес',
    'Валюта',
    `Доход за ${data.period.from} — ${data.period.to}`,
    'Загрузка, %',
    'Гости',
    'Брони и записи',
  ];
  const lines: string[] = [];
  for (const o of data.organizations) {
    const rows = o.branches.length > 0 ? o.branches : [null];
    for (const b of rows) {
      const m = b?.metrics;
      lines.push(
        [
          safe(o.name),
          STATUS[o.status] ?? o.status,
          b ? VERTICAL_NAME[b.vertical] : '',
          safe(b?.name ?? ''),
          safe(b?.address ?? ''),
          b?.currency ?? '',
          m?.revenueMinor == null ? '' : csvTenge(String(Math.round(m.revenueMinor))),
          m?.unitNights ? String(Math.round(((m.occupiedNights ?? 0) / m.unitNights) * 100)) : '',
          m?.guests == null ? '' : String(m.guests),
          m?.bookings == null ? '' : String(m.bookings),
        ]
          .map(csvField)
          .join(';'),
      );
    }
  }
  return `\uFEFF${[head.join(';'), ...lines].join('\r\n')}`;
}
