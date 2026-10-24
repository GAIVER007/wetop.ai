import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Ip,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { normalizeHost } from '@pms/domain';
import { AnalyticsModule } from '../analytics/analytics.module';
import { Access } from '../auth/access.decorator';
import { Public } from '../auth/public.decorator';
import { SCOPE_HEADER } from '../auth/scope';
import { PrismaService } from '../database/prisma.provider';
import { clientIp } from '../web-booking/client-ip';
import { TurnstileService } from '../web-booking/turnstile';
import type { RequestContext } from '../web-booking/web-booking.service';
import { SiteFormsService } from './site-forms.service';
import { SiteLeadsService } from './site-leads.service';

function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return normalizeHost(new URL(value).hostname);
  } catch {
    return null;
  }
}

function context(
  socketIp: string,
  h: { cf?: string | undefined; origin?: string | undefined; referer?: string | undefined; host?: string | undefined },
): RequestContext {
  return {
    originHost: hostOf(h.origin) ?? hostOf(h.referer),
    ownHost: h.host ? normalizeHost(h.host) : null,
    ip: clientIp(socketIp, h.cf) ?? null,
  };
}

/**
 * Публичные формы управляемого сайта (SITE-4, SITE-5; ADR-185): запись к мастеру, бронь стола, «Перезвоните мне».
 * Входа не требуют (SECURITY.md §11), как `/w/book`: ключ сайта, домен, Turnstile, лимиты и ключ запроса.
 * Контракты: `docs/marketing/site-forms-v0.md`. CORS для `/w/*` ставит `WidgetCorsMiddleware` модуля брони.
 */
@Public()
@Controller('w')
export class SiteFormsController {
  constructor(@Inject(SiteFormsService) private readonly forms: SiteFormsService) {}

  @Get('beauty/slots')
  beautySlots(
    @Query() query: Record<string, string>,
    @Ip() socketIp: string,
    @Headers('cf-connecting-ip') cf?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
    @Headers('host') host?: string,
  ) {
    return this.forms.beautySlots(query, context(socketIp, { cf, origin, referer, host }));
  }

  @Post('beauty/book')
  @HttpCode(201)
  beautyBook(
    @Body() body: unknown,
    @Ip() socketIp: string,
    @Headers('cf-connecting-ip') cf?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
    @Headers('host') host?: string,
  ) {
    return this.forms.beautyBook(body, context(socketIp, { cf, origin, referer, host }));
  }

  @Post('food/reserve')
  @HttpCode(201)
  foodReserve(
    @Body() body: unknown,
    @Ip() socketIp: string,
    @Headers('cf-connecting-ip') cf?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
    @Headers('host') host?: string,
  ) {
    return this.forms.foodReserve(body, context(socketIp, { cf, origin, referer, host }));
  }

  @Post('lead')
  @HttpCode(201)
  lead(
    @Body() body: unknown,
    @Ip() socketIp: string,
    @Headers('cf-connecting-ip') cf?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
    @Headers('host') host?: string,
  ) {
    return this.forms.lead(body, context(socketIp, { cf, origin, referer, host }));
  }
}

/** Заявки с сайта во «Входящих» стойки (SITE-5): список и статус, право `dialogs` */
@Controller('marketing/site/leads')
@Access('dialogs')
export class SiteLeadsController {
  constructor(@Inject(SiteLeadsService) private readonly leads: SiteLeadsService) {}

  @Get()
  list(
    @Headers(SCOPE_HEADER) pointer: string | undefined,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leads.list(!!pointer, { status, cursor, limit });
  }

  @Patch(':id')
  update(@Headers(SCOPE_HEADER) pointer: string | undefined, @Param('id') id: string, @Body() body: unknown) {
    return this.leads.update(!!pointer, id, body);
  }
}

@Module({
  imports: [AnalyticsModule],
  controllers: [SiteFormsController, SiteLeadsController],
  providers: [PrismaService, SiteFormsService, SiteLeadsService, TurnstileService],
  // голосовая запись в салон и бронь стола считают окна и пишут тем же путём (DATA_MODEL VOICE-BOOKING)
  exports: [SiteFormsService],
})
export class SiteFormsModule {}
