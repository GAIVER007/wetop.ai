import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type {
  DeviceInfo,
  EventName,
  HitType,
  PropValue,
  SessionRow,
  SessionSource,
} from '@pms/domain';
import type { Prisma } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef } from '../database/property-ref';
import { auditUserId } from '../accounts/actor';

/** Сайт со счётчиком (DATA_MODEL §11 TrackedSite) плюс пояс объекта — для границ периода. */
/** Цепочка объекта публичного сайта (MKT1B BOOK-4): по ней сайт проверяется до любой работы с ценами и бронью */
export interface ServingChain {
  propertyOrganizationId: string | null;
  locationStatus: 'ACTIVE' | 'ARCHIVED';
  businessStatus: 'ACTIVE' | 'ARCHIVED';
  vertical: string;
  businessOrganizationId: string;
}

export interface SiteRecord {
  id: string;
  propertyId: string;
  name: string;
  hosts: string[];
  publicKey: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: Date;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  /** Виджет бронирования (срез 9) */
  bookingEnabled: boolean;
  bookingRatePlan: { id: string; code: string; name: string } | null;
  /** Организация объекта сайта: публичный путь сайта действует от её имени (план tenant-isolation п. 4); null — ничья */
  organizationId?: string | null;
}

/**
 * Область агента продавца (SA2.5): организация, филиал и объект берутся ТОЛЬКО из строки `seller_agents`. Идентификатор агента,
 * пришедший в запросе, — недоверенный селектор: по нему находится строка, а всё остальное берётся из неё.
 * Архивный агент областью не является (`null`), как и несуществующий.
 */
export interface AgentScopeRow {
  id: string;
  organizationId: string;
  locationId: string | null;
  /** Объект филиала (Property–Location 1:1); `null` — у агента нет филиала или у филиала нет объекта */
  propertyId: string | null;
  lifecycle: 'draft' | 'active' | 'paused' | 'archived';
  scenario: string;
}

export interface RatePlanOption {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

/** Событие, прошедшее разбор и проверки приёмника; ровно то, что попадает в БД. IP и UA здесь уже нет. */
export interface StoredHit {
  siteId: string;
  at: Date;
  type: HitType;
  visitorKey: string;
  sessionKey: string;
  path: string;
  title: string | null;
  source: SessionSource;
  device: DeviceInfo;
  language: string | null;
  eventName: EventName | null;
  props: Record<string, PropValue> | null;
}

export interface SiteStatus {
  lastEventAt: Date | null;
  sessionsToday: number;
  pageviewsToday: number;
}

/** Бронь с источником «Сайт» для отчёта сайта (WEB4, Q-212): статус, валюта и начисления её счетов */
export interface SiteReservationRow {
  status: string;
  currency: string;
  charges: Array<{ amountMinor: bigint; voided: boolean }>;
}

export interface AnalyticsRepository {
  sites(): Promise<SiteRecord[]>;
  site(id: string): Promise<SiteRecord | null>;
  siteByKey(publicKey: string): Promise<SiteRecord | null>;
  /** Все сайты всех объектов — только для приёмника счётчика: ключ → сайт одним запросом, без поиска на каждый ключ */
  allSites(): Promise<SiteRecord[]>;
  /**
   * Сайты бронирования организации для прежней котировки продавца без агента (Q-166, ADR-085): ACTIVE, бронь включена,
   * тариф задан, цепочка объекта действует (филиал и Business ACTIVE, Business HOSPITALITY той же организации). Отдаёт
   * не больше двух: вызывающему нужно знать только «ни одного, ровно один или неоднозначно» (MKT1B BOOK-4)
   */
  bookingSitesForOrganization(organizationId: string): Promise<SiteRecord[]>;
  /**
   * Цепочка объекта сайта: организация объекта, состояние филиала и Business, вертикаль, организация Business
   * (MKT1B BOOK-4). Читается без арендатора: чужую цепочку политика RLS спрятала бы, а отказ должен быть явным.
   * `null` — объекта нет
   */
  servingChain(propertyId: string): Promise<ServingChain | null>;
  /** Строка агента для области запроса (SA2.5); `null` — агента нет или он в архиве */
  agentScope(agentId: string): Promise<AgentScopeRow | null>;
  /** Сайт бронирования ФИЛИАЛА агента (не организации): первый ACTIVE с включённым бронированием и тарифом на его объекте */
  bookingSiteForAgent(agentId: string): Promise<SiteRecord | null>;
  /** Домены действующих сайтов филиала агента — из них вычисляется allowlist виджета; `null` — агента нет */
  hostsForAgent(agentId: string): Promise<string[] | null>;
  /** Сколько неархивных AI-продавцов у организации: прежний запрос по одной организации неоднозначен при двух */
  salesAgentCount(organizationId: string): Promise<number>;
  createSite(input: { name: string; hosts: string[]; publicKey: string }): Promise<SiteRecord>;
  updateSite(
    id: string,
    patch: {
      name?: string;
      hosts?: string[];
      status?: 'ACTIVE' | 'PAUSED';
      bookingEnabled?: boolean;
      bookingRatePlanId?: string | null;
    },
  ): Promise<SiteRecord | null>;
  deleteSite(id: string): Promise<boolean>;
  /** Пачка событий приёмника; каждое пишется отдельно, ошибка одного не роняет остальные. */
  record(hits: StoredHit[]): Promise<void>;
  sessions(siteId: string, startUtc: Date, endUtcExclusive: Date): Promise<SessionRow[]>;
  pageviews(
    siteId: string,
    startUtc: Date,
    endUtcExclusive: Date,
  ): Promise<Array<{ path: string }>>;
  /** Все события периода: имя, ключ сессии, параметры (для календаря спроса — search) */
  events(
    siteId: string,
    startUtc: Date,
    endUtcExclusive: Date,
  ): Promise<Array<{ name: string; sessionKey: string; props: unknown }>>;
  status(siteId: string, todayStartUtc: Date): Promise<SiteStatus>;
  audit(action: string, siteId: string, after: Record<string, unknown>): Promise<void>;
  /**
   * Броней с сайта с момента `since` — по журналу действий (`analytics.site.booking`), который только
   * дописывается: счёт переживает перезапуск API, в отличие от окон в памяти (С-7, ТЗ аудита 25.09.2026)
   */
  siteBookingsSince(siteId: string, since: Date): Promise<number>;
  /**
   * Брони объекта с источником «Сайт», созданные в полуинтервале (WEB4): у брони нет номера сайта, поэтому — по
   * объекту; аннулированные начисления приходят помеченными, считает их `siteReservations` домена
   */
  siteReservations(startUtc: Date, endUtcExclusive: Date): Promise<SiteReservationRow[]>;
  /** Тариф для виджета по коду (срез 9) */
  ratePlanByCode(code: string): Promise<RatePlanOption | null>;
  /** Первый активный тариф объекта по стабильной сортировке */
  defaultBookingRatePlan(): Promise<RatePlanOption | null>;
  /** Связать сессию счётчика с бронью виджета; false — сессии нет */
  linkSessionReservation(
    siteId: string,
    sessionKey: string,
    confirmationNumber: string,
  ): Promise<boolean>;
  /**
   * Хранение (план среза 8 §12): удалить сессии всех сайтов, начатые раньше `cutoff`; просмотры и события уходят
   * каскадом. Возвращает число удалённых сессий. Служебный путь — вызывает только суточная очистка API и скрипт.
   */
  deleteSessionsStartedBefore(cutoff: Date): Promise<number>;
}
export const ANALYTICS_REPOSITORY = Symbol('ANALYTICS_REPOSITORY');

const SITE_SELECT = {
  id: true,
  propertyId: true,
  name: true,
  hosts: true,
  publicKey: true,
  status: true,
  createdAt: true,
  bookingEnabled: true,
  bookingRatePlan: { select: { id: true, code: true, name: true } },
  property: {
    select: { timezone: true, checkInTime: true, checkOutTime: true, organizationId: true },
  },
} as const;

type SiteRow = {
  id: string;
  propertyId: string;
  name: string;
  hosts: string[];
  publicKey: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: Date;
  bookingEnabled: boolean;
  bookingRatePlan: { id: string; code: string; name: string } | null;
  property: {
    timezone: string;
    checkInTime: string;
    checkOutTime: string;
    organizationId: string | null;
  };
};

const toRecord = (r: SiteRow): SiteRecord => ({
  id: r.id,
  propertyId: r.propertyId,
  name: r.name,
  hosts: r.hosts,
  publicKey: r.publicKey,
  status: r.status,
  createdAt: r.createdAt,
  timezone: r.property.timezone,
  checkInTime: r.property.checkInTime,
  checkOutTime: r.property.checkOutTime,
  bookingEnabled: r.bookingEnabled,
  bookingRatePlan: r.bookingRatePlan,
  organizationId: r.property.organizationId,
});

@Injectable()
export class PrismaAnalyticsRepository implements AnalyticsRepository {
  private readonly propertyName = LUXX_APARTS_PROPERTY.name;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Сайты объекта: вошедший — объекта своей организации (ADR-061), служебный ходок — Luxx. Список, карточка, правка и
   * удаление шли по голому id, и чужая организация читала, меняла и удаляла сайт объекта вместе с его аналитикой
   * (аудит 26.09, В-3; план tenant-isolation-2026-09-26 п. 3).
   */
  private async propertyId(): Promise<string> {
    return propertyIdRef(this.prisma.db, this.propertyName);
  }

  async sites(): Promise<SiteRecord[]> {
    const rows = await this.prisma.db.trackedSite.findMany({
      where: { propertyId: await this.propertyId() },
      orderBy: { createdAt: 'asc' },
      select: SITE_SELECT,
    });
    return rows.map(toRecord);
  }
  async site(id: string): Promise<SiteRecord | null> {
    const r = await this.prisma.db.trackedSite.findFirst({
      where: { id, propertyId: await this.propertyId() },
      select: SITE_SELECT,
    });
    return r ? toRecord(r) : null;
  }
  async siteByKey(publicKey: string): Promise<SiteRecord | null> {
    const r = await this.prisma.db.trackedSite.findUnique({
      where: { publicKey },
      select: SITE_SELECT,
    });
    return r ? toRecord(r) : null;
  }
  async allSites(): Promise<SiteRecord[]> {
    const rows = await this.prisma.db.trackedSite.findMany({ select: SITE_SELECT });
    return rows.map(toRecord);
  }
  async bookingSitesForOrganization(organizationId: string): Promise<SiteRecord[]> {
    const rows = await this.prisma.db.trackedSite.findMany({
      where: {
        status: 'ACTIVE',
        bookingEnabled: true,
        bookingRatePlanId: { not: null },
        property: {
          organizationId,
          location: {
            status: 'ACTIVE',
            business: { status: 'ACTIVE', vertical: 'HOSPITALITY', organizationId },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 2,
      select: SITE_SELECT,
    });
    return rows.map(toRecord);
  }
  async servingChain(propertyId: string): Promise<ServingChain | null> {
    const p = await this.prisma.db.property.findUnique({
      where: { id: propertyId },
      select: {
        organizationId: true,
        location: {
          select: {
            status: true,
            business: { select: { status: true, vertical: true, organizationId: true } },
          },
        },
      },
    });
    if (!p) return null;
    return {
      propertyOrganizationId: p.organizationId,
      locationStatus: p.location.status,
      businessStatus: p.location.business.status,
      vertical: p.location.business.vertical,
      businessOrganizationId: p.location.business.organizationId,
    };
  }
  async agentScope(agentId: string): Promise<AgentScopeRow | null> {
    const a = await this.prisma.db.sellerAgent.findFirst({
      where: { id: agentId, lifecycle: { not: 'archived' } },
      select: {
        id: true,
        organizationId: true,
        locationId: true,
        lifecycle: true,
        scenario: true,
        location: { select: { property: { select: { id: true } } } },
      },
    });
    return a
      ? {
          id: a.id,
          organizationId: a.organizationId,
          locationId: a.locationId,
          propertyId: a.location?.property?.id ?? null,
          lifecycle: a.lifecycle as AgentScopeRow['lifecycle'],
          scenario: a.scenario,
        }
      : null;
  }
  async bookingSiteForAgent(agentId: string): Promise<SiteRecord | null> {
    const scope = await this.agentScope(agentId);
    if (!scope?.propertyId) return null;
    const r = await this.prisma.db.trackedSite.findFirst({
      where: {
        propertyId: scope.propertyId,
        status: 'ACTIVE',
        bookingEnabled: true,
        bookingRatePlanId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: SITE_SELECT,
    });
    return r ? toRecord(r) : null;
  }
  async hostsForAgent(agentId: string): Promise<string[] | null> {
    const scope = await this.agentScope(agentId);
    if (!scope) return null;
    if (!scope.propertyId) return [];
    const sites = await this.prisma.db.trackedSite.findMany({
      where: { propertyId: scope.propertyId, status: 'ACTIVE' },
      select: { hosts: true },
      orderBy: { createdAt: 'asc' },
    });
    return [...new Set(sites.flatMap((x) => x.hosts))];
  }
  async salesAgentCount(organizationId: string): Promise<number> {
    return this.prisma.db.sellerAgent.count({
      where: { organizationId, scenario: 'sales', lifecycle: { not: 'archived' } },
    });
  }
  async createSite(input: {
    name: string;
    hosts: string[];
    publicKey: string;
  }): Promise<SiteRecord> {
    const r = await this.prisma.db.trackedSite.create({
      data: { propertyId: await this.propertyId(), ...input },
      select: SITE_SELECT,
    });
    return toRecord(r);
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
    const exists = await this.prisma.db.trackedSite.findFirst({
      where: { id, propertyId: await this.propertyId() },
      select: { id: true },
    });
    if (!exists) return null;
    const r = await this.prisma.db.trackedSite.update({
      where: { id },
      data: patch,
      select: SITE_SELECT,
    });
    return toRecord(r);
  }
  async deleteSite(id: string): Promise<boolean> {
    const { count } = await this.prisma.db.trackedSite.deleteMany({
      where: { id, propertyId: await this.propertyId() },
    });
    return count > 0;
  }

  async record(hits: StoredHit[]): Promise<void> {
    for (const h of hits) {
      try {
        await this.recordOne(h);
      } catch (e) {
        // одно битое событие не должно ронять пачку; ПД в сообщении нет
        console.warn(`[analytics] событие не записано: ${(e as Error).message}`);
      }
    }
  }

  /** Сессия ключом (site_id, session_key): первый просмотр создаёт её с источником, дальше — счётчики и время. */
  private async recordOne(h: StoredHit): Promise<void> {
    const db = this.prisma.db;
    const createData = {
      siteId: h.siteId,
      visitorKey: h.visitorKey,
      sessionKey: h.sessionKey,
      startedAt: h.at,
      lastSeenAt: h.at,
      pageviews: h.type === 'pageview' ? 1 : 0,
      landingPath: h.path,
      referrerHost: h.source.referrerHost,
      sourceKind: h.source.kind,
      source: h.source.source,
      medium: h.source.medium,
      campaign: h.source.campaign,
      content: h.source.content,
      term: h.source.term,
      device: h.device.device,
      browser: h.device.browser,
      os: h.device.os,
      language: h.language,
    };
    const where = { siteId_sessionKey: { siteId: h.siteId, sessionKey: h.sessionKey } };
    if (h.type === 'ping' || h.type === 'leave') {
      // сессии нет (первый просмотр потерялся) — время считать не от чего, событие пропускаем
      const existing = await db.webSession.findUnique({ where, select: { id: true } });
      if (!existing) return;
    } else {
      const session = await db.webSession.upsert({
        where,
        create: createData,
        update: h.type === 'pageview' ? { pageviews: { increment: 1 } } : {},
        select: { id: true },
      });
      if (h.type === 'pageview') {
        await db.webPageview.create({
          data: { sessionId: session.id, at: h.at, path: h.path, title: h.title },
        });
      } else if (h.eventName) {
        await db.webEvent.create({
          data: {
            sessionId: session.id,
            at: h.at,
            name: h.eventName,
            ...(h.props ? { props: h.props as Prisma.InputJsonObject } : {}),
          },
        });
      }
    }
    // время последней активности только вперёд; длительность — от начала сессии
    await db.$executeRaw`
      UPDATE "web_sessions"
      SET "last_seen_at" = GREATEST("last_seen_at", ${h.at}::timestamptz),
          "duration_seconds" = GREATEST(0, EXTRACT(EPOCH FROM (GREATEST("last_seen_at", ${h.at}::timestamptz) - "started_at")))::int
      WHERE "site_id" = ${h.siteId}::uuid AND "session_key" = ${h.sessionKey}`;
  }

  async sessions(siteId: string, startUtc: Date, endUtcExclusive: Date): Promise<SessionRow[]> {
    return this.prisma.db.webSession.findMany({
      where: { siteId, startedAt: { gte: startUtc, lt: endUtcExclusive } },
      select: {
        visitorKey: true,
        sessionKey: true,
        startedAt: true,
        pageviews: true,
        durationSeconds: true,
        sourceKind: true,
        source: true,
        device: true,
        browser: true,
        os: true,
        language: true,
        reservationId: true,
      },
    });
  }
  async pageviews(
    siteId: string,
    startUtc: Date,
    endUtcExclusive: Date,
  ): Promise<Array<{ path: string }>> {
    return this.prisma.db.webPageview.findMany({
      where: { session: { siteId }, at: { gte: startUtc, lt: endUtcExclusive } },
      select: { path: true },
    });
  }
  async events(
    siteId: string,
    startUtc: Date,
    endUtcExclusive: Date,
  ): Promise<Array<{ name: string; sessionKey: string; props: unknown }>> {
    const rows = await this.prisma.db.webEvent.findMany({
      where: { session: { siteId }, at: { gte: startUtc, lt: endUtcExclusive } },
      select: { name: true, props: true, session: { select: { sessionKey: true } } },
    });
    return rows.map((r) => ({ name: r.name, sessionKey: r.session.sessionKey, props: r.props }));
  }
  async status(siteId: string, todayStartUtc: Date): Promise<SiteStatus> {
    const [last, today] = await Promise.all([
      this.prisma.db.webSession.findFirst({
        where: { siteId },
        orderBy: { lastSeenAt: 'desc' },
        select: { lastSeenAt: true },
      }),
      this.prisma.db.webSession.aggregate({
        where: { siteId, startedAt: { gte: todayStartUtc } },
        _count: { _all: true },
        _sum: { pageviews: true },
      }),
    ]);
    return {
      lastEventAt: last?.lastSeenAt ?? null,
      sessionsToday: today._count._all,
      pageviewsToday: today._sum.pageviews ?? 0,
    };
  }
  async audit(action: string, siteId: string, after: Record<string, unknown>): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: {
        userId: auditUserId(),
        entityType: 'TrackedSite',
        entityId: siteId,
        action,
        after: after as Prisma.InputJsonObject,
      },
    });
  }

  async siteReservations(startUtc: Date, endUtcExclusive: Date): Promise<SiteReservationRow[]> {
    const rows = await this.prisma.db.reservation.findMany({
      where: {
        propertyId: await this.propertyId(),
        source: 'WEBSITE',
        createdAt: { gte: startUtc, lt: endUtcExclusive },
      },
      select: {
        status: true,
        currency: true,
        // начисления — как у списка «Брони» (R1): действующие, по счетам проживаний брони
        items: {
          select: {
            folio: {
              select: { charges: { where: { voidedAt: null }, select: { amount: true } } },
            },
          },
        },
      },
    });
    return rows.map((r) => ({
      status: r.status,
      currency: r.currency,
      charges: r.items.flatMap((it) =>
        (it.folio?.charges ?? []).map((c) => ({ amountMinor: c.amount, voided: false })),
      ),
    }));
  }

  async siteBookingsSince(siteId: string, since: Date): Promise<number> {
    return this.prisma.db.auditLog.count({
      where: {
        entityType: 'TrackedSite',
        entityId: siteId,
        action: 'analytics.site.booking',
        createdAt: { gt: since },
      },
    });
  }

  async ratePlanByCode(code: string): Promise<RatePlanOption | null> {
    return this.prisma.db.ratePlan.findUnique({
      where: { propertyId_code: { propertyId: await this.propertyId(), code } },
      select: { id: true, code: true, name: true, active: true },
    });
  }
  async defaultBookingRatePlan(): Promise<RatePlanOption | null> {
    const select = { id: true, code: true, name: true, active: true } as const;
    // тариф своего объекта: без этого сайт чужой организации включал бронирование по тарифу Luxx
    const propertyId = await this.propertyId();
    return this.prisma.db.ratePlan.findFirst({
      where: { propertyId, active: true },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      select,
    });
  }
  async linkSessionReservation(
    siteId: string,
    sessionKey: string,
    confirmationNumber: string,
  ): Promise<boolean> {
    // бронь того же объекта, что и сайт: номер брони не уникален между объектами
    const reservation = await this.prisma.db.reservation.findFirst({
      where: { confirmationNumber, property: { trackedSites: { some: { id: siteId } } } },
      select: { id: true },
    });
    if (!reservation) return false;
    const { count } = await this.prisma.db.webSession.updateMany({
      where: { siteId, sessionKey },
      data: { reservationId: reservation.id },
    });
    return count > 0;
  }
  async deleteSessionsStartedBefore(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.db.webSession.deleteMany({
      where: { startedAt: { lt: cutoff } },
    });
    return count;
  }
}
