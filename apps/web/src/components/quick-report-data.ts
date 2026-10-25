import { msg } from '../i18n';
import { beautyPeriod, foodPeriod } from '../app/management/analytics/vertical/metrics';
import { beautyStatus } from '../lib/status/beauty';
import { foodOrderStatus, foodStatus } from '../lib/status/food';
import { hospitalityStatus } from '../lib/status/hospitality';
import type { StatusPresentation } from '../lib/status/types';
import type { OrderView } from '../lib/food-types';

export interface QuickReportData {
  total: number;
  clients: number | null;
  itemLabel: string;
  /** дополнительные счётчики рядом с общим числом («Заездов», «Выездов» у гостиницы) */
  counts?: Array<{ label: string; value: number }>;
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
      throw new Error('Некорректная сумма отчёта'); // kk-allow: текст исключения, на экран не выходит (отчёт показывает свою фразу)
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
      label: msg('Сумма завершённых услуг'),
      values: revenue,
      hint: msg('Стоимость записей со статусом «Завершена», как в аналитике салона. Это не сумма принятых оплат.'),
    },
    {
      label: msg('Средняя стоимость завершённой записи'),
      values: average,
      hint: msg('Сумма завершённых услуг / число завершённых записей в каждой валюте. Результат округляется вниз до минимальной единицы соответствующей валюты.'),
    },
  ];
  if (
    rows.length &&
    rows.every((r) => r.paidMinor !== undefined && r.refundedMinor !== undefined)
  ) {
    money.push(
      {
        label: msg('Принято оплат по записям'),
        values: sums(rows.map((r) => ({ amount: r.paidMinor!, currency: r.currency }))),
        hint: msg('Все действующие оплаты выбранных записей, независимо от даты оплаты.'),
      },
      {
        label: msg('Возвращено по записям'),
        values: sums(rows.map((r) => ({ amount: r.refundedMinor!, currency: r.currency }))),
        hint: msg('Все действующие возвраты выбранных записей, независимо от даты возврата.'),
      },
    );
  }
  if (
    rows.length &&
    rows.every((r) => r.paidCashMinor !== undefined && r.paidNonCashMinor !== undefined)
  ) {
    for (const [label, field] of [
      [msg('Оплата наличными'), 'paidCashMinor'],
      [msg('Оплата безналом'), 'paidNonCashMinor'],
    ] as const) {
      money.push({
        label,
        values: sums(rows.map((r) => ({ amount: r[field]!, currency: r.currency }))),
        hint: msg('Действующие приходы по выбранным записям за всё время. Возвраты показаны отдельно. Безнал включает карту и переводы.'),
      });
    }
  }
  if (rows.some((row) => row.items !== undefined)) {
    money.push({
      label: msg('Скидки на услуги'),
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
      hint: msg('Сохранённые скидки строк услуг выбранных записей, кроме отменённых. Каждая строка учитывается один раз; это не выплата из кассы.'),
    });
  }
  return {
    total: rows.length,
    clients: new Set(rows.map((r) => r.customer.id)).size,
    itemLabel: msg('Записей'),
    statuses: statuses(beautyStatus, counts),
    reference: {
      totalPrices: sums(rows.map((r) => ({ amount: r.priceMinor, currency: r.currency }))),
      statuses: [
        { key: 'DONE', label: msg('Обслуженные'), count: counts.DONE ?? 0, tone: 'success' },
        {
          key: 'WAITING',
          label: msg('В ожидании'),
          count: (counts.BOOKED ?? 0) + (counts.CONFIRMED ?? 0) + (counts.IN_PROGRESS ?? 0),
          tone: 'warning',
        },
        { key: 'CANCELLED', label: msg('Отменённые'), count: counts.CANCELLED ?? 0, tone: 'danger' },
        { key: 'NO_SHOW', label: msg('Не пришли'), count: counts.NO_SHOW ?? 0, tone: 'neutral' },
      ],
    },
    money,
    note: msg('Бонусы, абонементы и сертификаты: отдельный учёт для записей пока не ведётся.'),
  };
}

export function foodQuickReport(
  rows: Array<{ id: string; status: string; customerId: string }>,
): QuickReportData {
  return {
    total: rows.length,
    clients: new Set(rows.map((r) => r.customerId)).size,
    itemLabel: msg('Бронирований'),
    statuses: statuses(foodStatus, foodPeriod(rows)),
    money: [],
    note: msg('Суммы и способы оплаты не хранятся в бронированиях столов. Статистика заказов доступна в разделе «Заказы».'),
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
      throw new Error('Некорректный ответ отчёта'); // kk-allow: текст исключения, на экран не выходит (отчёт показывает свою фразу)
    seen.add(row.id);
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    if (row.status === 'CLOSED') {
      if (!/^\d+$/.test(row.totalMinor) || !/^[A-Z]{3}$/.test(row.currency))
        throw new Error('Некорректная сумма заказа'); // kk-allow: текст исключения, на экран не выходит (отчёт показывает свою фразу)
      values[row.currency] = (
        BigInt(values[row.currency] ?? '0') + BigInt(row.totalMinor)
      ).toString();
    }
  }
  const money: QuickReportData['money'] = [
    {
      label: msg('Сумма закрытых заказов'),
      values,
      hint: msg('Стоимость закрытых заказов, открытых в выбранный день. Это не выручка по дате закрытия и не сумма оплат за день.'),
    },
  ];
  if (rows.length && rows.every((r) => r.payments !== undefined)) {
    const payments = rows.flatMap((r) =>
      r
        .payments!.filter((p) => p.status === 'COMPLETED')
        .map((p) => ({ ...p, currency: r.currency })),
    );
    for (const [label, cash] of [
      [msg('Наличными по заказам'), true],
      [msg('Безналично по заказам'), false],
    ] as const) {
      money.push({
        label,
        values: sums(
          payments
            .filter((p) => (p.method === 'CASH') === cash)
            .map((p) => ({ amount: p.amountMinor, currency: p.currency })),
        ),
        hint: msg('Действующие оплаты выбранных заказов за всё время; аннулированные оплаты не учитываются. Возвраты показаны отдельно.'),
      });
    }
  }
  if (rows.length && rows.every((r) => r.refundedMinor !== undefined)) {
    money.push({
      label: msg('Возвращено по заказам'),
      values: sums(rows.map((r) => ({ amount: r.refundedMinor!, currency: r.currency }))),
      hint: msg('Действующие возвраты выбранных заказов за всё время.'),
    });
  }
  return {
    total: rows.length,
    clients: null,
    itemLabel: msg('Заказов'),
    statuses: statuses(foodOrderStatus, counts),
    money,
    note: msg('Скидки и бонусы: отдельный учёт в заказах пока не ведётся. Уникальные клиенты не определяются по заказам. Движения денег за конкретную дату смотрите в кассе.'),
  };
}

type HotelCell = {
  date: string;
  state: string;
  itemId?: string;
  itemStatus?: string;
  guestLabel?: string;
  isArrival?: boolean;
  isLastNight?: boolean;
  balanceMinor?: string;
};

/**
 * «Быстрый отчёт» гостиницы (владелец 23.10.2026: «кнопка быстрый отчёт должна быть во всех вертикалях»): по клеткам
 * календаря за отрезок. Бронь считается один раз, заезд по клетке с `isArrival`, выезд по последней ночи; долг по
 * уникальным броням из `balanceMinor` (тот же, что плашкой на клетке).
 */
export function hotelQuickReport(
  rows: Array<{ cells: HotelCell[] }>,
  period: { from: string; to: string; currency: string },
): QuickReportData {
  const stays = new Map<string, { status: string; arrival: boolean; leaving: boolean; balance: string; guest: string }>();
  for (const row of rows)
    for (const cell of row.cells) {
      if (cell.date < period.from || cell.date > period.to || cell.state !== 'OCCUPIED' || !cell.itemId) continue;
      const seen = stays.get(cell.itemId);
      stays.set(cell.itemId, {
        status: cell.itemStatus ?? seen?.status ?? 'CONFIRMED',
        arrival: (seen?.arrival ?? false) || !!cell.isArrival,
        leaving: (seen?.leaving ?? false) || !!cell.isLastNight,
        balance: cell.balanceMinor && /^\d+$/.test(cell.balanceMinor) ? cell.balanceMinor : (seen?.balance ?? '0'),
        guest: cell.guestLabel ?? seen?.guest ?? '',
      });
    }
  const counts: Record<string, number> = {};
  let arrivals = 0;
  let departures = 0;
  let debt = 0n;
  for (const stay of stays.values()) {
    counts[stay.status] = (counts[stay.status] ?? 0) + 1;
    if (stay.arrival) arrivals += 1;
    if (stay.leaving) departures += 1;
    debt += BigInt(stay.balance);
  }
  return {
    total: stays.size,
    clients: new Set([...stays.values()].map((s) => s.guest).filter(Boolean)).size,
    itemLabel: msg('Броней'),
    counts: [
      { label: msg('Заездов'), value: arrivals },
      { label: msg('Выездов'), value: departures },
    ],
    statuses: statuses(hospitalityStatus, counts),
    money: [
      {
        label: msg('Не оплачено по броням'),
        values: debt > 0n ? { [period.currency]: debt.toString() } : {},
        hint: msg('Остаток к оплате по броням, которые живут в выбранные дни, как плашка суммы на календаре.'),
      },
    ],
    note: msg('Брони считаются по календарю номеров: бронь без назначенного номера в отчёт не входит. Начисления и оплаты за период смотрите в «Финансах».'),
  };
}
