import type { OrganizationStatus } from '@pms/domain';
import { shiftMonth } from './money';

/**
 * Кабинет руководителя WETOP, срез 3 (владелец 29.10.2026, вариант «А», план docs/plans/2026-10-29-owner-cabinet-full.md):
 * путь клиента месяца с конверсиями, MRR, LTV и сколько клиент с нами. Считается из того, что уже есть в базе:
 * учётки, организации, оплаты и подписки компании. Деньги целыми центами USD в bigint; проценты целыми десятыми
 * долями процента (`500` это 50,0%), без плавающей точки. Месяц календарный по UTC, как в «Деньгах».
 */
export interface GrowthSource {
  organizations: Array<{ id: string; name: string; status: OrganizationStatus; createdAt: Date; trialEndsAt: Date | null }>;
  /** Когда созданы учётки людей (регистрации) */
  registrations: Date[];
  payments: Array<{ organizationId: string; amountCents: bigint; paidOn: string; voided: boolean }>;
  subscriptions: Array<{ organizationId: string; monthlyCents: bigint; paidUntil: string | null }>;
  /** Посетители wetop.ai за месяц; счётчика на сайте ещё нет: `null` */
  visitors: number | null;
  ownOrganizationId: string | null;
  /** Смены статуса из журнала (`organization.status_changed`); старый источник без них: отток 0 */
  statusChanges?: Array<{ organizationId: string; to: OrganizationStatus; at: Date }>;
  /**
   * Дни, когда организация работала в системе (действия в журнале и входы), по UTC (главная «B», 30.10.2026). Старый
   * источник без них: активность на пробном неизвестна
   */
  activity?: Array<{ organizationId: string; day: string }>;
}

export interface GrowthClient {
  id: string;
  name: string;
  status: OrganizationStatus;
  since: string;
  daysWithUs: number;
  trialDaysLeft: number | null;
  ltvCents: string;
  payments: number;
  lastPaidOn: string | null;
  monthlyCents: string | null;
  paidUntil: string | null;
  /** «Клиенты» C (30.10.2026): дни работы в системе за срок пробного и за последние 7 дней; журнала нет: `null` */
  trialActiveDays: number | null;
  activeDays7: number | null;
  /** Пробный, с нами 3 дня и больше, а работал меньше 3 дней из последних 7 */
  atRisk: boolean;
}

export interface GrowthView {
  month: string;
  kpi: {
    mrrCents: string;
    paying: number;
    trial: number;
    /** Пробный кончается за 3 дня или уже кончился */
    trialEndingSoon: number;
    unpaid: number;
    avgLtvCents: string;
    /** Сколько в среднем платящий клиент с нами, дней */
    avgDaysWithUs: number;
  };
  funnel: {
    visitors: number | null;
    registrations: number;
    trials: number;
    /** Пробные месяца, где работали в системе 3 дня и больше за срок пробного */
    activeTrials: number;
    firstPayments: number;
    renewals: number;
    conversion: {
      visitorToRegistration: number | null;
      registrationToTrial: number | null;
      /** Пробный → активный на пробном; журнала работы нет: `null` */
      trialToActive: number | null;
      trialToPaid: number | null;
      /** Из клиентов, чей срок оплаты пришёлся на месяц, сколько оплатили снова */
      renewal: number | null;
    };
  };
  previous: { registrations: number; trials: number; firstPayments: number; incomeCents: string };
  /** Оплаты месяца (главная «B»): клиенты, оплатившие в месяце, число оплат, сумма и средний чек; и прошлый месяц */
  money: MonthMoney & { previous: MonthMoney };
  /**
   * Пробный (главная «B»): регистрации, сейчас на пробном, у кого пробный кончился в месяце и сколько из них не
   * оплатили; средние дни работы на пробном (десятые доли дня) у всех, у оплативших и у не оплативших
   */
  trial: {
    registrations: number;
    previousRegistrations: number;
    now: number;
    endingSoon: number;
    ended: number;
    endedUnpaid: number;
    avgActiveDaysTenths: number | null;
    paidActiveDaysTenths: number | null;
    unpaidActiveDaysTenths: number | null;
  };
  /** По месяцам: пробный в оплату и продления, десятые доли процента; шесть месяцев, выбранный последним */
  rates: Array<{ month: string; trialToPaid: number | null; renewal: number | null }>;
  income: Array<{ month: string; cents: string }>;
  /** Отток: клиенты, ушедшие за месяц в «только чтение» или приостановку (каждый один раз), и то же за прошлый месяц */
  churn: { count: number; previous: number };
  clients: GrowthClient[];
}

export interface MonthMoney {
  paidClients: number;
  paymentsCount: number;
  incomeCents: string;
  avgCheckCents: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Активный на пробном: работал в системе столько дней и больше за срок пробного */
export const ACTIVE_TRIAL_DAYS = 3;
const TRIAL_FALLBACK_DAYS = 7;
const dayOf = (d: Date) => d.toISOString().slice(0, 10);
/** Среднее в десятых долях, округление половины вверх; пусто: `null` */
const avgTenths = (xs: number[]) => (xs.length ? Math.floor((xs.reduce((n, x) => n + x, 0) * 20 / xs.length + 1) / 2) : null);
const monthOfDate = (d: Date) => d.toISOString().slice(0, 7);

/** Доля в десятых процента вниз; знаменатель 0 или неизвестен: `null` */
export function tenthsPercent(part: number, whole: number | null): number | null {
  if (!whole) return null;
  return Math.floor((part * 1000) / whole);
}

export function buildGrowth(src: GrowthSource, month: string, now: Date): GrowthView {
  const today = now.toISOString().slice(0, 10);
  const orgs = src.organizations.filter((o) => o.id !== src.ownOrganizationId);
  const ids = new Set(orgs.map((o) => o.id));
  const payments = src.payments
    .filter((p) => !p.voided && ids.has(p.organizationId))
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  const subs = new Map(src.subscriptions.filter((s) => ids.has(s.organizationId)).map((s) => [s.organizationId, s]));
  const firstPaid = new Map<string, string>();
  for (const p of payments) if (!firstPaid.has(p.organizationId)) firstPaid.set(p.organizationId, p.paidOn);

  const monthStats = (m: string) => {
    const paidIn = new Set(payments.filter((p) => p.paidOn.slice(0, 7) === m).map((p) => p.organizationId));
    const first = [...paidIn].filter((id) => firstPaid.get(id)!.slice(0, 7) === m);
    return {
      registrations: src.registrations.filter((d) => monthOfDate(d) === m).length,
      trials: orgs.filter((o) => monthOfDate(o.createdAt) === m).length,
      firstPayments: first.length,
      renewals: paidIn.size - first.length,
      incomeCents: payments.filter((p) => p.paidOn.slice(0, 7) === m).reduce((n, p) => n + p.amountCents, 0n),
      paymentsCount: payments.filter((p) => p.paidOn.slice(0, 7) === m).length,
      paidIn,
    };
  };
  const moneyOf = (st: ReturnType<typeof monthStats>): MonthMoney => ({
    paidClients: st.paidIn.size,
    paymentsCount: st.paymentsCount,
    incomeCents: String(st.incomeCents),
    avgCheckCents: st.paymentsCount ? String(st.incomeCents / BigInt(st.paymentsCount)) : '0',
  });
  // срок оплаты в месяце m прошёл, а оплаты в m не было: не продлили
  const lapsedIn = (m: string, paidIn: Set<string>) =>
    [...subs.values()].filter(
      (s) => s.paidUntil !== null && s.paidUntil.slice(0, 7) === m && s.paidUntil < today && !paidIn.has(s.organizationId),
    ).length;
  // дни работы в системе за срок пробного: от создания до конца пробного (нет срока: 7 дней)
  const known = src.activity !== undefined;
  const days = new Map<string, Set<string>>();
  for (const a of src.activity ?? []) {
    if (!days.has(a.organizationId)) days.set(a.organizationId, new Set());
    days.get(a.organizationId)!.add(a.day);
  }
  const trialEnd = (o: (typeof orgs)[number]) => o.trialEndsAt ?? new Date(o.createdAt.getTime() + TRIAL_FALLBACK_DAYS * DAY_MS);
  const trialDays = (o: (typeof orgs)[number]) => {
    const from = dayOf(o.createdAt);
    const to = dayOf(trialEnd(o));
    return [...(days.get(o.id) ?? [])].filter((d) => d >= from && d < to).length;
  };
  const churnOf = (m: string) =>
    new Set(
      (src.statusChanges ?? [])
        .filter((c) => ids.has(c.organizationId) && (c.to === 'READ_ONLY' || c.to === 'SUSPENDED') && monthOfDate(c.at) === m)
        .map((c) => c.organizationId),
    ).size;
  const cur = monthStats(month);
  const prev = monthStats(shiftMonth(month, -1));
  // срок оплаты в этом месяце прошёл, а оплаты в месяце не было: не продлили
  const lapsed = lapsedIn(month, cur.paidIn);
  const monthTrials = orgs.filter((o) => monthOfDate(o.createdAt) === month);
  const activeTrials = known ? monthTrials.filter((o) => trialDays(o) >= ACTIVE_TRIAL_DAYS).length : 0;
  // пробный кончился в месяце и уже кончился
  const ended = orgs.filter((o) => monthOfDate(trialEnd(o)) === month && trialEnd(o).getTime() <= now.getTime());
  const everPaid = new Set(payments.map((p) => p.organizationId));
  const endedPaid = ended.filter((o) => everPaid.has(o.id));
  const endedUnpaid = ended.filter((o) => !everPaid.has(o.id));

  const weekFrom = dayOf(new Date(now.getTime() - 6 * DAY_MS));
  const clients: GrowthClient[] = orgs.map((o) => {
    const own = payments.filter((p) => p.organizationId === o.id);
    const sub = subs.get(o.id);
    const week = known ? [...(days.get(o.id) ?? [])].filter((d) => d >= weekFrom && d <= today).length : null;
    const withUs = Math.max(0, Math.floor((now.getTime() - o.createdAt.getTime()) / DAY_MS));
    return {
      trialActiveDays: known ? trialDays(o) : null,
      activeDays7: week,
      atRisk: o.status === 'TRIAL' && week !== null && withUs >= ACTIVE_TRIAL_DAYS && week < ACTIVE_TRIAL_DAYS,
      id: o.id,
      name: o.name,
      status: o.status,
      since: o.createdAt.toISOString(),
      daysWithUs: Math.max(0, Math.floor((now.getTime() - o.createdAt.getTime()) / DAY_MS)),
      trialDaysLeft:
        o.status === 'TRIAL' && o.trialEndsAt ? Math.max(0, Math.ceil((o.trialEndsAt.getTime() - now.getTime()) / DAY_MS)) : null,
      ltvCents: String(own.reduce((n, p) => n + p.amountCents, 0n)),
      payments: own.length,
      lastPaidOn: own.at(-1)?.paidOn ?? null,
      monthlyCents: sub ? String(sub.monthlyCents) : null,
      paidUntil: sub?.paidUntil ?? null,
    };
  });
  const paid = clients.filter((c) => c.payments > 0);
  const ltvSum = paid.reduce((n, c) => n + BigInt(c.ltvCents), 0n);
  const live = clients.filter((c) => c.status !== 'SUSPENDED');
  const mrr = [...subs.values()]
    .filter((s) => s.paidUntil !== null && s.paidUntil >= today)
    .reduce((n, s) => n + s.monthlyCents, 0n);

  return {
    month,
    kpi: {
      mrrCents: String(mrr),
      paying: live.filter((c) => c.status === 'ACTIVE').length,
      trial: live.filter((c) => c.status === 'TRIAL').length,
      trialEndingSoon: live.filter((c) => c.status === 'TRIAL' && (c.trialDaysLeft ?? 0) <= 3).length,
      unpaid: live.filter((c) => c.status === 'READ_ONLY').length,
      avgLtvCents: paid.length ? String(ltvSum / BigInt(paid.length)) : '0',
      avgDaysWithUs: paid.length ? Math.floor(paid.reduce((n, c) => n + c.daysWithUs, 0) / paid.length) : 0,
    },
    funnel: {
      visitors: src.visitors,
      registrations: cur.registrations,
      trials: cur.trials,
      activeTrials,
      firstPayments: cur.firstPayments,
      renewals: cur.renewals,
      conversion: {
        visitorToRegistration: tenthsPercent(cur.registrations, src.visitors),
        registrationToTrial: tenthsPercent(cur.trials, cur.registrations),
        trialToActive: known ? tenthsPercent(activeTrials, cur.trials) : null,
        trialToPaid: tenthsPercent(cur.firstPayments, cur.trials),
        renewal: tenthsPercent(cur.renewals, cur.renewals + lapsed),
      },
    },
    previous: {
      registrations: prev.registrations,
      trials: prev.trials,
      firstPayments: prev.firstPayments,
      incomeCents: String(prev.incomeCents),
    },
    money: { ...moneyOf(cur), previous: moneyOf(prev) },
    trial: {
      registrations: cur.registrations,
      previousRegistrations: prev.registrations,
      now: live.filter((c) => c.status === 'TRIAL').length,
      endingSoon: live.filter((c) => c.status === 'TRIAL' && (c.trialDaysLeft ?? 0) <= 3).length,
      ended: ended.length,
      endedUnpaid: endedUnpaid.length,
      avgActiveDaysTenths: known ? avgTenths(ended.map(trialDays)) : null,
      paidActiveDaysTenths: known ? avgTenths(endedPaid.map(trialDays)) : null,
      unpaidActiveDaysTenths: known ? avgTenths(endedUnpaid.map(trialDays)) : null,
    },
    rates: [-5, -4, -3, -2, -1, 0].map((d) => {
      const m = shiftMonth(month, d);
      const st = monthStats(m);
      return { month: m, trialToPaid: tenthsPercent(st.firstPayments, st.trials), renewal: tenthsPercent(st.renewals, st.renewals + lapsedIn(m, st.paidIn)) };
    }),
    income: [-5, -4, -3, -2, -1, 0].map((d) => {
      const m = shiftMonth(month, d);
      return { month: m, cents: String(monthStats(m).incomeCents) };
    }),
    churn: { count: churnOf(month), previous: churnOf(shiftMonth(month, -1)) },
    // кто больше принёс, выше; дальше новые
    clients: clients.sort((a, b) => {
      const d = BigInt(b.ltvCents) - BigInt(a.ltvCents);
      return d > 0n ? 1 : d < 0n ? -1 : b.since.localeCompare(a.since);
    }),
  };
}
