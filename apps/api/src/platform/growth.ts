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
    firstPayments: number;
    renewals: number;
    conversion: {
      visitorToRegistration: number | null;
      registrationToTrial: number | null;
      trialToPaid: number | null;
      /** Из клиентов, чей срок оплаты пришёлся на месяц, сколько оплатили снова */
      renewal: number | null;
    };
  };
  previous: { registrations: number; trials: number; firstPayments: number; incomeCents: string };
  income: Array<{ month: string; cents: string }>;
  /** Отток: клиенты, ушедшие за месяц в «только чтение» или приостановку (каждый один раз), и то же за прошлый месяц */
  churn: { count: number; previous: number };
  clients: GrowthClient[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
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
      paidIn,
    };
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
  const lapsed = [...subs.values()].filter(
    (s) => s.paidUntil !== null && s.paidUntil.slice(0, 7) === month && s.paidUntil < today && !cur.paidIn.has(s.organizationId),
  ).length;

  const clients: GrowthClient[] = orgs.map((o) => {
    const own = payments.filter((p) => p.organizationId === o.id);
    const sub = subs.get(o.id);
    return {
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
      firstPayments: cur.firstPayments,
      renewals: cur.renewals,
      conversion: {
        visitorToRegistration: tenthsPercent(cur.registrations, src.visitors),
        registrationToTrial: tenthsPercent(cur.trials, cur.registrations),
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
