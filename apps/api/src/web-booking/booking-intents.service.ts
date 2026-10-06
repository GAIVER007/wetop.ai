import 'reflect-metadata';
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { guestForStorage } from '@pms/shared';
import { ANALYTICS_REPOSITORY, type AnalyticsRepository } from '../analytics/analytics.repository';
import { withIntegrationPropertyScope, withOrganizationScope } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { RESERVATIONS_UOW, type UnitOfWork } from '../reservations/reservations.repository';
import { ReservationsService } from '../reservations/reservations.service';
import type { ReservationCard } from '../reservations/reservation-card';
import { WebBookingService } from './web-booking.service';

/** Организация и объект брони ИИ-продавца (MKT1B BOOK-4): объект — из строки агента или предложения, не из запроса */
const withPropertyOf = <T>(organizationId: string, propertyId: string, fn: () => Promise<T>): Promise<T> =>
  withOrganizationScope(organizationId, () => withIntegrationPropertyScope(propertyId, fn));

/** Срок котировки из чата: решение владельца 01.10.2026 (Q-SELLER-QUOTE-TTL) */
export const INTENT_TTL_MS = 30 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANNEL_SOURCE = { whatsapp: 'WHATSAPP', widget: 'WEBSITE' } as const;
type Channel = keyof typeof CHANNEL_SOURCE;
const NOT_FOUND = 'Предложение не найдено';
const STALE = 'Предложение устарело: нужна новая цена и новое согласие гостя';

export interface IntentQuote {
  intent: string;
  expiresAt: string;
  categoryName: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  adults: number;
  totalMinor: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
}
export interface IntentBooking {
  confirmationNumber: string;
  status: string;
  categoryName: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  adults: number;
  totalMinor: string;
  currency: string;
  /** true — бронь уже была создана этим предложением раньше (повтор) */
  replay: boolean;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');
const nightsBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Бронь из чата ИИ-продавца (DATA_MODEL §25, ADR-144; контракт владельца 30.09.2026): котировка на 30 минут и
 * подтверждение после явного «да» гостя. Организация, объект и тариф берутся из строки агента и сайта его филиала,
 * не из запроса бота. Бронь создаёт тот же путь, что у стойки и сайта, с ключом повтора = id намерения.
 */
@Injectable()
export class BookingIntentsService {
  constructor(
    @Inject(WebBookingService) private readonly web: WebBookingService,
    @Inject(ANALYTICS_REPOSITORY) private readonly sites: AnalyticsRepository,
    @Inject(RESERVATIONS_UOW) private readonly uow: UnitOfWork,
    @Inject(ReservationsService) private readonly reservations: ReservationsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async quote(raw: unknown, now: Date = new Date()): Promise<IntentQuote> {
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const agent = text(b.agent, 36).toLowerCase();
    if (!UUID.test(agent)) throw new BadRequestException('agent: ожидается UUID');
    const conversation = text(b.conversation, 64);
    if (!conversation || conversation.length > 64)
      throw new BadRequestException('conversation: от 1 до 64 знаков');
    const channel = text(b.channel, 16) as Channel;
    if (!(channel in CHANNEL_SOURCE)) throw new BadRequestException('channel: whatsapp или widget');
    const category = text(b.category, 64);
    if (!category) throw new BadRequestException('category: код категории');
    const site = await this.sites.bookingSiteForAgent(agent);
    if (!site || !site.organizationId || !site.bookingRatePlan)
      throw new NotFoundException('у агента нет сайта с включённым бронированием');
    const quote = await this.web.quoteForAgent(
      agent,
      { arrival: b.arrival, departure: b.departure, adults: b.adults, promo: b.promo },
      now,
    );
    const cat = quote.categories.find((c) => c.code === category || c.name === category);
    if (!cat) throw new NotFoundException(`Категории «${category}» в продаже нет`);
    if (!cat.fits) throw new ConflictException(`«${cat.name}» вмещает не больше ${cat.capacity}`);
    if (cat.closed) throw new ConflictException(`«${cat.name}» на эти даты не продаётся`);
    if (cat.available <= 0) throw new ConflictException(`«${cat.name}»: мест на эти даты нет`);
    if (cat.totalMinor === null)
      throw new ConflictException(`«${cat.name}»: цена на эти даты не задана`);
    // MKT1B BOOK-4: категория, бронь и сводка — строго в объекте филиала агента, не в самом раннем объекте организации
    const typeId = await withPropertyOf(site.organizationId, site.propertyId, () =>
      this.uow.read(
        async (repo) => (await repo.activeCategories()).find((c) => c.code === cat.code)?.id,
      ),
    );
    if (!typeId) throw new NotFoundException(`Категории «${category}» в продаже нет`);
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify([
          cat.code,
          quote.arrivalDate,
          quote.departureDate,
          quote.adults,
          quote.promo?.code ?? null,
        ]),
      )
      .digest('hex');
    const expiresAt = new Date(now.getTime() + INTENT_TTL_MS);
    const row = await this.prisma.db.sellerBookingIntent.create({
      data: {
        agentId: agent,
        organizationId: site.organizationId,
        propertyId: site.propertyId,
        conversationId: conversation,
        channel,
        accommodationTypeId: typeId,
        ratePlanId: site.bookingRatePlan.id,
        arrivalDate: new Date(`${quote.arrivalDate}T00:00:00Z`),
        departureDate: new Date(`${quote.departureDate}T00:00:00Z`),
        adults: quote.adults,
        totalMinor: BigInt(cat.totalMinor),
        currency: quote.currency,
        expiresAt,
        requestHash,
      },
      select: { id: true },
    });
    return {
      intent: row.id,
      expiresAt: expiresAt.toISOString(),
      categoryName: cat.name,
      arrivalDate: quote.arrivalDate,
      departureDate: quote.departureDate,
      nights: quote.nights,
      adults: quote.adults,
      totalMinor: cat.totalMinor,
      currency: quote.currency,
      checkInTime: quote.checkInTime,
      checkOutTime: quote.checkOutTime,
    };
  }

  async confirm(raw: unknown, now: Date = new Date()): Promise<IntentBooking> {
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const agent = text(b.agent, 36).toLowerCase();
    const intentId = text(b.intent, 36).toLowerCase();
    if (!UUID.test(agent) || !UUID.test(intentId))
      throw new BadRequestException('agent и intent: UUID');
    const message = text(b.message, 128);
    if (message.length < 8 || message.length > 128)
      throw new BadRequestException('message: ключ сообщения с согласием гостя, 8–128 знаков');
    const g = (b.guest && typeof b.guest === 'object' ? b.guest : {}) as Record<string, unknown>;
    const firstName = text(g.firstName, 80);
    const lastName = text(g.lastName, 80);
    const phone = text(g.phone, 32);
    if (!firstName || !lastName)
      throw new BadRequestException('guest.firstName и guest.lastName обязательны');
    if (phone.replace(/\D/g, '').length < 10)
      throw new BadRequestException('guest.phone: не меньше 10 цифр');
    const email = text(g.email, 120) || null;

    const row = await this.prisma.db.sellerBookingIntent.findFirst({
      where: { id: intentId, agentId: agent },
      include: {
        accommodationType: { select: { code: true } },
        ratePlan: { select: { code: true } },
        reservation: { select: { confirmationNumber: true } },
      },
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    if (row.state === 'CONFIRMED' && row.reservation)
      return this.summary(
        row.organizationId,
        row.propertyId,
        row.reservation.confirmationNumber,
        row.adults,
        true,
      );
    if (row.state === 'REJECTED') throw new ConflictException(STALE);
    if (row.expiresAt.getTime() <= now.getTime()) {
      await this.reject(row.id);
      throw new ConflictException(STALE);
    }
    // Ключ согласия: одно сообщение гостя подтверждает одно предложение; повтор того же — тот же исход
    try {
      const claimed = await this.prisma.db.sellerBookingIntent.updateMany({
        where: {
          id: row.id,
          state: 'QUOTED',
          OR: [{ channelMessageId: null }, { channelMessageId: message }],
        },
        data: { channelMessageId: message },
      });
      if (claimed.count === 0)
        throw new ConflictException('Предложение уже подтверждено другим сообщением');
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new ConflictException('Это сообщение уже подтвердило другое предложение');
      throw e;
    }
    const arrivalDate = iso(row.arrivalDate);
    const departureDate = iso(row.departureDate);
    const channel = row.channel as Channel;
    const guest = guestForStorage({ firstName, lastName, phone, email }, `seller:${row.id}`);
    let card: ReservationCard;
    try {
      card = (await withPropertyOf(row.organizationId, row.propertyId, () =>
        this.reservations.create(
          {
            source: CHANNEL_SOURCE[channel],
            creationKey: row.id,
            expectedTotalMinor: row.totalMinor.toString(),
            arrivalDate,
            departureDate,
            notes:
              channel === 'whatsapp'
                ? 'Бронь из WhatsApp, ИИ-продавец'
                : 'Бронь из чата сайта, ИИ-продавец',
            guest: {
              firstName: guest.firstName,
              lastName: guest.lastName,
              phone: guest.phone,
              email: guest.email,
            },
            items: [
              {
                accommodationTypeCode: row.accommodationType.code,
                ratePlanCode: row.ratePlan.code,
                adults: row.adults,
                autoAssign: true,
              },
            ],
          },
          { guestPrepared: true },
        ),
      )) as ReservationCard;
    } catch (e) {
      // Цена изменилась, мест нет, правило тарифа: предложение больше не действует, нужна новая котировка.
      // Неизвестный сбой (сеть, база) оставляет предложение как есть: повтор вернёт ту же бронь по ключу.
      if (e instanceof HttpException && [400, 404, 409, 422].includes(e.getStatus())) {
        await this.reject(row.id);
        throw new ConflictException(`${STALE}. ${e.message}`);
      }
      throw e;
    }
    const reservation = await this.prisma.db.reservation.findFirst({
      where: { confirmationNumber: card.confirmationNumber, propertyId: row.propertyId },
      select: { id: true },
    });
    if (reservation)
      await this.prisma.db.sellerBookingIntent.updateMany({
        where: { id: row.id, state: 'QUOTED' },
        data: { state: 'CONFIRMED', reservationId: reservation.id },
      });
    return {
      confirmationNumber: card.confirmationNumber,
      status: card.status,
      categoryName: card.items[0]?.accommodationTypeName ?? row.accommodationType.code,
      arrivalDate: card.arrivalDate,
      departureDate: card.departureDate,
      nights: nightsBetween(card.arrivalDate, card.departureDate),
      adults: row.adults,
      totalMinor: card.totalAmountMinor,
      currency: card.currency,
      replay: false,
    };
  }

  private async reject(id: string): Promise<void> {
    await this.prisma.db.sellerBookingIntent.updateMany({
      where: { id, state: 'QUOTED' },
      data: { state: 'REJECTED' },
    });
  }

  private async summary(
    organizationId: string,
    propertyId: string,
    confirmationNumber: string,
    adults: number,
    replay: boolean,
  ): Promise<IntentBooking> {
    const card = await withPropertyOf(organizationId, propertyId, () =>
      this.uow.read((repo) => repo.card(confirmationNumber)),
    );
    if (!card) throw new NotFoundException(NOT_FOUND);
    return {
      confirmationNumber: card.confirmationNumber,
      status: card.status,
      categoryName: card.items[0]?.accommodationTypeName ?? '',
      arrivalDate: card.arrivalDate,
      departureDate: card.departureDate,
      nights: nightsBetween(card.arrivalDate, card.departureDate),
      adults,
      totalMinor: card.totalAmountMinor,
      currency: card.currency,
      replay,
    };
  }
}
