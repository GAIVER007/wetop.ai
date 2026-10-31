import type { BusinessVertical, OrganizationStatus } from '@pms/domain';

/**
 * Кабинет компании WETOP (владелец 28.10.2026, вариант «Г»): главная главного администратора. WETOP это компания,
 * организации на платформе её клиенты. Срез 1 считается только из того, что уже есть в базе: организации,
 * их бизнесы, филиалы, люди и входы, а ещё сколько броней и записей клиент внёс за 30 дней. Денег здесь нет:
 * подписки, оплаты и расходы компании придут срезом 2 вместе со своими таблицами (Q-PA-2). Брони, гости и
 * выручка самих клиентов сюда не попадают: только счёт строк, по нему видно, работает ли клиент.
 */
export interface CabinetSource {
  organizations: Array<{
    id: string;
    name: string;
    status: OrganizationStatus;
    trialEndsAt: Date | null;
    createdAt: Date;
    verticals: BusinessVertical[];
    locations: number;
    members: Array<{ email: string; owner: boolean; lastLoginAt: Date | null }>;
    /** Город первого объекта клиента (реквизиты), если указан */
    city?: string | null;
  }>;
  /** Подписка клиента: название тарифа и «оплачено до» (следующий платёж) */
  subscriptions?: Array<{ organizationId: string; planName: string | null; paidUntil: string | null }>;
  /** Чей клиент: имя партнёра */
  partners?: Array<{ organizationId: string; partnerName: string }>;
  /** Броней, записей и броней столов, внесённых за 30 дней, по организации */
  records30d: Array<{ organizationId: string; count: number }>;
  /** Своя организация главного администратора: она не клиент и в кабинет не попадает */
  ownOrganizationId: string | null;
}

export interface CabinetClient {
  id: string;
  name: string;
  status: OrganizationStatus;
  verticals: BusinessVertical[];
  locations: number;
  members: number;
  owner: string | null;
  since: string;
  lastLoginAt: string | null;
  records30d: number;
  /** Пробный период: сколько дней осталось (0, если кончился); у остальных null */
  trialDaysLeft: number | null;
  city: string | null;
  plan: string | null;
  nextPaymentOn: string | null;
  partner: string | null;
}

export interface CabinetView {
  totals: { clients: number; people: number; activePeople7d: number };
  /** Путь клиента: регистрации за 30 дней, работают (входили за 7 дней), пробный, платят, ушли */
  funnel: { registered30d: number; working: number; trial: number; paying: number; left: number };
  clients: CabinetClient[];
  /** Сроки: кончается пробный период или нужна оплата, ближайшие первыми */
  deadlines: Array<{ id: string; name: string; kind: 'trial' | 'unpaid'; daysLeft: number | null; date: string | null }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function trialDaysLeft(trialEndsAt: Date | null, now: Date): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS));
}

export function buildCabinet(src: CabinetSource, now: Date): CabinetView {
  const records = new Map(src.records30d.map((r) => [r.organizationId, r.count]));
  const orgs = src.organizations.filter((o) => o.id !== src.ownOrganizationId);
  const since30 = now.getTime() - 30 * DAY_MS;
  const since7 = now.getTime() - 7 * DAY_MS;
  const lastLogin = (o: CabinetSource['organizations'][number]) =>
    o.members.reduce<Date | null>(
      (best, m) => (m.lastLoginAt && (!best || m.lastLoginAt > best) ? m.lastLoginAt : best),
      null,
    );
  const live = orgs.filter((o) => o.status !== 'SUSPENDED');
  const subs = new Map((src.subscriptions ?? []).map((s) => [s.organizationId, s]));
  const partners = new Map((src.partners ?? []).map((p) => [p.organizationId, p.partnerName]));

  const clients: CabinetClient[] = live
    .map((o) => {
      const last = lastLogin(o);
      return {
        id: o.id,
        name: o.name,
        status: o.status,
        verticals: o.verticals,
        locations: o.locations,
        members: o.members.length,
        owner: o.members.find((m) => m.owner)?.email ?? null,
        since: o.createdAt.toISOString(),
        lastLoginAt: last?.toISOString() ?? null,
        records30d: records.get(o.id) ?? 0,
        trialDaysLeft: o.status === 'TRIAL' ? trialDaysLeft(o.trialEndsAt, now) : null,
        city: o.city ?? null,
        plan: subs.get(o.id)?.planName ?? null,
        nextPaymentOn: subs.get(o.id)?.paidUntil ?? null,
        partner: partners.get(o.id) ?? null,
      };
    })
    // кто работает, выше: свежий вход первым, без входов в конце
    .sort((a, b) => (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? '') || a.name.localeCompare(b.name));

  const deadlines: CabinetView['deadlines'] = [
    ...live
      .filter((o) => o.status === 'TRIAL')
      .map((o) => ({
        id: o.id,
        name: o.name,
        kind: 'trial' as const,
        daysLeft: trialDaysLeft(o.trialEndsAt, now),
        date: o.trialEndsAt?.toISOString() ?? null,
      })),
    ...live
      .filter((o) => o.status === 'READ_ONLY')
      .map((o) => ({ id: o.id, name: o.name, kind: 'unpaid' as const, daysLeft: 0, date: null })),
  ].sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.name.localeCompare(b.name));

  const people = live.flatMap((o) => o.members);
  return {
    totals: {
      clients: live.length,
      people: people.length,
      activePeople7d: people.filter((m) => m.lastLoginAt && m.lastLoginAt.getTime() >= since7).length,
    },
    funnel: {
      registered30d: orgs.filter((o) => o.createdAt.getTime() >= since30).length,
      working: live.filter((o) => (lastLogin(o)?.getTime() ?? 0) >= since7).length,
      trial: live.filter((o) => o.status === 'TRIAL').length,
      paying: live.filter((o) => o.status === 'ACTIVE').length,
      left: orgs.filter((o) => o.status === 'SUSPENDED' || o.status === 'READ_ONLY').length,
    },
    clients,
    deadlines,
  };
}
