'use client';
import type { ChessboardRow } from '../../lib/api';
import { QuickReport } from '../../components/quick-report';
import { hotelQuickReport } from '../../components/quick-report-data';
import { loadHotelReportRows } from './report-actions';
import { useT } from '../../i18n/locale-provider';

/**
 * «Быстрый отчёт» календаря гостиницы (владелец 23.10.2026: во всех направлениях одна кнопка): отчёт дня по видимому
 * календарю, период (неделя, месяц, свой) догружает календарь за отрезок.
 */
export function HotelQuickReport({
  rows,
  date,
  currency,
  propertyName,
}: {
  rows: ChessboardRow[];
  date: string;
  currency: string;
  propertyName: string;
}) {
  const t = useT();
  return (
    <QuickReport
      text={t('Быстрый отчёт')}
      date={date}
      scope={[propertyName, t('Все номера')]}
      build={(periodRows) =>
        periodRows
          ? hotelQuickReport((periodRows as Array<{ rows: ChessboardRow[]; from: string; to: string }>)[0]!.rows, {
              from: (periodRows as Array<{ from: string }>)[0]!.from,
              to: (periodRows as Array<{ to: string }>)[0]!.to,
              currency,
            })
          : hotelQuickReport(rows, { from: date, to: date, currency })
      }
      loadPeriod={async (from, to) => {
        const result = await loadHotelReportRows(from, to);
        return result.rows
          ? { rows: [{ rows: result.rows, from, to }] }
          : { error: result.error ?? t('Не удалось загрузить брони за период.') };
      }}
    />
  );
}
