import type { BeautyDay } from '../../../../lib/api';
import type { FoodPeriodReport } from '../../../../lib/food-types';
import { msg } from '../../../../i18n';

/**
 * Пульт владельца «Аналитики бизнеса» (вариант A, решение владельца 25.10.2026): главные цифры периода, подсказки
 * «что сделать сейчас» и разборы по мастерам, услугам и оплатам. Только из данных, которые API уже отдаёт
 * журналу и кассе: новых таблиц и запросов нет. Деньги считаются в BigInt минорных единиц и отдаются строкой.
 */
type Row = BeautyDay['appointments'][number];
const DAY = 86_400_000;
const big = (v: string) => (/^-?\d+$/.test(v) ? BigInt(v) : 0n);
const s = (v: bigint) => v.toString();
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : 0);

/** Прошлый отрезок той же длины вплотную до начала периода: с ним сравниваются плитки */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const len = (Date.parse(to) - Date.parse(from)) / DAY + 1;
  const prevTo = new Date(Date.parse(from) - DAY);
  const prevFrom = new Date(prevTo.getTime() - (len - 1) * DAY);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

export interface MasterRow {
  id: string;
  name: string;
  visits: number;
  revenueMinor: string;
  loadPercent: number;
}

export interface BeautyPult {
  currency: string;
  revenueMinor: string;
  visits: number;
  averageMinor: string | null;
  loadPercent: number;
  counts: Record<string, number>;
  noShow: { count: number; minor: string };
  unpaid: { count: number; minor: string };
  clients: { total: number; repeat: number };
  onlineShare: number;
  masters: MasterRow[];
  services: Array<{ name: string; count: number; revenueMinor: string }>;
  payments: Array<{ method: string; count: number; amountMinor: string }>;
  byDay: Array<{ date: string; revenueMinor: string; visits: number }>;
  /** Самые пустые окна: день недели (0 вс) и часть дня, свободные часы мастеров по графику; от трёх рабочих часов */
  idleSlots: Array<{ weekday: number; part: DayPart; freeHours: number; loadPercent: number }>;
  otherCurrencies: string[];
}

export type DayPart = 'morning' | 'day' | 'evening';
/** Утро до 12:00, день до 17:00, вечер позже: так владелец говорит о расписании */
const PARTS: Array<[DayPart, number, number]> = [
  ['morning', 0, 720],
  ['day', 720, 1020],
  ['evening', 1020, 1440],
];
const overlap = (a0: number, a1: number, b0: number, b1: number) =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Строки визита: многоуслужная запись делится по мастерам и услугам, у старой записи строка одна */
const lines = (row: Row) =>
  row.items?.length
    ? row.items.map((i) => ({
        employeeId: i.employeeId,
        employeeName: i.employeeName,
        serviceName: i.serviceName,
        priceMinor: i.priceMinor,
        start: i.startMinutes,
        end: i.endMinutes,
      }))
    : [
        {
          employeeId: row.employeeId,
          employeeName: null as string | null,
          serviceName: row.serviceName,
          priceMinor: row.priceMinor,
          start: row.startMinutes,
          end: row.endMinutes,
        },
      ];

export function beautyPult(days: BeautyDay[], currency: string): BeautyPult {
  const counts: Record<string, number> = {
    BOOKED: 0,
    CONFIRMED: 0,
    IN_PROGRESS: 0,
    DONE: 0,
    NO_SHOW: 0,
    CANCELLED: 0,
  };
  const other = new Set<string>();
  let revenue = 0n;
  let visits = 0;
  let noShowMinor = 0n;
  let unpaidMinor = 0n;
  let unpaid = 0;
  let online = 0;
  let booked = 0;
  const clientVisits = new Map<string, number>();
  const masters = new Map<
    string,
    { name: string; visits: number; revenue: bigint; busy: number; work: number }
  >();
  const services = new Map<string, { count: number; revenue: bigint }>();
  const payments = new Map<string, { count: number; amount: bigint }>();
  const byDay: BeautyPult['byDay'] = [];
  const master = (id: string, name: string) => {
    const m = masters.get(id) ?? { name, visits: 0, revenue: 0n, busy: 0, work: 0 };
    masters.set(id, m);
    return m;
  };
  const slots = new Map<string, { weekday: number; part: DayPart; work: number; busy: number }>();
  const slot = (weekday: number, part: DayPart) => {
    const key = `${weekday}:${part}`;
    const x = slots.get(key) ?? { weekday, part, work: 0, busy: 0 };
    slots.set(key, x);
    return x;
  };
  for (const d of days) {
    const weekday = new Date(`${d.date}T00:00:00Z`).getUTCDay();
    for (const c of d.columns) {
      const m = master(c.id, c.name);
      if (c.timeOff) continue;
      for (const i of c.intervals) {
        const a = minutes(i.timeFrom);
        const b = minutes(i.timeTo);
        m.work += Math.max(0, b - a);
        for (const [part, p0, p1] of PARTS) slot(weekday, part).work += overlap(a, b, p0, p1);
      }
    }
    let dayRevenue = 0n;
    let dayVisits = 0;
    for (const row of d.appointments) {
      if (row.currency !== currency) {
        other.add(row.currency);
        continue;
      }
      counts[row.status] = (counts[row.status] ?? 0) + 1;
      if (row.status !== 'CANCELLED') {
        booked += 1;
        if (row.source === 'WEBSITE') online += 1;
        // занятое окно мастера: и визит, и неявка, отмена окно освобождает
        for (const l of lines(row)) {
          master(l.employeeId, l.employeeName ?? msg('Мастер')).busy += Math.max(
            0,
            l.end - l.start,
          );
          for (const [part, p0, p1] of PARTS)
            slot(weekday, part).busy += overlap(l.start, l.end, p0, p1);
        }
      }
      if (row.status === 'NO_SHOW') noShowMinor += big(row.priceMinor);
      if (row.status !== 'DONE') continue;
      const price = big(row.priceMinor);
      revenue += price;
      visits += 1;
      dayRevenue += price;
      dayVisits += 1;
      clientVisits.set(row.customer.id, (clientVisits.get(row.customer.id) ?? 0) + 1);
      if (big(row.paidMinor) < price) {
        unpaid += 1;
        unpaidMinor += price - big(row.paidMinor);
      }
      const seen = new Set<string>();
      for (const l of lines(row)) {
        const m = master(l.employeeId, l.employeeName ?? msg('Мастер'));
        m.revenue += big(l.priceMinor);
        if (!seen.has(l.employeeId)) m.visits += 1;
        seen.add(l.employeeId);
        const sv = services.get(l.serviceName) ?? { count: 0, revenue: 0n };
        sv.count += 1;
        sv.revenue += big(l.priceMinor);
        services.set(l.serviceName, sv);
      }
      for (const p of row.payments ?? []) {
        if (p.kind !== 'INCOME') continue;
        const x = payments.get(p.method) ?? { count: 0, amount: 0n };
        x.count += 1;
        x.amount += big(p.amountMinor);
        payments.set(p.method, x);
      }
    }
    byDay.push({ date: d.date, revenueMinor: s(dayRevenue), visits: dayVisits });
  }
  const masterRows = [...masters].map(([id, m]) => ({
    id,
    name: m.name,
    visits: m.visits,
    revenueMinor: s(m.revenue),
    loadPercent: pct(m.busy, m.work),
    busy: m.busy,
    work: m.work,
  }));
  const busy = masterRows.reduce((sum, m) => sum + m.busy, 0);
  const work = masterRows.reduce((sum, m) => sum + m.work, 0);
  return {
    currency,
    revenueMinor: s(revenue),
    visits,
    averageMinor: visits ? s(revenue / BigInt(visits)) : null,
    loadPercent: pct(busy, work),
    counts,
    noShow: { count: counts['NO_SHOW'] ?? 0, minor: s(noShowMinor) },
    unpaid: { count: unpaid, minor: s(unpaidMinor) },
    clients: {
      total: clientVisits.size,
      repeat: [...clientVisits.values()].filter((n) => n > 1).length,
    },
    onlineShare: pct(online, booked),
    masters: masterRows
      .filter((m) => m.work > 0 || m.visits > 0)
      .sort((a, b) =>
        big(b.revenueMinor) > big(a.revenueMinor)
          ? 1
          : big(b.revenueMinor) < big(a.revenueMinor)
            ? -1
            : b.loadPercent - a.loadPercent,
      )
      .map((m) => ({
        id: m.id,
        name: m.name,
        visits: m.visits,
        revenueMinor: m.revenueMinor,
        loadPercent: m.loadPercent,
      })),
    services: [...services]
      .map(([name, v]) => ({ name, count: v.count, revenueMinor: s(v.revenue) }))
      .sort((a, b) => (big(b.revenueMinor) > big(a.revenueMinor) ? 1 : -1))
      .slice(0, 5),
    payments: [...payments]
      .map(([method, v]) => ({ method, count: v.count, amountMinor: s(v.amount) }))
      .sort((a, b) => (big(b.amountMinor) > big(a.amountMinor) ? 1 : -1)),
    byDay,
    idleSlots: [...slots.values()]
      .filter((x) => x.work - x.busy >= 180)
      .map((x) => ({
        weekday: x.weekday,
        part: x.part,
        freeHours: Math.round((x.work - Math.min(x.busy, x.work)) / 60),
        loadPercent: pct(Math.min(x.busy, x.work), x.work),
      }))
      .sort((a, b) => a.loadPercent - b.loadPercent || b.freeHours - a.freeHours)
      .slice(0, 2),
    otherCurrencies: [...other].sort(),
  };
}

export interface Insight {
  id: string;
  tone: 'danger' | 'warning' | 'success';
  title: string;
  vars?: Record<string, string | number>;
  text: string;
  action: string;
  href: string;
}

const CALM: Insight = {
  id: 'calm',
  tone: 'success',
  title: msg('Срочных дел нет'),
  text: msg('За период нет неявок, долгов и перекосов загрузки. Загляните в журнал на завтра.'),
  action: msg('Открыть журнал'),
  href: '/today',
};

const WEEKDAY: Record<number, string> = {
  0: msg('воскресенье'),
  1: msg('понедельник'),
  2: msg('вторник'),
  3: msg('среда'),
  4: msg('четверг'),
  5: msg('пятница'),
  6: msg('суббота'),
};
const PART: Record<DayPart, string> = {
  morning: msg('утром'),
  day: msg('днём'),
  evening: msg('вечером'),
};
/** «вторник утром»: слова переводятся по отдельности, `t` экрана подставит их в фразу */
export const slotWords = (x: { weekday: number; part: DayPart }) => ({
  day: WEEKDAY[x.weekday]!,
  part: PART[x.part],
});

/** Подсказки салона: самое денежное первым, не больше трёх. Пороги простые и объяснены в тексте. */
export function beautyInsights(p: BeautyPult, extra: { lapsed?: number } = {}): Insight[] {
  const out: Insight[] = [];
  if (p.noShow.count > 0)
    out.push({
      id: 'no-show',
      tone: 'danger',
      title: msg('Неявки за период: {n}'),
      vars: { n: p.noShow.count, sum: p.noShow.minor },
      text: msg(
        'Это около {sum} упущенной выручки. Напоминание клиенту за день обычно снижает неявки.',
      ),
      action: msg('Настроить напоминания'),
      href: '/beauty-settings',
    });
  if (p.unpaid.count > 0)
    out.push({
      id: 'unpaid',
      tone: 'warning',
      title: msg('Не оплачено визитов: {n}'),
      vars: { n: p.unpaid.count, sum: p.unpaid.minor },
      text: msg('Завершённые визиты без полной оплаты на {sum}. Проверьте кассу.'),
      action: msg('Открыть финансы'),
      href: '/finance',
    });
  if ((extra.lapsed ?? 0) > 0)
    out.push({
      id: 'lapsed',
      tone: 'warning',
      title: msg('Не были больше 45 дней: {n}'),
      vars: { n: extra.lapsed! },
      text: msg(
        'Клиенты, которые раньше ходили, пропали. Напомните о себе сообщением или предложите скидку на возвращение.',
      ),
      action: msg('Открыть клиентов'),
      href: '/customers',
    });
  const slotTip = p.idleSlots[0];
  // без записей за период пустой весь график: это не подсказка, а шум
  if (slotTip && p.visits + p.noShow.count > 0 && out.length < 3)
    out.push({
      id: 'idle-slot',
      tone: 'warning',
      title: msg('Пустые окна: {day} {part}'),
      vars: { ...slotWords(slotTip), n: slotTip.freeHours, load: slotTip.loadPercent },
      text: msg('Свободно {n} ч, загрузка {load}%. Акция на это время заполнит окна.'),
      action: msg('Открыть продвижение'),
      href: '/marketing',
    });
  const idle = out.some((x) => x.id === 'idle-slot')
    ? []
    : p.masters.filter((m) => m.loadPercent > 0 && m.loadPercent < 40);
  if (idle.length)
    out.push({
      id: 'idle',
      tone: 'warning',
      title: msg('Свободные окна у мастеров: {n}'),
      vars: {
        n: idle.length,
        names: idle
          .slice(0, 2)
          .map((m) => m.name)
          .join(', '),
      },
      text: msg(
        'Загрузка ниже 40%: {names}. Онлайн-запись и акция на тихие часы помогут заполнить окна.',
      ),
      action: msg('Открыть продвижение'),
      href: '/marketing',
    });
  if (!out.length && p.visits > 0 && p.onlineShare < 20)
    out.push({
      id: 'online',
      tone: 'success',
      title: msg('Мало записей онлайн'),
      vars: { n: p.onlineShare },
      text: msg(
        'Онлайн записались {n}% клиентов. Ссылка на запись в Instagram и 2ГИС экономит время администратора.',
      ),
      action: msg('Сайт и онлайн-запись'),
      href: '/marketing/site/editor',
    });
  return out.length ? out.slice(0, 3) : [CALM];
}

/** Подсказки ресторана по отчёту периода и броням */
export function foodInsights(r: FoodPeriodReport, counts: Record<string, number>): Insight[] {
  const out: Insight[] = [];
  if (r.shortages.length)
    out.push({
      id: 'shortages',
      tone: 'danger',
      title: msg('Недостачи на складе: {n}'),
      vars: {
        n: r.shortages.length,
        names: r.shortages
          .slice(0, 2)
          .map((x) => x.name)
          .join(', '),
      },
      text: msg('Заказы списали больше, чем было: {names}. Сверьте остатки.'),
      action: msg('Открыть склад'),
      href: '/stock',
    });
  if (r.foodCostPct !== null && r.foodCostPct > 35)
    out.push({
      id: 'food-cost',
      tone: 'warning',
      title: msg('Фудкост {n}%'),
      vars: { n: r.foodCostPct },
      text: msg('Выше 35%: продукты съедают прибыль. Проверьте цены и техкарты дорогих блюд.'),
      action: msg('Открыть меню'),
      href: '/menu',
    });
  if ((counts['NO_SHOW'] ?? 0) > 0)
    out.push({
      id: 'no-show',
      tone: 'warning',
      title: msg('Гости не пришли по брони: {n}'),
      vars: { n: counts['NO_SHOW'] ?? 0 },
      text: msg('Подтверждайте брони в день визита и держите стол не дольше 15 минут.'),
      action: msg('Открыть брони'),
      href: '/table-reservations',
    });
  return out.length
    ? out.slice(0, 3)
    : [{ ...CALM, text: msg('Недостач, неявок и высокого фудкоста за период нет.') }];
}

/** Гостиница: поля сводки `GET /desk/dashboard`, которые нужны подсказкам */
export interface HotelInsightInput {
  nights: number;
  occupancy: { percent: number };
  bookings: { total: number; cancelledPercent: number; noShow: number };
  sources: Array<{ share: number }>;
  unassigned: number;
}

export function hotelInsights(c: HotelInsightInput): Insight[] {
  const out: Insight[] = [];
  if (c.bookings.noShow > 0)
    out.push({
      id: 'no-show',
      tone: 'danger',
      title: msg('Незаезды: {n}'),
      vars: { n: c.bookings.noShow },
      text: msg('Берите предоплату или гарантию картой за невозвратные тарифы.'),
      action: msg('Открыть тарифы'),
      href: '/rates',
    });
  if (c.bookings.total >= 5 && c.bookings.cancelledPercent >= 15)
    out.push({
      id: 'cancelled',
      tone: 'warning',
      title: msg('Отмены {n}%'),
      vars: { n: Math.round(c.bookings.cancelledPercent) },
      text: msg('Каждая шестая бронь и больше отменяется. Проверьте условия отмены по каналам.'),
      action: msg('Открыть брони'),
      href: '/reservations',
    });
  if (c.nights > 1 && c.occupancy.percent < 50)
    out.push({
      id: 'low-occupancy',
      tone: 'warning',
      title: msg('Загрузка {n}%'),
      vars: { n: Math.round(c.occupancy.percent) },
      text: msg('Меньше половины мест продано. Откройте больше каналов или снизьте цену на будни.'),
      action: msg('Открыть каналы'),
      href: '/channels',
    });
  if (out.length < 3 && c.sources.length && Math.max(...c.sources.map((x) => x.share)) >= 70)
    out.push({
      id: 'one-channel',
      tone: 'warning',
      title: msg('Почти все брони из одного канала'),
      text: msg('Зависимость от одного канала рискованна. Добавьте прямые брони через сайт.'),
      action: msg('Открыть каналы'),
      href: '/channels',
    });
  if (out.length < 3 && c.unassigned > 0)
    out.push({
      id: 'unassigned',
      tone: 'warning',
      title: msg('Без номера: {n}'),
      vars: { n: c.unassigned },
      text: msg('Проживания без номера не попадают в загрузку. Расселите их на шахматке.'),
      action: msg('Открыть шахматку'),
      href: '/chessboard',
    });
  return out.length
    ? out.slice(0, 3)
    : [
        {
          ...CALM,
          text: msg('Незаездов, частых отмен и провалов загрузки за период нет.'),
          href: '/chessboard',
          action: msg('Открыть шахматку'),
        },
      ];
}
