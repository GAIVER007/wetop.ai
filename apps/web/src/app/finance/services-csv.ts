import type { PeriodServices } from '../../lib/api';
import { csvField, csvTenge } from './csv';

type ServiceRow = PeriodServices['rows'][number];

/** Подпись строки начислений без услуги справочника — та же, что на вкладке «Услуги» */
export const MANUAL_SERVICE_LABEL = 'Начислено вручную';

/**
 * Отчёт по услугам за период (REP2): тот же формат, что у других выгрузок финансов — «;», UTF-8 с BOM,
 * CRLF, суммы вида «12500,50». Имён гостей в отчёте нет по построению: это свод по услугам.
 */
export function servicesCsv(rows: ServiceRow[]): string {
  const head = ['Услуга', 'Группа', 'Начислений', 'Штук', 'Сумма, ₸'];
  const lines = rows.map((x) =>
    [
      x.name ?? MANUAL_SERVICE_LABEL,
      x.group ?? '',
      String(x.charges),
      String(x.quantity),
      csvTenge(x.amountMinor),
    ]
      .map(csvField)
      .join(';'),
  );
  return `\uFEFF${[head.join(';'), ...lines].join('\r\n')}`;
}
