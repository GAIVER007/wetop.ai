import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  beautyBookFingerprint,
  bookingRuleViolation,
  canWrite,
  DEFAULT_BOOKING_RULES,
  foodEnd,
  foodLocal,
  foodReserveFingerprint,
  freeBeautySlots,
  hostMatches,
  parseBeautyBookRequest,
  parseBeautySlotsQuery,
  parseFoodReserveRequest,
  parseSiteLeadRequest,
  siteLeadFingerprint,
  timeOffWindow,
  type BeautyBookRequest,
  type FoodReserveRequest,
  type SiteLeadRequest,
} from '@pms/domain';
import { isOverlapViolation, type DbTx, type Prisma } from '@pms/database';
import { freeTextForStorage } from '@pms/shared';
import { AttemptWindows, visitorKey } from '../auth/attempt-limits';
import { withOrganizationScope } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { ANALYTICS_REPOSITORY, type AnalyticsRepository, type SiteRecord } from '../analytics/analytics.repository';
import {
  BUSY,
  clockOf,
  employeeBusy,
  planBeautyAppointment,
} from '../beauty/appointments';
import { findOrCreateCustomer } from '../customers/identity';
import { TurnstileService, turnstileFailureError } from '../web-booking/turnstile';
import type { RequestContext } from '../web-booking/web-booking.service';

/**
 * Формы управляемого сайта салона и ресторана и заявка «Перезвоните мне» (SITE-4, SITE-5; ADR-185, план
 * `plans/site-seo-flow-2026-10-15.md` §2, контракты `docs/marketing/site-forms-v0.md`). Повторяет порядок `/w/book`:
 * сайт по публичному ключу и домену, ранний точный повтор по ключу запроса (без Turnstile и лимита), лимит адреса,
 * Turnstile, лимит сайта (в памяти и по базе), запись. Филиал, организация и направление берутся из строки сайта,
 * никогда из запроса. Запись идёт от имени организации сайта (`withOrganizationScope`, RLS), автора-человека нет.
 *
 * Правила те же, что у стойки: окна и запись к мастеру по графику и занятости мастера (`planBeautyAppointment`,
 * `employeeBusy`), клиент по телефону (`findOrCreateCustomer`), бронь стола по периодам обслуживания и правилам брони
 * филиала (§43). Запись идёт под замком строки филиала, как у стойки: стойка и сайт одного филиала пишут по очереди.
 */

export const SITE_FORM_RATE_LIMITS = {
  /** Записей, броней и заявок с одного адреса в час */
  perIpPerHour: 5,
  /** На сайт в час (в памяти и по базе) */
  perSitePerHour: 30,
  /** Запросов свободных окон с одного адреса в минуту */
  slotsPerIpPerMinute: 60,
} as const;
const HOUR_MS = 3_600_000;

const NOT_SERVED = 'запись с сайта для этого филиала не подключена';
const SITE_NOT_FOUND = 'сайт не найден или выключен';

type FormKind = 'beauty' | 'food' | 'lead';

/** Сайт формы с проверенной цепочкой: филиал и бизнес действуют, организация бизнеса та же, что у сайта */
export interface FormSite {
  site: SiteRecord;
  organizationId: string;
  businessId: string;
  locationId: string;
  locationName: string;
  vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
  timezone: string;
  currency: string;
}

export interface BeautySlotsResult {
  date: string;
  timezone: string;
  service: { id: string; name: string; durationMinutes: number; priceMinor: string; currency: string };
  employees: Array<{ id: string; name: string }>;
  slots: Array<{ startsAt: string; endsAt: string; time: string; employeeIds: string[] }>;
}

export interface BeautyBookResult {
  appointmentId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  service: { id: string; name: string };
  employee: { id: string; name: string };
  priceMinor: string;
  currency: string;
}

export interface FoodReserveResult {
  reservationId: string;
  status: string;
  date: string;
  time: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
}

export interface SiteLeadResult {
  leadId: string;
  status: 'NEW';
  createdAt: string;
}

const newLimits = () => ({
  perIp: new AttemptWindows(SITE_FORM_RATE_LIMITS.perIpPerHour, HOUR_MS),
  perSite: new AttemptWindows(SITE_FORM_RATE_LIMITS.perSitePerHour, HOUR_MS),
  slotsPerIp: new AttemptWindows(SITE_FORM_RATE_LIMITS.slotsPerIpPerMinute, 60_000),
});

const isUnique = (e: unknown) => (e as { code?: unknown })?.code === 'P2002';
/** Ключ создания записи и брони стола с сайта: свой у каждого сайта, с ключами стойки не пересекается */
const creationKeyOf = (siteId: string, requestKey: string) => `site:${siteId}:${requestKey}`;

@Injectable()
export class SiteFormsService {
  private limits = newLimits();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ANALYTICS_REPOSITORY) private readonly sites: AnalyticsRepository,
    @Optional() @Inject(TurnstileService) private readonly turnstile: TurnstileService = new TurnstileService(),
  ) {}

  /** Для тестов */
  resetLimits(): void {
    this.limits = newLimits();
  }

  // ───────────── салон: свободные окна ─────────────

  async beautySlots(raw: unknown, ctx: RequestContext): Promise<BeautySlotsResult> {
    const now = ctx.now ?? new Date();
    if (ctx.ip && !this.limits.slotsPerIp.allow(visitorKey(ctx.ip), now.getTime()))
      throw new HttpException('слишком много запросов, попробуйте через минуту', HttpStatus.TOO_MANY_REQUESTS);
    const parsed = parseBeautySlotsQuery(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const q = parsed.value;
    const fs = await this.formSite(q.siteKey, ctx, 'beauty');
    return withOrganizationScope(fs.organizationId, async () => {
      const db = this.prisma.db;
      const service = await db.beautyService.findFirst({
        where: { id: q.serviceId, businessId: fs.businessId, active: true },
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          durationMinutes: true,
          locations: { where: { locationId: fs.locationId }, select: { enabled: true, priceOverride: true, durationOverride: true } },
        },
      });
      const own = service?.locations[0] ?? null;
      if (!service || !own?.enabled) throw new NotFoundException('Услуга в этом филиале не оказывается');
      const masterPrice = q.employeeId ? await db.employeeServicePrice.findUnique({
        where: { employeeId_serviceId_locationId: { employeeId: q.employeeId, serviceId: service.id, locationId: fs.locationId } },
      }) : null;
      if (masterPrice && masterPrice.currency !== fs.currency)
        throw new ConflictException('Валюта цены мастера не совпадает с валютой филиала');
      if (masterPrice?.priceType === 'RANGE' || masterPrice?.priceType === 'UNFIXED')
        throw new ConflictException('Укажите конечную цену услуги мастера');
      const priceMinor = masterPrice
        ? masterPrice.priceType === 'FREE' ? 0n : masterPrice.priceMinMinor
        : own.priceOverride ?? (service.currency === fs.currency ? service.price : null);
      if (priceMinor === null) throw new NotFoundException('Услуга в этом филиале не оказывается');
      const durationMinutes = masterPrice?.durationMinutes ?? own.durationOverride ?? service.durationMinutes;
      const window = timeOffWindow({ dateFrom: q.date, dateTo: q.date, timezone: fs.timezone });
      const masters = await db.employee.findMany({
        where: {
          businessId: fs.businessId,
          status: 'ACTIVE',
          locations: { some: { locationId: fs.locationId } },
          services: { some: { serviceId: service.id } },
          ...(q.employeeId ? { id: q.employeeId } : {}),
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          workingHours: { where: { locationId: fs.locationId }, select: { weekday: true, timeFrom: true, timeTo: true } },
          timeOffs: { select: { dateFrom: true, dateTo: true } },
          appointmentLines: {
            where: {
              appointment: { status: { in: BUSY } },
              // запись мастера в любом филиале занимает его время; окно суток с запасом в длительность
              startsAt: { lt: new Date(window.toUtcExclusive.getTime() + durationMinutes * 60_000) },
              endsAt: { gt: new Date(window.fromUtc.getTime() - durationMinutes * 60_000) },
            },
            select: { startsAt: true, endsAt: true },
          },
        },
      });
      if (q.employeeId && masters.length === 0) throw new NotFoundException('Мастер в этом филиале эту услугу не оказывает');
      const slots = freeBeautySlots({
        date: q.date,
        timezone: fs.timezone,
        durationMinutes,
        now,
        masters: masters.map((m) => ({
          id: m.id,
          workingHours: m.workingHours.map((h) => ({ weekday: h.weekday, timeFrom: clockOf(h.timeFrom), timeTo: clockOf(h.timeTo) })),
          timeOffs: m.timeOffs.map((t) => ({ dateFrom: t.dateFrom.toISOString().slice(0, 10), dateTo: t.dateTo.toISOString().slice(0, 10) })),
          busy: m.appointmentLines,
        })),
      });
      return {
        date: q.date,
        timezone: fs.timezone,
        service: {
          id: service.id,
          name: service.name,
          durationMinutes,
          priceMinor: priceMinor.toString(),
          currency: fs.currency,
        },
        employees: masters.map((m) => ({ id: m.id, name: m.name })),
        slots: slots.map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), time: s.time, employeeIds: s.employeeIds })),
      };
    });
  }

  // ───────────── салон: запись ─────────────

  async beautyBook(raw: unknown, ctx: RequestContext): Promise<BeautyBookResult> {
    const now = ctx.now ?? new Date();
    const parsed = parseBeautyBookRequest(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const req = parsed.value;
    const fs = await this.formSite(req.siteKey, ctx, 'beauty');
    const key = creationKeyOf(fs.site.id, req.requestKey);
    const fingerprint = beautyBookFingerprint(req);
    const earlier = await withOrganizationScope(fs.organizationId, () => this.appointmentReplay(this.prisma.db, fs, key, fingerprint));
    if (earlier) return earlier;
    if (req.startsAt.getTime() <= now.getTime()) throw new ConflictException('Это время уже прошло');
    const slot = await this.admit(fs, raw, ctx, now, 'beauty');
    try {
      const result = await withOrganizationScope(fs.organizationId, () => this.writeAppointment(fs, req, key, fingerprint));
      if (result.replayed) this.release(fs, ctx, slot);
      return result.value;
    } catch (e) {
      this.release(fs, ctx, slot);
      throw e;
    }
  }

  private async writeAppointment(
    fs: FormSite,
    req: BeautyBookRequest,
    key: string,
    fingerprint: string,
  ): Promise<{ value: BeautyBookResult; replayed: boolean }> {
    try {
      return await this.prisma.db.$transaction(
        async (tx) => {
          await this.lockChain(tx, fs);
          // повтор под замком: близнец мог записать между ранней проверкой и замком
          const twin = await this.appointmentReplay(tx, fs, key, fingerprint);
          if (twin) return { value: twin, replayed: true };
          const scope = {
            businessId: fs.businessId,
            locationId: fs.locationId,
            locationTimezone: fs.timezone,
            locationCurrency: fs.currency,
          };
          const employeeId = req.employeeId ?? (await this.freeEmployee(tx, fs, req));
          const plan = await planBeautyAppointment(tx, scope, employeeId, req.serviceId, req.startsAt);
          if (await employeeBusy(tx, employeeId, plan.startsAt, plan.endsAt, null))
            throw new ConflictException('Это время уже занято, выберите другое');
          const { id: customerId } = await findOrCreateCustomer(
            tx,
            fs.organizationId,
            { firstName: req.name, lastName: null, phone: req.phone },
            'Запись по этому телефону недоступна, позвоните нам',
          );
          await tx.customerBusiness.createMany({ data: [{ customerId, businessId: fs.businessId }], skipDuplicates: true });
          const created = await tx.appointment.create({
            data: {
              locationId: fs.locationId,
              customerId,
              employeeId,
              serviceId: req.serviceId,
              startsAt: plan.startsAt,
              endsAt: plan.endsAt,
              price: plan.priceMinor,
              currency: plan.currency,
              notes: this.notes(fs, req.comment),
              source: 'WEBSITE',
              creationKey: key,
              creationFingerprint: fingerprint,
              createdById: null,
            },
            select: { id: true },
          });
          await tx.auditLog.create({
            data: {
              organizationId: fs.organizationId,
              userId: null,
              entityType: 'appointment',
              entityId: created.id,
              action: 'beauty.appointment.created',
              after: {
                locationId: fs.locationId,
                employeeId,
                serviceId: req.serviceId,
                startsAt: plan.startsAt.toISOString(),
                endsAt: plan.endsAt.toISOString(),
                priceMinor: plan.priceMinor.toString(),
                currency: plan.currency,
                source: 'WEBSITE',
                trackedSiteId: fs.site.id,
              },
            },
          });
          const value = await this.appointmentReplay(tx, fs, key, fingerprint);
          return { value: value!, replayed: false };
        },
        { maxWait: 5000, timeout: 10000 },
      );
    } catch (e) {
      if (isOverlapViolation(e)) throw new ConflictException('Это время уже занято, выберите другое');
      if (isUnique(e)) {
        const twin = await this.appointmentReplay(this.prisma.db, fs, key, fingerprint);
        if (twin) return { value: twin, replayed: true };
        throw new ConflictException('Запрос уже обрабатывается, повторите через несколько секунд');
      }
      throw e;
    }
  }

  /** «Любой мастер»: первый по имени, кто оказывает услугу в филиале, работает в это время и свободен */
  private async freeEmployee(tx: DbTx, fs: FormSite, req: BeautyBookRequest): Promise<string> {
    const candidates = await tx.employee.findMany({
      where: {
        businessId: fs.businessId,
        status: 'ACTIVE',
        locations: { some: { locationId: fs.locationId } },
        services: { some: { serviceId: req.serviceId } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const scope = { businessId: fs.businessId, locationId: fs.locationId, locationTimezone: fs.timezone, locationCurrency: fs.currency };
    let reason: string | null = null;
    for (const c of candidates) {
      try {
        const plan = await planBeautyAppointment(tx, scope, c.id, req.serviceId, req.startsAt);
        if (!(await employeeBusy(tx, c.id, plan.startsAt, plan.endsAt, null))) return c.id;
        reason = 'Это время уже занято, выберите другое';
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        reason ??= e.message;
      }
    }
    if (!candidates.length) throw new NotFoundException('Услуга в этом филиале не оказывается');
    throw new ConflictException(reason ?? 'Это время уже занято, выберите другое');
  }

  private async appointmentReplay(
    db: Pick<DbTx, 'appointment'>,
    fs: FormSite,
    key: string,
    fingerprint: string,
  ): Promise<BeautyBookResult | null> {
    const row = await db.appointment.findUnique({
      where: { locationId_creationKey: { locationId: fs.locationId, creationKey: key } },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        price: true,
        currency: true,
        creationFingerprint: true,
        service: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
      },
    });
    if (!row) return null;
    if (row.creationFingerprint !== fingerprint) throw new ConflictException('Ключ запроса уже использован для другой записи');
    return {
      appointmentId: row.id,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      service: row.service,
      employee: row.employee,
      priceMinor: row.price.toString(),
      currency: row.currency,
    };
  }

  // ───────────── ресторан: бронь стола ─────────────

  async foodReserve(raw: unknown, ctx: RequestContext): Promise<FoodReserveResult> {
    const now = ctx.now ?? new Date();
    const parsed = parseFoodReserveRequest(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const req = parsed.value;
    const fs = await this.formSite(req.siteKey, ctx, 'food');
    const startsAt = localInstant(req.date, req.time, fs.timezone);
    if (!startsAt) throw new BadRequestException('такого времени в этот день нет (перевод часов)');
    const key = creationKeyOf(fs.site.id, req.requestKey);
    const fingerprint = foodReserveFingerprint(req);
    const earlier = await withOrganizationScope(fs.organizationId, () => this.reservationReplay(this.prisma.db, fs, key, fingerprint));
    if (earlier) return earlier;
    if (startsAt.getTime() <= now.getTime()) throw new ConflictException('Это время уже прошло');
    const slot = await this.admit(fs, raw, ctx, now, 'food');
    try {
      const result = await withOrganizationScope(fs.organizationId, () =>
        this.writeReservation(fs, req, startsAt, key, fingerprint, now),
      );
      if (result.replayed) this.release(fs, ctx, slot);
      return result.value;
    } catch (e) {
      this.release(fs, ctx, slot);
      throw e;
    }
  }

  private async writeReservation(
    fs: FormSite,
    req: FoodReserveRequest,
    startsAt: Date,
    key: string,
    fingerprint: string,
    now: Date,
  ): Promise<{ value: FoodReserveResult; replayed: boolean }> {
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        await this.lockChain(tx, fs);
        const twin = await this.reservationReplay(tx, fs, key, fingerprint);
        if (twin) return { value: twin, replayed: true };
        // период обслуживания, в который бронь помещается целиком (тот же расчёт конца, что у стойки)
        const periods = await tx.servicePeriod.findMany({
          where: { locationId: fs.locationId, active: true },
          orderBy: [{ timeFrom: 'asc' }, { id: 'asc' }],
        });
        let period: { id: string; endsAt: Date } | null = null;
        for (const p of periods) {
          try {
            const endsAt = foodEnd(
              { ...p, timeFrom: clockOf(p.timeFrom), timeTo: clockOf(p.timeTo) },
              startsAt.toISOString(),
              fs.timezone,
            );
            period = { id: p.id, endsAt };
            break;
          } catch {
            // не этот период
          }
        }
        if (!period) throw new ConflictException('В это время ресторан не принимает брони');
        // правила брони филиала (§43): закрытый день, горизонт, предел гостей
        const day = foodLocal(startsAt, fs.timezone).date;
        const [rulesRow, closed] = await Promise.all([
          tx.foodBookingRules.findUnique({ where: { locationId: fs.locationId } }),
          tx.foodClosedDay.findUnique({
            where: { locationId_day: { locationId: fs.locationId, day: new Date(`${day}T00:00:00Z`) } },
          }),
        ]);
        const violation = bookingRuleViolation({
          day,
          today: foodLocal(now, fs.timezone).date,
          partySize: req.partySize,
          rules: rulesRow
            ? { bufferMinutes: rulesRow.bufferMinutes, horizonDays: rulesRow.horizonDays, maxPartySize: rulesRow.maxPartySize }
            : DEFAULT_BOOKING_RULES,
          closed: closed !== null,
        });
        if (violation) throw new ConflictException(violation);
        const { id: customerId } = await findOrCreateCustomer(
          tx,
          fs.organizationId,
          { firstName: req.name, lastName: null, phone: req.phone },
          'Бронь по этому телефону недоступна, позвоните нам',
        );
        await tx.customerBusiness.createMany({ data: [{ customerId, businessId: fs.businessId }], skipDuplicates: true });
        const r = await tx.restaurantReservation.create({
          data: {
            locationId: fs.locationId,
            customerId,
            servicePeriodId: period.id,
            startsAt,
            endsAt: period.endsAt,
            partySize: req.partySize,
            status: 'BOOKED',
            source: 'WEBSITE',
            notes: this.notes(fs, req.comment),
            creationKey: key,
            creationFingerprint: fingerprint,
            createdById: null,
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            organizationId: fs.organizationId,
            userId: null,
            entityType: 'restaurant_reservation',
            entityId: r.id,
            action: 'food.reservation.created',
            after: {
              locationId: fs.locationId,
              customerId,
              servicePeriodId: period.id,
              startsAt: startsAt.toISOString(),
              endsAt: period.endsAt.toISOString(),
              partySize: req.partySize,
              status: 'BOOKED',
              source: 'WEBSITE',
              trackedSiteId: fs.site.id,
            },
          },
        });
        const value = await this.reservationReplay(tx, fs, key, fingerprint);
        return { value: value!, replayed: false };
      });
    } catch (e) {
      if (isUnique(e)) {
        const twin = await this.reservationReplay(this.prisma.db, fs, key, fingerprint);
        if (twin) return { value: twin, replayed: true };
        throw new ConflictException('Запрос уже обрабатывается, повторите через несколько секунд');
      }
      throw e;
    }
  }

  private async reservationReplay(
    db: Pick<DbTx, 'restaurantReservation'>,
    fs: FormSite,
    key: string,
    fingerprint: string,
  ): Promise<FoodReserveResult | null> {
    const row = await db.restaurantReservation.findUnique({
      where: { locationId_creationKey: { locationId: fs.locationId, creationKey: key } },
      select: { id: true, status: true, startsAt: true, endsAt: true, partySize: true, creationFingerprint: true },
    });
    if (!row) return null;
    if (row.creationFingerprint !== fingerprint) throw new ConflictException('Ключ запроса уже использован для другой брони');
    const local = localClock(row.startsAt, fs.timezone);
    return {
      reservationId: row.id,
      status: row.status,
      date: local.date,
      time: local.time,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      partySize: row.partySize,
    };
  }

  // ───────────── заявка без слота ─────────────

  async lead(raw: unknown, ctx: RequestContext): Promise<SiteLeadResult> {
    const now = ctx.now ?? new Date();
    const parsed = parseSiteLeadRequest(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const req = parsed.value;
    const fs = await this.formSite(req.siteKey, ctx, 'lead');
    const fingerprint = siteLeadFingerprint(req);
    const earlier = await withOrganizationScope(fs.organizationId, () => this.leadReplay(fs, req.requestKey, fingerprint));
    if (earlier) return earlier;
    const slot = await this.admit(fs, raw, ctx, now, 'lead');
    try {
      const created = await withOrganizationScope(fs.organizationId, () => this.writeLead(fs, req, fingerprint));
      if (created.replayed) this.release(fs, ctx, slot);
      return created.value;
    } catch (e) {
      this.release(fs, ctx, slot);
      throw e;
    }
  }

  private async writeLead(
    fs: FormSite,
    req: SiteLeadRequest,
    fingerprint: string,
  ): Promise<{ value: SiteLeadResult; replayed: boolean }> {
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const lead = await tx.siteLead.create({
          data: {
            organizationId: fs.organizationId,
            locationId: fs.locationId,
            trackedSiteId: fs.site.id,
            name: req.name,
            phone: req.phone,
            comment: freeTextForStorage(req.comment),
            kind: req.kind,
            requestKey: req.requestKey,
            requestFingerprint: fingerprint,
            ...(req.source ? { source: req.source as Prisma.InputJsonObject } : {}),
          },
          select: { id: true, createdAt: true },
        });
        await tx.auditLog.create({
          data: {
            organizationId: fs.organizationId,
            userId: null,
            entityType: 'site_lead',
            entityId: lead.id,
            action: 'site.lead.created',
            // телефона и имени в журнале нет: только факт и откуда
            after: { locationId: fs.locationId, trackedSiteId: fs.site.id, kind: req.kind },
          },
        });
        return { value: { leadId: lead.id, status: 'NEW' as const, createdAt: lead.createdAt.toISOString() }, replayed: false };
      });
    } catch (e) {
      if (isUnique(e)) {
        const twin = await this.leadReplay(fs, req.requestKey, fingerprint);
        if (twin) return { value: twin, replayed: true };
      }
      throw e;
    }
  }

  private async leadReplay(fs: FormSite, requestKey: string, fingerprint: string): Promise<SiteLeadResult | null> {
    const row = await this.prisma.db.siteLead.findUnique({
      where: { trackedSiteId_requestKey: { trackedSiteId: fs.site.id, requestKey } },
      select: { id: true, createdAt: true, requestFingerprint: true },
    });
    if (!row) return null;
    if (row.requestFingerprint !== fingerprint) throw new ConflictException('Ключ запроса уже использован для другой заявки');
    return { leadId: row.id, status: 'NEW', createdAt: row.createdAt.toISOString() };
  }

  // ───────────── общее ─────────────

  /**
   * Сайт по ключу и домену и его цепочка. Сайт `ACTIVE`; запрос с домена сайта или со страницы API; филиал и бизнес
   * `ACTIVE`, организация бизнеса совпадает с организацией сайта, организация может писать. Запись к мастеру только у
   * салона, бронь стола только у ресторана; заявку принимает сайт любого направления. Цепочка читается без арендатора:
   * чужую политика RLS спрятала бы, а отказ должен быть явным и одинаковым.
   */
  private async formSite(key: string, ctx: RequestContext, kind: FormKind): Promise<FormSite> {
    const site = await this.sites.siteByKey(key);
    if (!site || site.status !== 'ACTIVE') throw new NotFoundException(SITE_NOT_FOUND);
    const fromOwnPage = !!ctx.originHost && !!ctx.ownHost && ctx.originHost === ctx.ownHost;
    if (!fromOwnPage && !hostMatches(site.hosts, ctx.originHost)) throw new ForbiddenException('запрос не с домена сайта');
    const chain = await this.prisma.db.location.findUnique({
      where: { id: site.locationId },
      select: {
        id: true,
        name: true,
        status: true,
        timezone: true,
        currency: true,
        business: {
          select: {
            id: true,
            status: true,
            vertical: true,
            organizationId: true,
            organization: { select: { status: true, trialEndsAt: true } },
          },
        },
      },
    });
    const vertical = chain?.business.vertical;
    const wanted = kind === 'beauty' ? 'BEAUTY' : kind === 'food' ? 'FOOD_SERVICE' : null;
    if (
      !chain ||
      chain.status !== 'ACTIVE' ||
      chain.business.status !== 'ACTIVE' ||
      !site.organizationId ||
      site.organizationId !== chain.business.organizationId ||
      (wanted !== null && vertical !== wanted) ||
      !canWrite(chain.business.organization.status, chain.business.organization.trialEndsAt, ctx.now ?? new Date())
    )
      throw new NotFoundException(NOT_SERVED);
    return {
      site,
      organizationId: chain.business.organizationId,
      businessId: chain.business.id,
      locationId: chain.id,
      locationName: chain.name,
      vertical: vertical as FormSite['vertical'],
      timezone: chain.timezone,
      currency: chain.currency,
    };
  }

  /**
   * Лимит адреса, Turnstile, лимит сайта (в памяти и по базе), как у `/w/book`: токен проверяется после разбора формы и
   * раннего повтора, но до места в лимите сайта; отказ проверки лимит сайта не тратит. Возвращает метку места.
   */
  private async admit(fs: FormSite, raw: unknown, ctx: RequestContext, now: Date, kind: FormKind): Promise<number> {
    const at = now.getTime();
    if (ctx.ip && !this.limits.perIp.allow(visitorKey(ctx.ip), at))
      throw new HttpException('слишком много заявок с одного адреса, попробуйте позже', HttpStatus.TOO_MANY_REQUESTS);
    if (this.turnstile.enabled()) {
      const verdict = await this.turnstile.verify((raw as { turnstileToken?: unknown } | null)?.turnstileToken, {
        ip: ctx.ip,
        allowedHosts: fs.site.hosts,
        ownHost: ctx.ownHost,
      });
      // как у `/w/book`: проваленная проверка место в лимите адреса не возвращает
      if (!verdict.ok) throw turnstileFailureError(verdict.reason);
    }
    if (!this.limits.perSite.allow(fs.site.id, at))
      throw new HttpException('слишком много заявок за час, попробуйте позже', HttpStatus.TOO_MANY_REQUESTS);
    // стойкий предел за час по самим записям: окна в памяти обнуляет перезапуск API
    const since = new Date(at - HOUR_MS);
    const lastHour = await this.createdSince(fs, kind, since);
    if (lastHour >= SITE_FORM_RATE_LIMITS.perSitePerHour) {
      this.limits.perSite.release(fs.site.id, at);
      throw new HttpException('слишком много заявок за час, попробуйте позже', HttpStatus.TOO_MANY_REQUESTS);
    }
    return at;
  }

  private release(fs: FormSite, ctx: RequestContext, at: number): void {
    this.limits.perSite.release(fs.site.id, at);
    if (ctx.ip) this.limits.perIp.release(visitorKey(ctx.ip), at);
  }

  private createdSince(fs: FormSite, kind: FormKind, since: Date): Promise<number> {
    const db = this.prisma.db;
    const prefix = `site:${fs.site.id}:`;
    if (kind === 'beauty')
      return db.appointment.count({
        where: { locationId: fs.locationId, source: 'WEBSITE', creationKey: { startsWith: prefix }, createdAt: { gt: since } },
      });
    if (kind === 'food')
      return db.restaurantReservation.count({
        where: { locationId: fs.locationId, source: 'WEBSITE', creationKey: { startsWith: prefix }, createdAt: { gt: since } },
      });
    return db.siteLead.count({ where: { trackedSiteId: fs.site.id, createdAt: { gt: since } } });
  }

  /** Замки как у стойки: организация и бизнес `FOR SHARE`, филиал `FOR UPDATE`; запись стойки и сайта по очереди */
  private async lockChain(tx: DbTx, fs: FormSite): Promise<void> {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${fs.organizationId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${fs.businessId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM locations WHERE id = ${fs.locationId}::uuid FOR UPDATE`;
    const location = await tx.location.findFirst({
      where: { id: fs.locationId, status: 'ACTIVE', business: { id: fs.businessId, status: 'ACTIVE' } },
      select: { id: true },
    });
    if (!location) throw new NotFoundException(NOT_SERVED);
  }

  /** Заметка записи: откуда и комментарий гостя; контакты в свободном тексте маскируются, пока база не в РК (ADR-074) */
  private notes(fs: FormSite, comment: string | null): string {
    return `С сайта «${fs.site.name}»` + (comment ? `. Комментарий: ${freeTextForStorage(comment)}` : '');
  }
}

/** Момент «дата и время в поясе филиала»; null, если такого местного времени нет (перевод часов) */
export function localInstant(date: string, time: string, timezone: string): Date | null {
  const midnight = timeOffWindow({ dateFrom: date, dateTo: date, timezone }).fromUtc.getTime();
  const [hh, mm] = time.split(':').map(Number);
  const at = new Date(midnight + ((hh as number) * 60 + (mm as number)) * 60_000);
  const back = localClock(at, timezone);
  return back.date === date && back.time === time ? at : null;
}

function localClock(at: Date, timezone: string): { date: string; time: string } {
  const parts = new Map(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`,
    time: `${parts.get('hour')}:${parts.get('minute')}`,
  };
}
