import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Injectable,
  Ip,
  Module,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { newSessionToken } from '@pms/shared';
import { Access } from '../auth/access.decorator';
import { AttemptWindows, visitorKey } from '../auth/attempt-limits';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { Public } from '../auth/public.decorator';
import { currentUserId, withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { visitorIp } from '../web-booking/client-ip';
import { HotelService } from './hotel.module';

/**
 * Отзыв гостя гостиницы после выезда (DATA_MODEL HOTEL-REVIEWS-20261031, миграция 175). Единая система с салоном
 * (beauty/reviews.ts): стойка выдаёт ссылку, гость без входа ставит 1–5 и пишет комментарий. Ключ ссылки хранится
 * только хэшем; персональных данных гостя таблица не хранит.
 */
const THIRTY_DAYS_MS = 30 * 86_400_000;
const TOKEN = /^[A-Za-z0-9_-]{40,100}$/;
const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
const INVALID = 'Ссылка недействительна или истекла';

export type HotelReviewRefusal = 'NOT_CHECKED_OUT' | 'SUBMITTED';

/** Можно ли выдать ссылку: после выезда хотя бы одного проживания и пока отзыв не отправлен */
export function hotelReviewDecision(input: {
  itemStatuses: string[];
  current: { submittedAt: Date | null } | null;
  now: Date;
}): { ok: true; expiresAt: Date; rotated: boolean } | { ok: false; reason: HotelReviewRefusal } {
  if (!input.itemStatuses.includes('CHECKED_OUT')) return { ok: false, reason: 'NOT_CHECKED_OUT' };
  if (input.current?.submittedAt) return { ok: false, reason: 'SUBMITTED' };
  return { ok: true, expiresAt: new Date(input.now.getTime() + THIRTY_DAYS_MS), rotated: input.current !== null };
}

/** Форма гостя: `{ stars: 1..5, comment?: string до 2000 }`, лишние поля отклоняются */
export function parseHotelReview(raw: unknown): { stars: number; comment: string | null } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Поставьте оценку');
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some((k) => k !== 'stars' && k !== 'comment')) throw new BadRequestException('Некорректный отзыв');
  const stars = body['stars'];
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5)
    throw new BadRequestException('Оценка должна быть от 1 до 5');
  const c = body['comment'];
  if (c !== undefined && c !== null && typeof c !== 'string') throw new BadRequestException('Некорректный комментарий');
  const comment = typeof c === 'string' ? c.trim() : '';
  if (comment.length > 2000) throw new BadRequestException('Комментарий не должен превышать 2000 знаков');
  return { stars, comment: comment || null };
}

const REFUSAL: Record<HotelReviewRefusal, string> = {
  NOT_CHECKED_OUT: 'Ссылка на отзыв доступна после выезда гостя',
  SUBMITTED: 'Гость уже оставил отзыв',
};

@Injectable()
export class HotelReviewsService {
  private readonly readPerIp = new AttemptWindows(30, 60_000);
  private readonly submitPerIp = new AttemptWindows(5, 3_600_000);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(HotelService) private readonly hotel: HotelService,
  ) {}

  /** Отзыв брони для карточки: оценка и комментарий, если гость уже ответил */
  async forReservation(number: string) {
    const propertyId = await this.hotel.currentPropertyId();
    const reservation = await this.prisma.db.reservation.findFirst({
      where: { propertyId, confirmationNumber: number },
      select: { stayReview: { select: { stars: true, comment: true, submittedAt: true, expiresAt: true } } },
    });
    if (!reservation) throw new NotFoundException('Бронь не найдена');
    const r = reservation.stayReview;
    return r?.submittedAt
      ? { status: 'SUBMITTED' as const, stars: r.stars, comment: r.comment, submittedAt: r.submittedAt.toISOString() }
      : r
        ? { status: 'ISSUED' as const, expiresAt: r.expiresAt.toISOString() }
        : { status: 'NONE' as const };
  }

  async issue(number: string, now = new Date()): Promise<{ reviewPath: string; expiresAt: string }> {
    const propertyId = await this.hotel.currentPropertyId();
    const userId = currentUserId();
    return withServiceDatabase(() =>
      this.prisma.db.$transaction(async (tx) => {
        const reservation = await tx.reservation.findFirst({
          where: { propertyId, confirmationNumber: number },
          select: { id: true, property: { select: { organizationId: true } }, items: { select: { status: true } } },
        });
        if (!reservation) throw new NotFoundException('Бронь не найдена');
        await tx.$queryRaw`SELECT id FROM reservations WHERE id=${reservation.id}::uuid FOR UPDATE`;
        const current = await tx.hotelStayReview.findUnique({ where: { reservationId: reservation.id }, select: { submittedAt: true } });
        const decision = hotelReviewDecision({ itemStatuses: reservation.items.map((i) => i.status), current, now });
        if (!decision.ok) throw new ConflictException(REFUSAL[decision.reason]);
        const token = newSessionToken();
        const tokenHash = hashToken(token);
        await tx.hotelStayReview.upsert({
          where: { reservationId: reservation.id },
          create: { reservationId: reservation.id, tokenHash, expiresAt: decision.expiresAt },
          update: { tokenHash, expiresAt: decision.expiresAt },
        });
        await tx.auditLog.create({
          data: {
            organizationId: reservation.property.organizationId,
            userId,
            entityType: 'reservation',
            entityId: reservation.id,
            action: decision.rotated ? 'hotel.review_invitation.rotated' : 'hotel.review_invitation.issued',
            after: { expiresAt: decision.expiresAt.toISOString() },
          },
        });
        return { reviewPath: `/reviews/stay/${token}`, expiresAt: decision.expiresAt.toISOString() };
      }),
    );
  }

  async read(token: string, ip: string | null, now = new Date()) {
    if (ip && !this.readPerIp.allow(visitorKey(ip), now.getTime())) throw new HttpException('Слишком много запросов. Повторите через минуту.', 429);
    if (!TOKEN.test(token)) throw new NotFoundException(INVALID);
    const row = await this.prisma.db.hotelStayReview.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { expiresAt: true, submittedAt: true, reservation: { select: { property: { select: { name: true } } } } },
    });
    if (!row) throw new NotFoundException(INVALID);
    if (row.submittedAt) return { status: 'SUBMITTED' as const };
    if (now >= row.expiresAt) throw new NotFoundException(INVALID);
    return { status: 'OPEN' as const, propertyName: row.reservation.property.name, expiresAt: row.expiresAt.toISOString() };
  }

  async submit(token: string, raw: unknown, ip: string | null, now = new Date()) {
    const review = parseHotelReview(raw);
    if (ip && !this.submitPerIp.allow(visitorKey(ip), now.getTime())) throw new HttpException('Слишком много отправок. Повторите позже.', 429);
    if (!TOKEN.test(token)) throw new NotFoundException(INVALID);
    const tokenHash = hashToken(token);
    return this.prisma.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ reservation_id: string }>>`
        SELECT reservation_id::text FROM hotel_stay_reviews WHERE token_hash=${tokenHash} FOR UPDATE`;
      if (!locked[0]) throw new NotFoundException(INVALID);
      const row = await tx.hotelStayReview.findUnique({
        where: { tokenHash },
        select: { reservationId: true, expiresAt: true, submittedAt: true, reservation: { select: { property: { select: { organizationId: true } } } } },
      });
      if (!row || now >= row.expiresAt) throw new NotFoundException(INVALID);
      if (row.submittedAt) throw new ConflictException('Отзыв по этой ссылке уже отправлен');
      await tx.hotelStayReview.update({ where: { reservationId: row.reservationId }, data: { stars: review.stars, comment: review.comment, submittedAt: now } });
      await tx.auditLog.create({
        data: {
          organizationId: row.reservation.property.organizationId,
          userId: null,
          entityType: 'Reservation',
          entityId: row.reservationId,
          action: 'hotel.review.submitted',
          after: { stars: review.stars },
        },
      });
      return { status: 'SUBMITTED' as const };
    });
  }
}

/** Стойка: отзыв брони и выдача ссылки (после выезда) */
@Access('desk')
@RequiresBusinessCapability('hospitality.reservations')
@Controller('reservations')
export class HotelReviewInvitationController {
  constructor(@Inject(HotelReviewsService) private readonly service: HotelReviewsService) {}

  @Get(':number/review')
  @Header('Cache-Control', 'no-store')
  review(@Param('number') number: string) {
    return this.service.forReservation(number);
  }

  @Post(':number/review-invitation')
  @HttpCode(201)
  issue(@Param('number') number: string) {
    return this.service.issue(number);
  }
}

/** Гость без входа: форма отзыва по ссылке */
@Public()
@Controller('hotel/reviews')
export class HotelPublicReviewsController {
  constructor(@Inject(HotelReviewsService) private readonly service: HotelReviewsService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  read(@Param('token') token: string, @Ip() socketIp: string, @Headers('cf-connecting-ip') cf?: string) {
    return withServiceDatabase(() => this.service.read(token, visitorIp(socketIp, cf)));
  }

  @Post(':token')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  submit(@Param('token') token: string, @Body() body: unknown, @Ip() socketIp: string, @Headers('cf-connecting-ip') cf?: string) {
    return withServiceDatabase(() => this.service.submit(token, body, visitorIp(socketIp, cf)));
  }
}

@Module({
  controllers: [HotelReviewInvitationController, HotelPublicReviewsController],
  providers: [PrismaService, HotelService, HotelReviewsService],
})
export class HotelReviewsModule {}
