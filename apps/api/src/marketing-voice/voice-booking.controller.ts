import 'reflect-metadata';
import { Body, Controller, ForbiddenException, Get, Header, HttpCode, Inject, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { serviceKeyKind } from '../auth/auth.guard';
import { VoiceBeautyService } from './voice-beauty.service';
import { VoiceBookingRouter } from './voice-booking.router';
import { VoiceBookingService } from './voice-booking.service';

export const VOICE_BOOK_KEY_REQUIRED = 'Бронь по телефону создаёт только голосовой агент по своему ключу записи';
export const VOICE_READ_KEY_REQUIRED = 'Нужен ключ голосового агента';

type ServiceRequest = { headers: Record<string, unknown> };

/** Свободное читает ключ приёма событий (он уже читает профиль), бронь пишет только свой ключ записи голоса */
function requireKey(request: ServiceRequest, wanted: 'voice-ingest' | 'voice-book'): void {
  const message = wanted === 'voice-book' ? VOICE_BOOK_KEY_REQUIRED : VOICE_READ_KEY_REQUIRED;
  const key = serviceKeyKind(request.headers);
  if (key === null || key === 'unknown') throw new UnauthorizedException(message);
  if (key !== wanted) throw new ForbiddenException(message);
}

/**
 * Бронь гостиницы по телефону (DATA_MODEL VOICE-BOOKING-OWNER-APPROVAL-20261023). Ключи сверяются и здесь: без
 * `AUTH_REQUIRED=1` замок входа молчит. Общий служебный ключ сюда не входит.
 */
@Access('service')
@Controller('voice')
export class VoiceBookingController {
  constructor(
    @Inject(VoiceBookingService) private readonly service: VoiceBookingService,
    @Inject(VoiceBeautyService) private readonly beauty: VoiceBeautyService,
    @Inject(VoiceBookingRouter) private readonly router: VoiceBookingRouter,
  ) {}

  @Get('availability')
  @Header('Cache-Control', 'no-store')
  availability(@Req() request: ServiceRequest, @Query() query: Record<string, string>) {
    requireKey(request, 'voice-ingest');
    return this.service.availability(query);
  }

  /** Салон: услуги филиала и мастера, которые их оказывают */
  @Get('beauty-catalog')
  @Header('Cache-Control', 'no-store')
  beautyCatalog(@Req() request: ServiceRequest, @Query() query: Record<string, string>) {
    requireKey(request, 'voice-ingest');
    return this.beauty.catalog(query);
  }

  /** Салон: свободные окна услуги на дату, у любого мастера или у названного */
  @Get('beauty-slots')
  @Header('Cache-Control', 'no-store')
  beautySlots(@Req() request: ServiceRequest, @Query() query: Record<string, string>) {
    requireKey(request, 'voice-ingest');
    return this.beauty.slots(query);
  }

  @Post('booking-quotes')
  @Header('Cache-Control', 'no-store')
  quote(@Req() request: ServiceRequest, @Body() body: unknown) {
    requireKey(request, 'voice-book');
    return this.router.quote(body);
  }

  @Post('booking-quotes/confirm')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  confirm(@Req() request: ServiceRequest, @Body() body: unknown) {
    requireKey(request, 'voice-book');
    return this.router.confirm(body);
  }
}
