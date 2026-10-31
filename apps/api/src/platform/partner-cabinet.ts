/**
 * Кабинет партнёра WETOP (владелец 31.10.2026 «Да, делай этот срез»; ТЗ VTOP 01.11.2026; DATA_MODEL §63.3).
 * Партнёр видит только своих клиентов: имя или компания, статус, срок пробного, оплачен или нет, его комиссия с
 * клиента. Контактов клиента, его выручки и работы бизнеса здесь нет. Деньги по правилу первого чека (§63.2): за
 * тариф разово `partner_payout_cents` тарифа клиента при первой неотменённой оплате тарифа, с допов процент партнёра с
 * первого неотменённого чека допа; повторные чеки ничего не дают. Баланс = начислено − выплачено, не меньше нуля.
 * Деньги центами bigint, наружу строкой (AGENTS §12).
 */
export type PartnerClientStatus = 'TRIAL' | 'TRIAL_ENDED' | 'ACTIVE' | 'PAID' | 'LOST';

export interface PartnerCabinetSource {
  partner: { id: string; name: string; code: string | null; percentBp: number };
  partners: Array<{ id: string; active: boolean }>;
  links: Array<{ organizationId: string; partnerId: string; source: string; channel: string | null }>;
  organizations: Array<{ id: string; name: string; status: string; trialEndsAt: string | null; createdAt: string }>;
  payments: Array<{ organizationId: string; amountCents: bigint; paidOn: string; voided: boolean; kind: 'PLAN' | 'ADDON' }>;
  planPayouts: Array<{ organizationId: string; payoutCents: bigint }>;
  payouts: Array<{ partnerId: string; amountCents: bigint; spentOn: string; voided: boolean; note: string | null }>;
}

export interface PartnerCabinetClient {
  organizationId: string;
  name: string;
  status: PartnerClientStatus;
  paid: boolean;
  trialEndsAt: string | null;
  source: string;
  channel: string | null;
  since: string;
  commissionCents: string;
}

export interface PartnerCabinetView {
  clients: PartnerCabinetClient[];
  money: { accruedCents: string; paidCents: string; balanceCents: string };
  payouts: Array<{ spentOn: string; amountCents: string; note: string | null }>;
  /** `conversion` десятыми процента: оплатили / клиентов; клиентов нет: null */
  stats: { clients: number; trial: number; paid: number; trialEnded: number; conversion: number | null };
  rating: { place: number; of: number };
}

/** Статус клиента партнёра из состояния организации и факта оплаты тарифа */
export function clientStatus(
  org: { status: string; trialEndsAt: string | null },
  paidPlan: boolean,
  now: Date,
): PartnerClientStatus {
  if (org.status === 'SUSPENDED') return 'LOST';
  if (paidPlan) return 'PAID';
  if (org.status === 'READ_ONLY') return 'TRIAL_ENDED';
  if (org.status === 'TRIAL') return org.trialEndsAt && new Date(org.trialEndsAt) > now ? 'TRIAL' : 'TRIAL_ENDED';
  return 'ACTIVE';
}

/** Комиссия партнёра по каждому клиенту (правило первого чека) */
function commissions(
  orgIds: string[],
  percentBp: number,
  payments: PartnerCabinetSource['payments'],
  planPayouts: PartnerCabinetSource['planPayouts'],
): Map<string, bigint> {
  const payout = new Map(planPayouts.map((x) => [x.organizationId, x.payoutCents]));
  const live = payments.filter((p) => !p.voided).sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  const out = new Map<string, bigint>();
  for (const id of orgIds) {
    const mine = live.filter((p) => p.organizationId === id);
    const plan = mine.some((p) => p.kind === 'PLAN') ? (payout.get(id) ?? 0n) : 0n;
    const addon = mine.find((p) => p.kind === 'ADDON');
    out.set(id, plan + (addon ? (addon.amountCents * BigInt(percentBp)) / 10000n : 0n));
  }
  return out;
}

const STATUS_ORDER: Record<PartnerClientStatus, number> = { TRIAL: 0, PAID: 1, ACTIVE: 2, TRIAL_ENDED: 3, LOST: 4 };

export function buildPartnerCabinet(src: PartnerCabinetSource, now: Date): PartnerCabinetView {
  const paidPlan = new Set(src.payments.filter((p) => !p.voided && p.kind === 'PLAN').map((p) => p.organizationId));
  const own = src.links.filter((l) => l.partnerId === src.partner.id);
  const orgs = new Map(src.organizations.map((o) => [o.id, o]));
  const fee = commissions(own.map((l) => l.organizationId), src.partner.percentBp, src.payments, src.planPayouts);
  const clients = own
    .flatMap((l): PartnerCabinetClient[] => {
      const o = orgs.get(l.organizationId);
      if (!o) return [];
      const status = clientStatus(o, paidPlan.has(o.id), now);
      return [
        {
          organizationId: o.id,
          name: o.name,
          status,
          paid: paidPlan.has(o.id),
          trialEndsAt: status === 'TRIAL' && o.trialEndsAt ? o.trialEndsAt.slice(0, 10) : null,
          source: l.source,
          channel: l.channel,
          since: o.createdAt.slice(0, 10),
          commissionCents: String(fee.get(o.id) ?? 0n),
        },
      ];
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.since.localeCompare(a.since));
  const accrued = [...fee.values()].reduce((n, x) => n + x, 0n);
  const mine = src.payouts.filter((p) => p.partnerId === src.partner.id && !p.voided);
  const paidOut = mine.reduce((n, p) => n + p.amountCents, 0n);
  const count = (s: PartnerClientStatus) => clients.filter((c) => c.status === s).length;
  const paid = clients.filter((c) => c.paid).length;

  // рейтинг среди действующих партнёров: больше оплативших клиентов, при равенстве больше начислено
  const score = src.partners
    .filter((p) => p.active || p.id === src.partner.id)
    .map((p) => {
      const ids = src.links.filter((l) => l.partnerId === p.id).map((l) => l.organizationId);
      const pct = p.id === src.partner.id ? src.partner.percentBp : 0;
      const sum = [...commissions(ids, pct, src.payments, src.planPayouts).values()].reduce((n, x) => n + x, 0n);
      return { id: p.id, paid: ids.filter((id) => paidPlan.has(id)).length, sum };
    })
    .sort((a, b) => b.paid - a.paid || (b.sum > a.sum ? 1 : b.sum < a.sum ? -1 : 0));

  return {
    clients,
    money: { accruedCents: String(accrued), paidCents: String(paidOut), balanceCents: String(accrued > paidOut ? accrued - paidOut : 0n) },
    payouts: mine
      .sort((a, b) => b.spentOn.localeCompare(a.spentOn))
      .map((p) => ({ spentOn: p.spentOn, amountCents: String(p.amountCents), note: p.note })),
    stats: {
      clients: clients.length,
      trial: count('TRIAL'),
      paid,
      trialEnded: count('TRIAL_ENDED'),
      conversion: clients.length ? Math.floor((paid * 1000) / clients.length) : null,
    },
    rating: { place: score.findIndex((s) => s.id === src.partner.id) + 1, of: score.length },
  };
}

/** Следующий свободный Partner ID: P001, P002 … по уже выданным кодам вида P<число> */
export function nextPartnerCode(existing: readonly string[]): string {
  const max = existing.reduce((n, c) => {
    const m = /^P(\d+)$/.exec(c);
    return m ? Math.max(n, Number(m[1])) : n;
  }, 0);
  return `P${String(max + 1).padStart(3, '0')}`;
}

/** Ссылка партнёра для клиентов: `/start` кладёт код в куку и ведёт на регистрацию; приглашение партнёра своё, `/partner/join/<токен>` */
export function partnerLinks(appUrl: string, code: string): { client: string } {
  return { client: `${appUrl.replace(/\/+$/, '')}/start?p=${encodeURIComponent(code)}` };
}

/** Код из ссылки: `P` и цифры, иначе null (чужие строки в регистрации молча игнорируются) */
export function parsePartnerCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const v = input.trim().toUpperCase();
  return /^P\d{1,9}$/.test(v) ? v : null;
}

/** Метка канала из ссылки `ch`: латиница, цифры, `-` и `_`, до 30 символов, иначе null */
export function parseChannel(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const v = input.trim().toLowerCase();
  return /^[a-z0-9_-]{1,30}$/.test(v) ? v : null;
}
