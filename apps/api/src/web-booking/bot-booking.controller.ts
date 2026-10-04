import 'reflect-metadata';
import {
  Body,
  Controller,
  ForbiddenException,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { serviceKeyKind } from '../auth/auth.guard';
import { Public } from '../auth/public.decorator';
import { BookingIntentsService } from './booking-intents.service';

export const BOOK_KEY_REQUIRED = 'Бронь из чата создаёт только продавец по своему ключу записи';

/**
 * Бронь из чата ИИ-продавца (DATA_MODEL §25, ADR-144): котировка на 30 минут и подтверждение после явного «да» гостя.
 * Узкий ключ записи `SELLER_BOOK_KEY`, только POST; ключ сверяет контроллер сам — замок молчит без `AUTH_REQUIRED=1`,
 * при включённом замке та же пара «вид ключа + два адреса» живёт в `SessionGuard`.
 */
@Public()
@Controller('bot/booking-intents')
export class BotBookingController {
  constructor(@Inject(BookingIntentsService) private readonly service: BookingIntentsService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  quote(@Req() request: { headers: Record<string, unknown> }, @Body() body: unknown) {
    this.checkKey(request);
    return this.service.quote(body);
  }

  @Post('confirm')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  confirm(@Req() request: { headers: Record<string, unknown> }, @Body() body: unknown) {
    this.checkKey(request);
    return this.service.confirm(body);
  }

  private checkKey(request: { headers: Record<string, unknown> }): void {
    const key = serviceKeyKind(request.headers);
    if (key === null) throw new UnauthorizedException(BOOK_KEY_REQUIRED);
    if (key !== 'seller-book' && key !== 'service') throw new ForbiddenException(BOOK_KEY_REQUIRED);
  }
}
