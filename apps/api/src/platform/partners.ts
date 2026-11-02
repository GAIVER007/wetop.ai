/**
 * Партнёры WETOP (владелец 30.10.2026, PARTNERS-20261030, DATA_MODEL §63.1): партнёр приводит клиентов и получает
 * процент от их оплат. Считается за всё время: заведено на пробный (клиенты партнёра), подключено (клиенты с хотя бы
 * одной оплатой), доход от его клиентов, начислено = разовая выплата за тариф с первого чека (DATA_MODEL §63.2,
 * 30.10.2026) + процент с первого чека допа вниз до цента; следующие чеки партнёру ничего не дают, выплачено (расходы «Партнёрам» с
 * отметкой партнёра), к выплате = начислено − выплачено, не меньше нуля. Деньги центами bigint, процент в сотых
 * долях процента (`2000` это 20%), без плавающей точки (AGENTS §12).
 */
export interface PartnerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  percentBp: number;
  active: boolean;
}

export interface PartnersSource {
  partners: PartnerRow[];
  links: Array<{ organizationId: string; partnerId: string }>;
  /** `PLAN`: оплата тарифа, `ADDON`: доп (ИИ-продавец, таргетолог, контент, продвижение); старые оплаты без отметки: тариф */
  payments: Array<{ organizationId: string; amountCents: bigint; voided: boolean; kind?: 'PLAN' | 'ADDON'; paidOn?: string }>;
  payouts: Array<{ partnerId: string; amountCents: bigint; voided: boolean }>;
  /** Разовая выплата партнёру за тариф клиента (тариф подписки, `partner_payout_cents`); нет строки: 0 */
  planPayouts?: Array<{ organizationId: string; payoutCents: bigint }>;
}

export interface PartnerView extends PartnerRow {
  trials: number;
  connected: number;
  incomeCents: string;
  accruedCents: string;
  paidCents: string;
  dueCents: string;
}

export interface PartnersView {
  partners: PartnerView[];
  /** Итог по действующим партнёрам */
  totals: { partners: number; trials: number; connected: number; incomeCents: string; accruedCents: string; paidCents: string; dueCents: string };
}

/**
 * Разовая выплата за тариф по тарифу ПЕРВОГО чека клиента (аудит 01.11.2026): переход с месячного на годовой не
 * превращает $10 в $100, пропавшая подписка не обнуляет. Тариф первого чека ищется по сумме среди тарифов с выплатой;
 * сумма не совпала ни с одним (скидка, ручная цена): выплата по тарифу нынешней подписки, как раньше.
 */
export function planPayoutsOf(
  payments: Array<{ organizationId: string; amountCents: bigint; paidOn?: string; voided: boolean; kind?: 'PLAN' | 'ADDON' }>,
  plans: Array<{ priceCents: bigint; partnerPayoutCents: bigint | null }>,
  bySubscription: Array<{ organizationId: string; payoutCents: bigint }>,
): Array<{ organizationId: string; payoutCents: bigint }> {
  const firstPlan = new Map<string, bigint>();
  payments
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.voided && (p.kind ?? 'PLAN') === 'PLAN')
    .sort((a, b) => (a.p.paidOn ?? '').localeCompare(b.p.paidOn ?? '') || a.i - b.i)
    .forEach(({ p }) => {
      if (!firstPlan.has(p.organizationId)) firstPlan.set(p.organizationId, p.amountCents);
    });
  const sub = new Map(bySubscription.map((x) => [x.organizationId, x.payoutCents]));
  const ids = [...new Set([...firstPlan.keys(), ...sub.keys()])];
  return ids.flatMap((organizationId) => {
    const amount = firstPlan.get(organizationId);
    const plan = amount === undefined ? undefined : plans.find((x) => x.priceCents === amount && x.partnerPayoutCents != null);
    const payoutCents = plan?.partnerPayoutCents ?? sub.get(organizationId);
    return payoutCents === undefined || payoutCents === null ? [] : [{ organizationId, payoutCents }];
  });
}

export function buildPartners(src: PartnersSource): PartnersView {
  const income = new Map<string, bigint>();
  for (const p of src.payments) if (!p.voided) income.set(p.organizationId, (income.get(p.organizationId) ?? 0n) + p.amountCents);
  const planPaid = new Set(src.payments.filter((p) => !p.voided && (p.kind ?? 'PLAN') === 'PLAN').map((p) => p.organizationId));
  // владелец 30.10.2026: «с доп услуг тоже ничего не идёт, только с 1 чека»: процент только с первого чека допа клиента
  const addons = new Map<string, bigint>();
  const byDay = src.payments.map((p, i) => ({ p, i })).sort((a, b) => (a.p.paidOn ?? '').localeCompare(b.p.paidOn ?? '') || a.i - b.i);
  for (const { p } of byDay) if (!p.voided && p.kind === 'ADDON' && !addons.has(p.organizationId)) addons.set(p.organizationId, p.amountCents);
  const payout = new Map((src.planPayouts ?? []).map((x) => [x.organizationId, x.payoutCents]));
  const paid = new Map<string, bigint>();
  for (const p of src.payouts) if (!p.voided) paid.set(p.partnerId, (paid.get(p.partnerId) ?? 0n) + p.amountCents);
  const views = src.partners.map((p): PartnerView => {
    const clients = src.links.filter((l) => l.partnerId === p.id).map((l) => l.organizationId);
    const inc = clients.reduce((n, id) => n + (income.get(id) ?? 0n), 0n);
    // владелец 30.10.2026: за тариф разово с первого чека (месяц $19: $10, год $199: $100), с допов процент партнёра
    const accrued = clients.reduce((n, id) => {
      const once = planPaid.has(id) ? (payout.get(id) ?? 0n) : 0n;
      return n + once + ((addons.get(id) ?? 0n) * BigInt(p.percentBp)) / 10000n;
    }, 0n);
    const out = paid.get(p.id) ?? 0n;
    return {
      ...p,
      trials: clients.length,
      connected: clients.filter((id) => (income.get(id) ?? 0n) > 0n).length,
      incomeCents: String(inc),
      accruedCents: String(accrued),
      paidCents: String(out),
      dueCents: String(accrued > out ? accrued - out : 0n),
    };
  });
  // действующие выше, внутри по порядку добавления
  const ordered = [...views.filter((p) => p.active), ...views.filter((p) => !p.active)];
  const live = ordered.filter((p) => p.active);
  const sum = (pick: (p: PartnerView) => string) => String(live.reduce((n, p) => n + BigInt(pick(p)), 0n));
  return {
    partners: ordered,
    totals: {
      partners: live.length,
      trials: live.reduce((n, p) => n + p.trials, 0),
      connected: live.reduce((n, p) => n + p.connected, 0),
      incomeCents: sum((p) => p.incomeCents),
      accruedCents: sum((p) => p.accruedCents),
      paidCents: sum((p) => p.paidCents),
      dueCents: sum((p) => p.dueCents),
    },
  };
}

/** «20», «12.5» или «12,5» в сотые доли процента; от 0 до 100, до двух знаков после точки; иначе null */
export function parsePercentBp(input: unknown): number | null {
  if (typeof input !== 'string') return null;
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  return bp > 10000 ? null : bp;
}
