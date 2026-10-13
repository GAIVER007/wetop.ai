import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Ip,
  NotFoundException,
  Param,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { hashSessionToken, parseOrderRating } from '@pms/domain';
import { Public } from '../auth/public.decorator';
import { withOrganizationScope } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { RateWindows } from '../rate-window';
import { clientIp } from '../web-booking/client-ip';

/** Любой недействительный ключ отвечает одинаково (§40): ни «нет заказа», ни «просрочено», ни «уже оценён» */
export const RATING_LINK_INVALID = 'Ссылка недействительна';
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const HOUR_MS = 3_600_000;
// гости ресторана сидят на общем Wi-Fi с одним внешним адресом: предел бережёт базу, перебор ключа и так невозможен
export const RATING_LINK_PER_IP_PER_HOUR = 120;

/**
 * Оценка официанта с телефона гостя по QR-коду (DATA_MODEL §40, ADR-170). Человека за запросом нет: заказ находится
 * служебной ролью по хешу ключа, а запись идёт от имени организации заказа (RLS), как бронь с сайта.
 */
@Injectable()
export class OrderRatingLinkService {
  private perIp = new RateWindows(HOUR_MS, 20_000);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private limit(ip: string | null, now: Date) {
    if (!this.perIp.allow(ip ?? 'unknown', RATING_LINK_PER_IP_PER_HOUR, now))
      throw new HttpException('Слишком много запросов, попробуйте позже', HttpStatus.TOO_MANY_REQUESTS);
  }

  private async find(token: string, now: Date) {
    if (!TOKEN_RE.test(token)) return null;
    const r = await this.prisma.db.restaurantOrder.findUnique({
      where: { ratingTokenHash: hashSessionToken(token) },
      include: {
        location: { select: { name: true, business: { select: { organizationId: true } } } },
        waiter: { select: { name: true } },
        rating: { select: { orderId: true } },
      },
    });
    if (!r || r.status !== 'CLOSED' || r.rating || !r.ratingTokenExpiresAt || r.ratingTokenExpiresAt <= now) return null;
    return r;
  }

  async preview(token: string, ip: string | null, now = new Date()) {
    this.limit(ip, now);
    const r = await this.find(token, now);
    if (!r) throw new NotFoundException(RATING_LINK_INVALID);
    return {
      placeName: r.location.name,
      waiterName: r.waiter?.name ?? null,
      orderNumber: r.number,
    };
  }

  async rate(token: string, raw: unknown, ip: string | null, now = new Date()) {
    this.limit(ip, now);
    let body: ReturnType<typeof parseOrderRating>;
    try {
      body = parseOrderRating(raw);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Некорректный запрос');
    }
    const found = await this.find(token, now);
    if (!found) throw new NotFoundException(RATING_LINK_INVALID);
    const organizationId = found.location.business.organizationId;
    const hash = hashSessionToken(token);
    await withOrganizationScope(organizationId, () =>
      this.prisma.db.$transaction(async (tx) => {
        // ключ гасится в той же строке под замком: два одновременных нажатия дают одну оценку
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM restaurant_orders
          WHERE id=${found.id}::uuid AND rating_token_hash=${hash} AND rating_token_expires_at > ${now}
            AND status='CLOSED'
          FOR UPDATE`;
        if (!locked.length || (await tx.restaurantOrderRating.findUnique({ where: { orderId: found.id } })))
          throw new NotFoundException(RATING_LINK_INVALID);
        await tx.restaurantOrderRating.create({
          data: { orderId: found.id, waiterId: found.waiterId, stars: body.stars, comment: body.comment },
        });
        await tx.restaurantOrder.update({
          where: { id: found.id },
          data: { ratingTokenHash: null, ratingTokenExpiresAt: null },
        });
        await tx.auditLog.create({
          data: {
            organizationId,
            userId: null,
            entityType: 'restaurant_order',
            entityId: found.id,
            action: 'food.order.rated',
            after: { stars: body.stars, waiterId: found.waiterId, withComment: body.comment !== null, via: 'qr' },
          },
        });
      }),
    );
    return { stars: body.stars };
  }
}

/** Только изнутри: страница стойки `/rate/<ключ>` зовёт API своим сервером, туннель этот адрес не выпускает (SECURITY.md §11) */
@Public()
@Controller('public/order-rating')
export class OrderRatingLinkController {
  constructor(@Inject(OrderRatingLinkService) private readonly service: OrderRatingLinkService) {}

  @Get(':token') preview(
    @Param('token') token: string,
    @Ip() socket: string | undefined,
    @Headers('cf-connecting-ip') cf: string | undefined,
  ) {
    return this.service.preview(token, clientIp(socket, cf));
  }

  @Post(':token') @HttpCode(200) rate(
    @Param('token') token: string,
    @Body() body: unknown,
    @Ip() socket: string | undefined,
    @Headers('cf-connecting-ip') cf: string | undefined,
  ) {
    return this.service.rate(token, body, clientIp(socket, cf));
  }
}
