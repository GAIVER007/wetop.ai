/**
 * Партнёры WETOP (владелец 30.10.2026, PARTNERS-20261030, DATA_MODEL §63.1): партнёр приводит клиентов и получает
 * процент от их оплат. Считается за всё время: заведено на пробный (клиенты партнёра), подключено (клиенты с хотя бы
 * одной оплатой), доход от его клиентов, начислено = доход × процент вниз до цента, выплачено (расходы «Партнёрам» с
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
  payments: Array<{ organizationId: string; amountCents: bigint; voided: boolean }>;
  payouts: Array<{ partnerId: string; amountCents: bigint; voided: boolean }>;
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

export function buildPartners(src: PartnersSource): PartnersView {
  const income = new Map<string, bigint>();
  for (const p of src.payments) if (!p.voided) income.set(p.organizationId, (income.get(p.organizationId) ?? 0n) + p.amountCents);
  const paid = new Map<string, bigint>();
  for (const p of src.payouts) if (!p.voided) paid.set(p.partnerId, (paid.get(p.partnerId) ?? 0n) + p.amountCents);
  const views = src.partners.map((p): PartnerView => {
    const clients = src.links.filter((l) => l.partnerId === p.id).map((l) => l.organizationId);
    const inc = clients.reduce((n, id) => n + (income.get(id) ?? 0n), 0n);
    const accrued = (inc * BigInt(p.percentBp)) / 10000n;
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
