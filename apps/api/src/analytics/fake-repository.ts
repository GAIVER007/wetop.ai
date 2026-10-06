/**
 * Репозиторий в памяти для тестов контроллеров: два сайта (активный и на паузе), записанные события,
 * контрольные числа гейта среза 8 (план §11). В общий индекс модуля не входит.
 */
import type { SessionRow } from '@pms/domain';
import type {
  AgentScopeRow,
  AnalyticsRepository,
  RatePlanOption,
  ServingChain,
  SiteRecord,
  SiteReservationRow,
  SiteStatus,
  StoredHit,
} from './analytics.repository';

export const SITE: SiteRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  propertyId: '22222222-2222-4222-8222-222222222222',
  name: 'Тестовый сайт',
  hosts: ['test-site.local'],
  publicKey: 'pms_0123456789ab',
  status: 'ACTIVE',
  createdAt: new Date('2026-09-12T00:00:00Z'),
  timezone: 'Asia/Almaty',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  bookingEnabled: false,
  bookingRatePlan: null,
};
export const PLANS: RatePlanOption[] = [
  { id: 'p1', code: 'rate-base', name: 'Базовый тариф', active: true },
  { id: 'p2', code: 'rate-disabled', name: 'Мёртвый', active: false },
];
export const SITE_PAUSED: SiteRecord = {
  ...SITE,
  id: '33333333-3333-4333-8333-333333333333',
  name: 'На паузе',
  publicKey: 'pms_ba9876543210',
  status: 'PAUSED',
};

const row = (over: Partial<SessionRow>): SessionRow => ({
  visitorKey: 'A',
  startedAt: new Date('2026-09-12T05:00:00Z'),
  pageviews: 1,
  durationSeconds: 0,
  sourceKind: 'DIRECT',
  source: null,
  device: 'DESKTOP',
  ...over,
});

export class FakeAnalyticsRepository implements AnalyticsRepository {
  sitesById = new Map<string, SiteRecord>([
    [SITE.id, SITE],
    [SITE_PAUSED.id, SITE_PAUSED],
  ]);
  /** Чья гостиница у сайта (Q-166, ADR-085): в записи сайта организации нет, она у объекта */
  siteOrganizations = new Map<string, string>();
  /** Агенты продавца (SA2.5): область запроса берётся только из этой строки */
  agentRows = new Map<string, AgentScopeRow>();
  recorded: StoredHit[] = [];
  audits: Array<{ action: string; siteId: string; details?: Record<string, unknown> | undefined }> =
    [];
  sessionRows: SessionRow[] = [];
  pageviewRows: Array<{ path: string }> = [];
  eventRows: Array<{ name: string; sessionKey: string; props: unknown }> = [];
  /** Брони с источником «Сайт» (WEB4): задаёт тест; период запроса — `lastReservationsRange` */
  reservationRows: SiteReservationRow[] = [];
  siteStatus: SiteStatus = { lastEventAt: null, sessionsToday: 0, pageviewsToday: 0 };
  lastRange: { startUtc: string; endUtcExclusive: string } | null = null;
  lastReservationsRange: { startUtc: string; endUtcExclusive: string } | null = null;
  private seq = 0;

  seedGate(): void {
    this.sessionRows = [
      row({
        visitorKey: 'A',
        sessionKey: 'k1',
        pageviews: 2,
        durationSeconds: 40,
        browser: 'Chrome',
        os: 'macOS',
      }),
      row({
        visitorKey: 'A',
        sessionKey: 'k2',
        startedAt: new Date('2026-09-12T05:31:00Z'),
        browser: 'Chrome',
        os: 'macOS',
        durationSeconds: 5,
        sourceKind: 'SOCIAL',
        source: 'instagram',
      }),
      row({
        visitorKey: 'B',
        sessionKey: 'k3',
        startedAt: new Date('2026-09-12T18:59:30Z'),
        durationSeconds: 30,
        sourceKind: 'SEARCH',
        source: 'google',
        device: 'MOBILE',
        browser: 'Chrome',
        os: 'Android',
      }),
    ];
    this.pageviewRows = [{ path: '/' }, { path: '/rooms' }, { path: '/' }, { path: '/' }];
    this.eventRows = [
      {
        name: 'search',
        sessionKey: 'k3',
        props: { arrival: '2026-10-01', departure: '2026-10-03' },
      },
      { name: 'phone_click', sessionKey: 'k3', props: null },
      { name: 'phone_click', sessionKey: 'k1', props: null },
    ];
    this.siteStatus = {
      lastEventAt: new Date('2026-09-12T18:59:30Z'),
      sessionsToday: 3,
      pageviewsToday: 4,
    };
  }

  async sites(): Promise<SiteRecord[]> {
    return [...this.sitesById.values()];
  }
  async site(id: string): Promise<SiteRecord | null> {
    return this.sitesById.get(id) ?? null;
  }
  async bookingSitesForOrganization(organizationId: string): Promise<SiteRecord[]> {
    const found: SiteRecord[] = [];
    for (const [siteId, org] of this.siteOrganizations) {
      const site = this.sitesById.get(siteId);
      if (
        org === organizationId &&
        site &&
        site.status === 'ACTIVE' &&
        site.bookingEnabled &&
        site.bookingRatePlan
      )
        found.push(site);
    }
    return found.slice(0, 2);
  }
  /** Цепочки объектов, заданные тестом; без записи: действующая цепочка организации сайта этого объекта */
  chains = new Map<string, ServingChain | null>();
  async servingChain(propertyId: string): Promise<ServingChain | null> {
    if (this.chains.has(propertyId)) return this.chains.get(propertyId) ?? null;
    for (const site of this.sitesById.values()) {
      if (site.propertyId !== propertyId) continue;
      const org = site.organizationId ?? this.siteOrganizations.get(site.id) ?? null;
      if (!org) return null;
      return {
        propertyOrganizationId: org,
        locationStatus: 'ACTIVE',
        businessStatus: 'ACTIVE',
        vertical: 'HOSPITALITY',
        businessOrganizationId: org,
      };
    }
    return null;
  }

  async agentScope(agentId: string): Promise<AgentScopeRow | null> {
    const row = this.agentRows.get(agentId);
    return row && row.lifecycle !== 'archived' ? row : null;
  }
  async bookingSiteForAgent(agentId: string): Promise<SiteRecord | null> {
    const scope = await this.agentScope(agentId);
    if (!scope?.propertyId) return null;
    for (const site of this.sitesById.values()) {
      if (site.propertyId === scope.propertyId && site.status === 'ACTIVE' && site.bookingEnabled && site.bookingRatePlan)
        return { ...site, organizationId: scope.organizationId };
    }
    return null;
  }
  async hostsForAgent(agentId: string): Promise<string[] | null> {
    const scope = await this.agentScope(agentId);
    if (!scope) return null;
    if (!scope.propertyId) return [];
    const hosts = [...this.sitesById.values()]
      .filter((s) => s.propertyId === scope.propertyId && s.status === 'ACTIVE')
      .flatMap((s) => s.hosts);
    return [...new Set(hosts)];
  }
  async salesAgentCount(organizationId: string): Promise<number> {
    return [...this.agentRows.values()].filter(
      (a) => a.organizationId === organizationId && a.scenario === 'sales' && a.lifecycle !== 'archived',
    ).length;
  }

  async siteByKey(key: string): Promise<SiteRecord | null> {
    return [...this.sitesById.values()].find((s) => s.publicKey === key) ?? null;
  }
  async allSites(): Promise<SiteRecord[]> {
    return [...this.sitesById.values()];
  }
  async createSite(input: {
    name: string;
    hosts: string[];
    publicKey: string;
  }): Promise<SiteRecord> {
    this.seq += 1;
    const site: SiteRecord = {
      id: `44444444-4444-4444-8444-${String(this.seq).padStart(12, '0')}`,
      propertyId: SITE.propertyId,
      name: input.name,
      hosts: input.hosts,
      publicKey: input.publicKey,
      status: 'ACTIVE',
      createdAt: new Date(),
      timezone: 'Asia/Almaty',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      bookingEnabled: false,
      bookingRatePlan: null,
    };
    this.sitesById.set(site.id, site);
    return site;
  }
  async updateSite(
    id: string,
    patch: {
      name?: string;
      hosts?: string[];
      status?: 'ACTIVE' | 'PAUSED';
      bookingEnabled?: boolean;
      bookingRatePlanId?: string | null;
    },
  ): Promise<SiteRecord | null> {
    const s = this.sitesById.get(id);
    if (!s) return null;
    const { bookingRatePlanId, ...rest } = patch;
    const next: SiteRecord = { ...s, ...rest };
    if (bookingRatePlanId !== undefined) {
      const plan = PLANS.find((p) => p.id === bookingRatePlanId) ?? null;
      next.bookingRatePlan = plan ? { id: plan.id, code: plan.code, name: plan.name } : null;
    }
    this.sitesById.set(id, next);
    return next;
  }
  async deleteSite(id: string): Promise<boolean> {
    return this.sitesById.delete(id);
  }
  async record(hits: StoredHit[]): Promise<void> {
    this.recorded.push(...hits);
  }
  async sessions(_siteId: string, startUtc: Date, endUtcExclusive: Date): Promise<SessionRow[]> {
    this.lastRange = {
      startUtc: startUtc.toISOString(),
      endUtcExclusive: endUtcExclusive.toISOString(),
    };
    return this.sessionRows.filter((r) => r.startedAt >= startUtc && r.startedAt < endUtcExclusive);
  }
  async siteReservations(startUtc: Date, endUtcExclusive: Date): Promise<SiteReservationRow[]> {
    this.lastReservationsRange = {
      startUtc: startUtc.toISOString(),
      endUtcExclusive: endUtcExclusive.toISOString(),
    };
    return this.reservationRows;
  }
  async pageviews(): Promise<Array<{ path: string }>> {
    return this.pageviewRows;
  }
  async events(): Promise<Array<{ name: string; sessionKey: string; props: unknown }>> {
    return this.eventRows;
  }
  async status(): Promise<SiteStatus> {
    return this.siteStatus;
  }
  /** Подмена счёта из журнала: тест «перезапуска» задаёт число сам; null — считаем по audits */
  bookingsSince: number | null = null;
  async siteBookingsSince(siteId: string): Promise<number> {
    if (this.bookingsSince !== null) return this.bookingsSince;
    return this.audits.filter((a) => a.action === 'analytics.site.booking' && a.siteId === siteId)
      .length;
  }

  async audit(action: string, siteId: string, after?: Record<string, unknown>): Promise<void> {
    this.audits.push({ action, siteId, details: after });
  }
  async ratePlanByCode(code: string): Promise<RatePlanOption | null> {
    return PLANS.find((p) => p.code === code) ?? null;
  }
  async defaultBookingRatePlan(): Promise<RatePlanOption | null> {
    return PLANS[0] ?? null;
  }
  linked: Array<{ siteId: string; sessionKey: string; confirmationNumber: string }> = [];
  async linkSessionReservation(
    siteId: string,
    sessionKey: string,
    confirmationNumber: string,
  ): Promise<boolean> {
    // Как в базе: привязать можно только сессию, которая уже записана; иначе updateMany никого не найдёт
    if (!this.recorded.some((h) => h.siteId === siteId && h.sessionKey === sessionKey))
      return false;
    this.linked.push({ siteId, sessionKey, confirmationNumber });
    return true;
  }
  /** Границы, с которыми звали очистку: сколько раз и с какой датой API ходил в базу */
  retentionCutoffs: string[] = [];
  async deleteSessionsStartedBefore(cutoff: Date): Promise<number> {
    this.retentionCutoffs.push(cutoff.toISOString());
    const before = this.sessionRows.length;
    this.sessionRows = this.sessionRows.filter((r) => r.startedAt >= cutoff);
    return before - this.sessionRows.length;
  }
}
