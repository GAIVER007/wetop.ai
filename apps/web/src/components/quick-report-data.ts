import { beautyPeriod, foodPeriod } from '../app/management/analytics/vertical/metrics';
import { beautyStatus } from '../lib/status/beauty';
import { foodOrderStatus, foodStatus } from '../lib/status/food';
import type { StatusPresentation } from '../lib/status/types';
import type { OrderView } from '../lib/food-types';

export interface QuickReportData {
  total: number;
  clients: number | null;
  itemLabel: string;
  statuses: Array<{ key: string; label: string; count: number; tone: string }>;
  money: Array<{ label: string; values: Record<string, string>; hint: string }>;
  note: string;
  reference?: { totalPrices: Record<string, string>; statuses: QuickReportData['statuses'] };
}

function statuses(registry: Record<string, StatusPresentation>, counts: Record<string, number>) {
  return Object.entries(registry).map(([key, s]) => ({
    key,
    label: s.groupLabel ?? s.label,
    count: counts[key] ?? 0,
    tone: s.tone,
  }));
}

function sums(rows: Array<{ amount: string; currency: string }>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const row of rows) {
    if (!/^\d+$/.test(row.amount) || !/^[A-Z]{3}$/.test(row.currency))
      throw new Error('Некорректная сумма отчёта');
    values[row.currency] = (BigInt(values[row.currency] ?? '0') + BigInt(row.amount)).toString();
  }
  return values;
}

type BeautyRow = {
  id: string;
  status: string;
  priceMinor: string;
  paidMinor?: string;
  refundedMinor?: string;
  paidCashMinor?: string;
  paidNonCashMinor?: string;
  currency: string;
  customer: { id: string };
  items?: Array<{ discountMinor: string }>;
};
export function beautyQuickReport(rows: BeautyRow[]): QuickReportData {
  const { counts, revenue } = beautyPeriod(rows);
  const completed = rows.filter((r) => r.status === 'DONE');
  const average = Object.fromEntries(
    Object.entries(revenue).map(([currency, sum]) => [
      currency,
      (BigInt(sum) / BigInt(completed.filter((r) => r.currency === currency).length)).toString(),
    ]),
  );
  const money: QuickReportData['money'] = [
    {
      label: 'Сумма завершённых услуг',
      values: revenue,
      hint: 'Стоимость записей со статусом «Завершена», как в аналитике салона. Это не сумма принятых оплат.',
    },
    {
      label: 'Средняя стоимость завершённой записи',
      values: average,
      hint: 'Сумма завершённых услуг / число завершённых записей в каждой валюте. Результат округляется вниз до минимальной единицы соответствующей валюты.',
    },
  ];
  if (
    rows.length &&
    rows.every((r) => r.paidMinor !== undefined && r.refundedMinor !== undefined)
  ) {
    money.push(
      {
        label: 'Принято оплат по записям',
        values: sums(rows.map((r) => ({ amount: r.paidMinor!, currency: r.currency }))),
        hint: 'Все действующие оплаты выбранных записей, независимо от даты оплаты.',
      },
      {
        label: 'Возвращено по записям',
        values: sums(rows.map((r) => ({ amount: r.refundedMinor!, currency: r.currency }))),
        hint: 'Все действующие возвраты выбранных записей, независимо от даты возврата.',
      },
    );
  }
  if (
    rows.length &&
    rows.every((r) => r.paidCashMinor !== undefined && r.paidNonCashMinor !== undefined)
  ) {
    for (const [label, field] of [
      ['Оплата наличными', 'paidCashMinor'],
      ['Оплата безналом', 'paidNonCashMinor'],
    ] as const) {
      money.push({
        label,
        values: sums(rows.map((r) => ({ amount: r[field]!, currency: r.currency }))),
        hint: 'Действующие приходы по выбранным записям за всё время. Возвраты показаны отдельно. Безнал включает карту и переводы.',
      });
    }
  }
  if (rows.some((row) => row.items !== undefined)) {
    money.push({
      label: 'Скидки на услуги',
      values: sums(
        rows
          .filter((row) => row.status !== 'CANCELLED')
          .flatMap((row) =>
            (row.items ?? []).map((line) => ({
              amount: line.discountMinor,
              currency: row.currency,
            })),
          ),
      ),
      hint: 'Сохранённые скидки строк услуг выбранных записей, кроме отменённых. Каждая строка учитывается один раз; это не выплата из кассы.',
    });
  }
  return {
    total: rows.length,
    clients: new Set(rows.map((r) => r.customer.id)).size,
    itemLabel: 'Записей',
    statuses: statuses(beautyStatus, counts),
    reference: {
      totalPrices: sums(rows.map((r) => ({ amount: r.priceMinor, currency: r.currency }))),
      statuses: [
        { key: 'DONE', label: 'Обслуженные', count: counts.DONE ?? 0, tone: 'success' },
        {
          key: 'WAITING',
          label: 'В ожидании',
          count: (counts.BOOKED ?? 0) + (counts.CONFIRMED ?? 0) + (counts.IN_PROGRESS ?? 0),
          tone: 'warning',
        },
        { key: 'CANCELLED', label: 'Отменённые', count: counts.CANCELLED ?? 0, tone: 'danger' },
        { key: 'NO_SHOW', label: 'Не пришли', count: counts.NO_SHOW ?? 0, tone: 'neutral' },
      ],
    },
    money,
    note: 'Бонусы, абонементы и сертификаты: отдельный учёт для записей пока не ведётся.',
  };
}

export function foodQuickReport(
  rows: Array<{ id: string; status: string; customerId: string }>,
): QuickReportData {
  return {
    total: rows.length,
    clients: new Set(rows.map((r) => r.customerId)).size,
    itemLabel: 'Бронирований',
    statuses: statuses(foodStatus, foodPeriod(rows)),
    money: [],
    note: 'Суммы и способы оплаты не хранятся в бронированиях столов. Статистика заказов доступна в разделе «Заказы».',
  };
}

export function orderQuickReport(
  rows: Array<
    { id: string; status: string; totalMinor: string; currency: string } & Partial<
      Pick<OrderView, 'payments' | 'paidMinor' | 'refundedMinor'>
    >
  >,
): QuickReportData {
  const counts: Record<string, number> = {};
  const values: Record<string, string> = {};
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.id || seen.has(row.id) || !Object.hasOwn(foodOrderStatus, row.status))
      throw new Error('Некорректный ответ отчёта');
    seen.add(row.id);
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    if (row.status === 'CLOSED') {
      if (!/^\d+$/.test(row.totalMinor) || !/^[A-Z]{3}$/.test(row.currency))
        throw new Error('Некорректная сумма заказа');
      values[row.currency] = (
        BigInt(values[row.currency] ?? '0') + BigInt(row.totalMinor)
      ).toString();
    }
  }
  const money: QuickReportData['money'] = [
    {
      label: 'Сумма закрытых заказов',
      values,
      hint: 'Стоимость закрытых заказов, открытых в выбранный день. Это не выручка по дате закрытия и не сумма оплат за день.',
    },
  ];
  if (rows.length && rows.every((r) => r.payments !== undefined)) {
    const payments = rows.flatMap((r) =>
      r
        .payments!.filter((p) => p.status === 'COMPLETED')
        .map((p) => ({ ...p, currency: r.currency })),
    );
    for (const [label, cash] of [
      ['Наличными по заказам', true],
      ['Безналично по заказам', false],
    ] as const) {
      money.push({
        label,
        values: sums(
          payments
            .filter((p) => (p.method === 'CASH') === cash)
            .map((p) => ({ amount: p.amountMinor, currency: p.currency })),
        ),
        hint: 'Действующие оплаты выбранных заказов за всё время; аннулированные оплаты не учитываются. Возвраты показаны отдельно.',
      });
    }
  }
  if (rows.length && rows.every((r) => r.refundedMinor !== undefined)) {
    money.push({
      label: 'Возвращено по заказам',
      values: sums(rows.map((r) => ({ amount: r.refundedMinor!, currency: r.currency }))),
      hint: 'Действующие возвраты выбранных заказов за всё время.',
    });
  }
  return {
    total: rows.length,
    clients: null,
    itemLabel: 'Заказов',
    statuses: statuses(foodOrderStatus, counts),
    money,
    note: 'Скидки и бонусы: отдельный учёт в заказах пока не ведётся. Уникальные клиенты не определяются по заказам. Движения денег за конкретную дату смотрите в кассе.',
  };
}
