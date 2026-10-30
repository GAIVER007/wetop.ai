import type { OrganizationStatus } from '@pms/domain';
import { tenthsPercent } from './growth';

/**
 * «Страны» в кабинете руководителя WETOP (владелец 29.10.2026, план docs/plans/2026-10-29-owner-cabinet-countries.md):
 * по стране посетители сайта wetop.ai за месяц (CF-IPCountry, миграция 169), новые клиенты месяца, первые оплаты,
 * платящие сейчас, доход месяца, MRR и средний LTV. Страна клиента из регистрации (страна телефона,
 * `organizations.country_code`); без неё строка «не указана» (`null`). Деньги целыми центами USD в bigint, на выходе
 * строкой; доли десятыми процента вниз (`500` это 50,0%). Своя организация WETOP и отменённые оплаты не считаются.
 */
export interface CountriesSource {
  organizations: Array<{ id: string; countryCode: string | null; status: OrganizationStatus; createdAt: Date }>;
  payments: Array<{ organizationId: string; amountCents: bigint; paidOn: string; voided: boolean }>;
  subscriptions: Array<{ organizationId: string; monthlyCents: bigint; paidUntil: string | null }>;
  /** Посетители сайта по стране за месяц; счётчика нет: `null` */
  visitors: Array<{ country: string | null; visitors: number }> | null;
  ownOrganizationId: string | null;
}

export interface CountryRow {
  country: string | null;
  visitors: number | null;
  newClients: number;
  firstPayments: number;
  paying: number;
  incomeCents: string;
  mrrCents: string;
  avgLtvCents: string;
  /** Новые клиенты из посетителей той же страны, десятые процента */
  visitorToClient: number | null;
  /** Первые оплаты из новых клиентов месяца */
  clientToPaid: number | null;
}

export interface CountriesView {
  month: string;
  rows: CountryRow[];
  total: Omit<CountryRow, 'country' | 'avgLtvCents'>;
}

interface Acc {
  visitors: number;
  newClients: number;
  firstPayments: number;
  paying: number;
  income: bigint;
  mrr: bigint;
  ltv: bigint;
  paidClients: number;
}
const empty = (): Acc => ({ visitors: 0, newClients: 0, firstPayments: 0, paying: 0, income: 0n, mrr: 0n, ltv: 0n, paidClients: 0 });

export function buildCountries(src: CountriesSource, month: string, now: Date): CountriesView {
  const today = now.toISOString().slice(0, 10);
  const orgs = src.organizations.filter((o) => o.id !== src.ownOrganizationId);
  const countryOf = new Map(orgs.map((o) => [o.id, o.countryCode]));
  const byCountry = new Map<string | null, Acc>();
  const acc = (c: string | null) => {
    const a = byCountry.get(c) ?? empty();
    byCountry.set(c, a);
    return a;
  };
  const payments = src.payments.filter((p) => !p.voided && countryOf.has(p.organizationId)).sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  const firstPaid = new Map<string, string>();
  const ltv = new Map<string, bigint>();
  for (const p of payments) {
    if (!firstPaid.has(p.organizationId)) firstPaid.set(p.organizationId, p.paidOn);
    ltv.set(p.organizationId, (ltv.get(p.organizationId) ?? 0n) + p.amountCents);
    if (p.paidOn.slice(0, 7) === month) acc(countryOf.get(p.organizationId)!).income += p.amountCents;
  }
  for (const o of orgs) {
    const a = acc(o.countryCode);
    if (o.createdAt.toISOString().slice(0, 7) === month) a.newClients += 1;
    if (o.status === 'ACTIVE') a.paying += 1;
    if (firstPaid.get(o.id)?.slice(0, 7) === month) a.firstPayments += 1;
    const v = ltv.get(o.id);
    if (v !== undefined) {
      a.ltv += v;
      a.paidClients += 1;
    }
  }
  for (const s of src.subscriptions) {
    if (!countryOf.has(s.organizationId) || s.paidUntil === null || s.paidUntil < today) continue;
    acc(countryOf.get(s.organizationId)!).mrr += s.monthlyCents;
  }
  for (const v of src.visitors ?? []) acc(v.country).visitors += v.visitors;

  const known = src.visitors !== null;
  const order = [...byCountry.entries()].sort(
    ([xc, x], [yc, y]) =>
      (y.income > x.income ? 1 : y.income < x.income ? -1 : 0) || y.visitors - x.visitors || (xc ?? 'ZZZ').localeCompare(yc ?? 'ZZZ'),
  );
  const rows: CountryRow[] = order.map(([country, a]) => ({
    country,
    visitors: known ? a.visitors : null,
    newClients: a.newClients,
    firstPayments: a.firstPayments,
    paying: a.paying,
    incomeCents: String(a.income),
    mrrCents: String(a.mrr),
    avgLtvCents: a.paidClients ? String(a.ltv / BigInt(a.paidClients)) : '0',
    visitorToClient: known ? tenthsPercent(a.newClients, a.visitors) : null,
    clientToPaid: tenthsPercent(a.firstPayments, a.newClients),
  }));

  const all = [...byCountry.values()].reduce(
    (t, a) => ({
      visitors: t.visitors + a.visitors,
      newClients: t.newClients + a.newClients,
      firstPayments: t.firstPayments + a.firstPayments,
      paying: t.paying + a.paying,
      income: t.income + a.income,
      mrr: t.mrr + a.mrr,
    }),
    { visitors: 0, newClients: 0, firstPayments: 0, paying: 0, income: 0n, mrr: 0n },
  );
  return {
    month,
    rows,
    total: {
      visitors: known ? all.visitors : null,
      newClients: all.newClients,
      firstPayments: all.firstPayments,
      paying: all.paying,
      incomeCents: String(all.income),
      mrrCents: String(all.mrr),
      visitorToClient: known ? tenthsPercent(all.newClients, all.visitors) : null,
      clientToPaid: tenthsPercent(all.firstPayments, all.newClients),
    },
  };
}
