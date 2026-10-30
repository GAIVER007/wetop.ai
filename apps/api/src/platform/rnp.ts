/**
 * РНП, «рука на пульсе» (владелец 30.10.2026, эскиз «РНП в Кабинете WETOP»): каждый день месяца строкой и итоги
 * периода. Посетители и заявки со счётчика wetop.ai (заявка: посетитель отправил форму регистрации, `signup_sent`),
 * регистрации: заведённые организации-клиенты, первые оплаты: первая неаннулированная оплата клиента за всё время,
 * сумма: все оплаты дня, расходы: «Расходы» Кабинета. Вкладка «Партнёры»: то же по клиентам каждого партнёра за месяц.
 * Деньги центами bigint строкой, конверсии целыми десятыми процента (`666` это 66,6%), без плавающей точки (AGENTS §12).
 */
export interface RnpSource {
  /** Сессии сайта: день по UTC и посетитель */
  visitors: Array<{ day: string; visitorKey: string }>;
  /** Отправленные формы регистрации: день и посетитель */
  leads: Array<{ day: string; visitorKey: string }>;
  organizations: Array<{ id: string; createdAt: Date }>;
  payments: Array<{ organizationId: string; amountCents: bigint; paidOn: string; voided: boolean }>;
  expenses: Array<{ amountCents: bigint; spentOn: string; voided: boolean; partnerId: string | null }>;
  partners: Array<{ id: string; name: string; percentBp: number; active: boolean }>;
  links: Array<{ organizationId: string; partnerId: string }>;
}

export interface RnpDay {
  day: string;
  visitors: number;
  leads: number;
  registrations: number;
  firstPayments: number;
  incomeCents: string;
  expensesCents: string;
}

export interface RnpTotal extends Omit<RnpDay, 'day'> {
  visitorToLead: number | null;
  leadToRegistration: number | null;
  registrationToPaid: number | null;
  costPerRegistrationCents: string | null;
}

export interface RnpPartnerRow {
  id: string;
  name: string;
  active: boolean;
  /** Клиентов у партнёра всего */
  clients: number;
  registrations: number;
  firstPayments: number;
  broughtCents: string;
  accruedCents: string;
  paidCents: string;
  broughtAllTimeCents: string;
}

export interface RnpView {
  month: string;
  days: RnpDay[];
  total: RnpTotal;
  partners: {
    rows: RnpPartnerRow[];
    total: { partners: number; active: number; registrations: number; firstPayments: number; broughtCents: string; accruedCents: string; paidCents: string; broughtAllTimeCents: string };
  };
}

/** Доля целыми десятыми процента; знаменатель 0: null */
const share = (part: number, whole: number): number | null => (whole > 0 ? Math.floor((part * 1000) / whole) : null);

export function buildRnp(src: RnpSource, month: string): RnpView {
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const days = Array.from({ length }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const inMonth = (d: string) => d.slice(0, 7) === month;
  const paid = src.payments.filter((p) => !p.voided);
  // первая оплата клиента за всё время
  const first = new Map<string, string>();
  for (const p of [...paid].sort((a, b) => a.paidOn.localeCompare(b.paidOn))) if (!first.has(p.organizationId)) first.set(p.organizationId, p.paidOn);
  const regDay = new Map(src.organizations.map((o) => [o.id, o.createdAt.toISOString().slice(0, 10)]));
  const spent = src.expenses.filter((e) => !e.voided);

  const uniq = (rows: Array<{ day: string; visitorKey: string }>, d: string | null) =>
    new Set(rows.filter((r) => (d ? r.day === d : inMonth(r.day))).map((r) => r.visitorKey)).size;
  const sum = (xs: bigint[]) => xs.reduce((n, x) => n + x, 0n);

  const row = (d: string | null): Omit<RnpDay, 'day'> => {
    const hit = (x: string) => (d ? x === d : inMonth(x));
    return {
      visitors: uniq(src.visitors, d),
      leads: uniq(src.leads, d),
      registrations: [...regDay.values()].filter(hit).length,
      firstPayments: [...first.values()].filter(hit).length,
      incomeCents: String(sum(paid.filter((p) => hit(p.paidOn)).map((p) => p.amountCents))),
      expensesCents: String(sum(spent.filter((e) => hit(e.spentOn)).map((e) => e.amountCents))),
    };
  };
  const t = row(null);
  const spentTotal = BigInt(t.expensesCents);

  // партнёры: клиенты по отметке, деньги их клиентов за месяц и за всё время, выплаты партнёру за месяц
  const rows = src.partners.map((p): RnpPartnerRow => {
    const orgs = new Set(src.links.filter((l) => l.partnerId === p.id).map((l) => l.organizationId));
    const theirs = paid.filter((x) => orgs.has(x.organizationId));
    const brought = sum(theirs.filter((x) => inMonth(x.paidOn)).map((x) => x.amountCents));
    return {
      id: p.id,
      name: p.name,
      active: p.active,
      clients: orgs.size,
      registrations: [...orgs].filter((id) => inMonth(regDay.get(id) ?? '')).length,
      firstPayments: [...orgs].filter((id) => inMonth(first.get(id) ?? '')).length,
      broughtCents: String(brought),
      accruedCents: String((brought * BigInt(p.percentBp)) / 10000n),
      paidCents: String(sum(spent.filter((e) => e.partnerId === p.id && inMonth(e.spentOn)).map((e) => e.amountCents))),
      broughtAllTimeCents: String(sum(theirs.map((x) => x.amountCents))),
    };
  });
  const big = (pick: (r: RnpPartnerRow) => string) => String(sum(rows.map((r) => BigInt(pick(r)))));

  return {
    month,
    days: days.map((d) => ({ day: d, ...row(d) })),
    total: {
      ...t,
      visitorToLead: share(t.leads, t.visitors),
      leadToRegistration: share(t.registrations, t.leads),
      registrationToPaid: share(t.firstPayments, t.registrations),
      costPerRegistrationCents: t.registrations > 0 ? String(spentTotal / BigInt(t.registrations)) : null,
    },
    partners: {
      rows: [...rows].sort((a, b) => (BigInt(b.broughtCents) > BigInt(a.broughtCents) ? 1 : BigInt(b.broughtCents) < BigInt(a.broughtCents) ? -1 : 0) || b.registrations - a.registrations),
      total: {
        partners: rows.length,
        active: rows.filter((r) => r.registrations > 0 || BigInt(r.broughtCents) > 0n).length,
        registrations: rows.reduce((n, r) => n + r.registrations, 0),
        firstPayments: rows.reduce((n, r) => n + r.firstPayments, 0),
        broughtCents: big((r) => r.broughtCents),
        accruedCents: big((r) => r.accruedCents),
        paidCents: big((r) => r.paidCents),
        broughtAllTimeCents: big((r) => r.broughtAllTimeCents),
      },
    },
  };
}
