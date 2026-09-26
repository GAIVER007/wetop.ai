import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  assertRestrictionsAllow,
  hostMatches,
  localDate,
  parseBookingRequest,
  parseQuoteRequest,
  priceStay,
  ReservationRuleError,
  RestrictionViolationError,
} from '@pms/domain';
import { guestForStorage } from '@pms/shared';
import {
  ANALYTICS_REPOSITORY,
  type AnalyticsRepository,
  type SiteRecord,
} from '../analytics/analytics.repository';
import { CollectService } from '../analytics/collect.service';
import { RESERVATIONS_UOW, type UnitOfWork } from '../reservations/reservations.repository';
import { ReservationsService } from '../reservations/reservations.service';

export interface RequestContext {
  originHost: string | null;
  /** Host запроса: демо-страница живёт на адресе API и принимается без домена сайта */
  ownHost: string | null;
  /** IP только для лимита в памяти, нигде не сохраняется (план среза 9 §4) */
  ip: string | null;
  now?: Date;
}

export interface QuoteCategory {
  code: string;
  name: string;
  capacity: number;
  /** Гостей из запроса вмещает */
  fits: boolean;
  /** Свободных мест на весь период (как считает канал, Q-107) */
  available: number;
  /** Закрыто ограничением продаж (ADR-020) */
  closed: boolean;
  /** Цена за весь период для запрошенного числа гостей, integer minor units строкой; null — нет цены */
  totalMinor: string | null;
  perNight: Array<{ date: string; priceMinor: string }>;
}

export interface Quote {
  site: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  adults: number;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  ratePlan: string;
  categories: QuoteCategory[];
}

export interface BookingResult {
  confirmationNumber: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  categoryName: string;
  adults: number;
  totalMinor: string;
  currency: string;
  checkInTime: string;
}

export const BOOKING_RATE_LIMITS = {
  perIpPerHour: 5,
  perSitePerHour: 30,
} as const;
const HOUR_MS = 3_600_000;

const addDays = (date: string, n: number): string => {
  const x = new Date(`${date}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const nightsBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Виджет бронирования на сайте (срез 9). Сам ничего не решает: доступность, ограничения, цена и бронь —
 * те же правила, что у стойки (`ReservationsService.create`). Здесь только форма, сайт, домен и лимиты.
 */
@Injectable()
export class WebBookingService {
  private windows = new Map<string, { start: number; count: number }>();

  constructor(
    @Inject(ANALYTICS_REPOSITORY) private readonly sites: AnalyticsRepository,
    @Inject(RESERVATIONS_UOW) private readonly uow: UnitOfWork,
    @Inject(ReservationsService) private readonly reservations: ReservationsService,
    @Inject(CollectService) private readonly collect: CollectService,
  ) {}

  async quote(raw: unknown, ctx: RequestContext): Promise<Quote> {
    const now = ctx.now ?? new Date();
    const siteKey = typeof (raw as { k?: unknown })?.k === 'string' ? (raw as { k: string }).k : '';
    const site = await this.bookingSite(siteKey, ctx);
    const parsed = parseQuoteRequest(raw, localDate(now, site.timezone));
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const { arrivalDate, departureDate, adults } = parsed.value;
    const plan = site.bookingRatePlan!;

    // Расчёт цены и мест только читает — без транзакции (Б9): занятый пул не превращает витрину сайта в 500
    const categories = await this.uow.read(async (repo) => {
      const ratePlan = await repo.ratePlanByCode(plan.code);
      if (!ratePlan || !ratePlan.active) {
        throw new NotFoundException('тариф сайта неактивен — бронирование с сайта выключено');
      }
      const out: QuoteCategory[] = [];
      for (const cat of await repo.activeCategories()) {
        if (!(await repo.ratePlanCoversType(ratePlan.id, cat.id))) continue;
        const restrictions = await repo.restrictionsFor(
          cat.id,
          ratePlan.id,
          arrivalDate,
          addDays(departureDate, 1),
        );
        let closed = false;
        try {
          assertRestrictionsAllow({
            arrivalDate,
            departureDate,
            categoryName: cat.name,
            restrictions,
          });
        } catch (e) {
          if (!(e instanceof RestrictionViolationError)) throw e;
          closed = true;
        }
        const available = await repo.categoryAvailability(cat.id, arrivalDate, departureDate);
        const occupancy = Math.min(adults, cat.capacityAdults);
        const rates = await repo.nightRates(cat.id, ratePlan.id, arrivalDate, departureDate);
        let price: ReturnType<typeof priceStay> | null = null;
        try {
          price = priceStay({ arrivalDate, departureDate, occupancy, rates });
        } catch (e) {
          if (!(e instanceof ReservationRuleError)) throw e;
        }
        out.push({
          code: cat.code,
          name: cat.name,
          capacity: cat.capacityAdults,
          fits: adults <= cat.capacityAdults,
          available,
          closed,
          totalMinor: price ? price.totalMinor.toString() : null,
          perNight: price
            ? price.nights.map((n) => ({ date: n.date, priceMinor: n.priceMinor.toString() }))
            : [],
        });
      }
      return { rows: out, currency: ratePlan.currency };
    });

    return {
      site: site.name,
      arrivalDate,
      departureDate,
      nights: nightsBetween(arrivalDate, departureDate),
      adults,
      currency: categories.currency,
      checkInTime: site.checkInTime,
      checkOutTime: site.checkOutTime,
      ratePlan: plan.name,
      categories: categories.rows,
    };
  }

  async book(raw: unknown, ctx: RequestContext): Promise<BookingResult> {
    const now = ctx.now ?? new Date();
    const siteKey = typeof (raw as { k?: unknown })?.k === 'string' ? (raw as { k: string }).k : '';
    const site = await this.bookingSite(siteKey, ctx);
    const parsed = parseBookingRequest(raw, localDate(now, site.timezone));
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const req = parsed.value;

    if (ctx.ip && !this.allow(`ip:${ctx.ip}`, BOOKING_RATE_LIMITS.perIpPerHour, now)) {
      throw new HttpException(
        'слишком много броней с одного адреса, попробуйте позже',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!this.allow(`site:${site.id}`, BOOKING_RATE_LIMITS.perSitePerHour, now)) {
      throw new HttpException(
        'слишком много броней за час, попробуйте позже',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ADR-018: настоящие ФИО и контакты — только в production-БД в РК; иначе псевдоним, как у каналов
    const guest = guestForStorage(req.guest, `web:${site.id}:${randomUUID()}`);
    const notes =
      `Бронь с сайта «${site.name}»` + (req.comment ? `. Комментарий гостя: ${req.comment}` : '');
    const card = await this.reservations.create(
      {
        source: 'WEBSITE',
        arrivalDate: req.arrivalDate,
        departureDate: req.departureDate,
        notes,
        guest: {
          firstName: guest.firstName,
          lastName: guest.lastName,
          phone: guest.phone,
          email: guest.email,
        },
        items: [
          {
            accommodationTypeCode: req.categoryCode,
            ratePlanCode: site.bookingRatePlan!.code,
            adults: req.adults,
            autoAssign: true,
          },
        ],
      },
      { guestPrepared: true },
    );
    let linkedSession = false;
    if (req.sessionKey) {
      // Приёмник счётчика пишет события пачкой раз в секунду. Посетитель на быстрой сети бронирует раньше, чем
      // его первый просмотр доехал до базы, и привязка никого не находит — источник брони терялся молча
      // (гонка воспроизведена 15.09.2026: хит → сразу /w/book → не привязано, через 2 с — привязано).
      // Сначала записываем всё, что накопилось, потом привязываем; в журнале — что привязка удалась на самом деле.
      await this.collect.flush();
      linkedSession = await this.sites.linkSessionReservation(
        site.id,
        req.sessionKey,
        card.confirmationNumber,
      );
    }
    await this.sites.audit('analytics.site.booking', site.id, {
      confirmationNumber: card.confirmationNumber,
      categoryCode: req.categoryCode,
      arrivalDate: req.arrivalDate,
      departureDate: req.departureDate,
      adults: req.adults,
      linkedSession,
    });
    const item = card.items[0];
    return {
      confirmationNumber: card.confirmationNumber,
      status: card.status,
      arrivalDate: card.arrivalDate,
      departureDate: card.departureDate,
      nights: nightsBetween(card.arrivalDate, card.departureDate),
      categoryName: item?.accommodationTypeName ?? req.categoryCode,
      adults: req.adults,
      totalMinor: card.totalAmountMinor,
      currency: card.currency,
      checkInTime: site.checkInTime,
    };
  }

  /** Сайт по ключу для демо-страницы; null — нет или бронирование выключено. */
  async siteForDemo(key: string): Promise<SiteRecord | null> {
    const site = await this.sites.siteByKey(key);
    return site && site.status === 'ACTIVE' && site.bookingEnabled && site.bookingRatePlan
      ? site
      : null;
  }

  /** Для тестов */
  resetLimits(): void {
    this.windows = new Map();
  }

  private async bookingSite(key: string, ctx: RequestContext): Promise<SiteRecord> {
    const site = key ? await this.sites.siteByKey(key) : null;
    if (!site || site.status !== 'ACTIVE' || !site.bookingEnabled || !site.bookingRatePlan) {
      throw new NotFoundException('бронирование с сайта выключено или сайт не найден');
    }
    const fromOwnPage = !!ctx.originHost && !!ctx.ownHost && ctx.originHost === ctx.ownHost;
    if (!fromOwnPage && !hostMatches(site.hosts, ctx.originHost)) {
      throw new ForbiddenException('запрос не с домена сайта');
    }
    // Цены, тариф, фонд и выгрузка в Channex у бронирования с сайта — объекта этой установки (служебный контекст).
    // Сайт другого объекта показывал бы цены Luxx и заводил брони с данными своих гостей в фонде Luxx (аудит 26.09,
    // В-4; Q-186, ADR-085) — такому сайту честный отказ, пока бронирование с сайта не научится нескольким объектам.
    const serving = await this.uow.read((repo) => repo.property());
    if (site.propertyId !== serving.id) {
      throw new NotFoundException('бронирование с сайта для этого объекта пока не подключено');
    }
    return site;
  }

  private allow(key: string, limit: number, now: Date): boolean {
    const t = now.getTime();
    const w = this.windows.get(key);
    if (!w || t - w.start >= HOUR_MS) {
      this.windows.set(key, { start: t, count: 1 });
      if (this.windows.size > 20_000) this.windows.clear();
      return true;
    }
    w.count += 1;
    return w.count <= limit;
  }
}
