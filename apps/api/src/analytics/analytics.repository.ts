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
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaService } from '../database/prisma.provider';

/** Сайт со счётчиком (DATA_MODEL §11 TrackedSite) плюс пояс объекта — для границ периода. */
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

export interface AnalyticsRepository {
  sites(): Promise<SiteRecord[]>;
  site(id: string): Promise<SiteRecord | null>;
  siteByKey(publicKey: string): Promise<SiteRecord | null>;
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
  /** Тариф для виджета по коду (срез 9) */
  ratePlanByCode(code: string): Promise<RatePlanOption | null>;
  /** Тариф сайта по умолчанию: «Базовый тариф» Exely (10157482), иначе первый активный */
  defaultBookingRatePlan(): Promise<RatePlanOption | null>;
  /** Связать сессию счётчика с бронью виджета; false — сессии нет */
  linkSessionReservation(
    siteId: string,
    sessionKey: string,
    confirmationNumber: string,
  ): Promise<boolean>;
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
  property: { select: { timezone: true, checkInTime: true, checkOutTime: true } },
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
  property: { timezone: string; checkInTime: string; checkOutTime: string };
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
});

@Injectable()
export class PrismaAnalyticsRepository implements AnalyticsRepository {
  private readonly propertyName = LUXX_APARTS_PROPERTY.name;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async sites(): Promise<SiteRecord[]> {
    const rows = await this.prisma.db.trackedSite.findMany({
      orderBy: { createdAt: 'asc' },
      select: SITE_SELECT,
    });
    return rows.map(toRecord);
  }
  async site(id: string): Promise<SiteRecord | null> {
    const r = await this.prisma.db.trackedSite.findUnique({ where: { id }, select: SITE_SELECT });
    return r ? toRecord(r) : null;
  }
  async siteByKey(publicKey: string): Promise<SiteRecord | null> {
    const r = await this.prisma.db.trackedSite.findUnique({
      where: { publicKey },
      select: SITE_SELECT,
    });
    return r ? toRecord(r) : null;
  }
  async createSite(input: {
    name: string;
    hosts: string[];
    publicKey: string;
  }): Promise<SiteRecord> {
    const property = await this.prisma.db.property.findFirstOrThrow({
      where: { name: this.propertyName },
      select: { id: true },
    });
    const r = await this.prisma.db.trackedSite.create({
      data: { propertyId: property.id, ...input },
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
    const exists = await this.prisma.db.trackedSite.findUnique({
      where: { id },
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
    const { count } = await this.prisma.db.trackedSite.deleteMany({ where: { id } });
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
        entityType: 'TrackedSite',
        entityId: siteId,
        action,
        after: after as Prisma.InputJsonObject,
      },
    });
  }

  async ratePlanByCode(code: string): Promise<RatePlanOption | null> {
    const property = await this.prisma.db.property.findFirstOrThrow({
      where: { name: this.propertyName },
      select: { id: true },
    });
    return this.prisma.db.ratePlan.findUnique({
      where: { propertyId_code: { propertyId: property.id, code } },
      select: { id: true, code: true, name: true, active: true },
    });
  }
  async defaultBookingRatePlan(): Promise<RatePlanOption | null> {
    const select = { id: true, code: true, name: true, active: true } as const;
    return (
      (await this.prisma.db.ratePlan.findFirst({
        where: { active: true, exelyId: '10157482' },
        select,
      })) ??
      this.prisma.db.ratePlan.findFirst({
        where: { active: true },
        orderBy: { name: 'asc' },
        select,
      })
    );
  }
  async linkSessionReservation(
    siteId: string,
    sessionKey: string,
    confirmationNumber: string,
  ): Promise<boolean> {
    const reservation = await this.prisma.db.reservation.findFirst({
      where: { confirmationNumber },
      select: { id: true },
    });
    if (!reservation) return false;
    const { count } = await this.prisma.db.webSession.updateMany({
      where: { siteId, sessionKey },
      data: { reservationId: reservation.id },
    });
    return count > 0;
  }
}
