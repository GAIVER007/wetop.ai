import 'reflect-metadata';
import {
  Inject,
  Injectable,
  Module,
  type MiddlewareConsumer,
  type NestMiddleware,
  type NestModule,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { hostMatches, normalizeHost } from '@pms/domain';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ANALYTICS_REPOSITORY, type AnalyticsRepository } from '../analytics/analytics.repository';
import { PrismaService } from '../database/prisma.provider';
import { INCIDENTS_REPOSITORY, PrismaIncidentsRepository } from '../guard/incidents.repository';
import { PlatformModule } from '../platform/platform.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { BOOKING_MAILER, bookingMailerFromEnv } from './booking-mailer';
import { BotBookingController } from './bot-booking.controller';
import { BookingIntentsService } from './booking-intents.service';
import { BotQuoteController } from './bot-quote.controller';
import { TurnstileService } from './turnstile';
import { WebBookingController } from './web-booking.controller';
import { WebBookingService, appDemoHost } from './web-booking.service';

const HOSTS_CACHE_MS = 30_000;

function hostOf(origin: string): string | null {
  try {
    return normalizeHost(new URL(origin).hostname);
  } catch {
    return null;
  }
}

/** Формы сайта (SITE-4, SITE-5): `/w/beauty/*`, `/w/food/*`, `/w/lead` */
const SITE_FORM_PATH = /^\/w\/(beauty\/|food\/|lead(\/|$|\?))/;
function isSiteFormPath(req: Request): boolean {
  return SITE_FORM_PATH.test(req.originalUrl ?? req.url ?? '');
}

/**
 * CORS для `/w/*`: виджет на сайте шлёт JSON — браузер делает preflight. Разрешаем только домены
 * активных сайтов (и свой хост — демо-страница); чужому Origin заголовков не даём, preflight — 204 всегда.
 */
@Injectable()
export class WidgetCorsMiddleware implements NestMiddleware {
  private cache: { hosts: string[]; formHosts: string[]; at: number } | null = null;
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly sites: AnalyticsRepository) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const origin = req.headers.origin;
    if (origin) {
      const originHost = hostOf(origin);
      const own = req.headers.host ? normalizeHost(req.headers.host) : null;
      const app = appDemoHost();
      const allowed =
        !!originHost &&
        (originHost === own ||
          // демо брони внутри стойки (`/website/booking/demo`): только пути виджета гостиницы, не формы сайтов
          (!isSiteFormPath(req) && !!app && normalizeHost(originHost) === app) ||
          hostMatches(await this.hosts(isSiteFormPath(req)), originHost));
      if (allowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '600');
      }
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  }

  private async hosts(form: boolean): Promise<string[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < HOSTS_CACHE_MS) return form ? this.cache.formHosts : this.cache.hosts;
    // MKT1B BOOK-1: сайты ВСЕХ организаций. Публичный путь не знает вошедшего, и `sites()` (объект вошедшего или объект
    // установки) отдавал браузеру второй гостиницы ответ без Access-Control-Allow-Origin. Это только допуск браузера:
    // ключ сайта и точный домен по-прежнему проверяет `bookingSite`.
    const sites = await this.sites.allSites().catch(() => []);
    const hosts = sites
      .filter((s) => s.status === 'ACTIVE' && s.bookingEnabled)
      .flatMap((s) => s.hosts);
    // SITE-4, SITE-5: формы записи, брони стола и заявки шлёт любой действующий сайт (салон, ресторан, гостиница без
    // виджета брони); домен и ключ сайта по-прежнему проверяет сервис формы
    const formHosts = sites.filter((s) => s.status === 'ACTIVE').flatMap((s) => s.hosts);
    this.cache = { hosts, formHosts, at: now };
    return form ? formHosts : hosts;
  }
}

/** Бронирование с сайта (срез 9): тот же «сайт», что у счётчика, брони — через ReservationsService. */
@Module({
  // PlatformModule: расширение «ИИ-продавец» для брони из чата (Д9)
  imports: [AnalyticsModule, ReservationsModule, PlatformModule],
  controllers: [WebBookingController, BotQuoteController, BotBookingController],
  providers: [
    PrismaService,
    WebBookingService,
    // ADR-144, DATA_MODEL §25: бронь из чата ИИ-продавца
    BookingIntentsService,
    TurnstileService,
    WidgetCorsMiddleware,
    // ADR-144: письмо гостю с подтверждением; без настроенной почты — null, бронь идёт без письма
    { provide: BOOKING_MAILER, useFactory: () => bookingMailerFromEnv() },
    // журнал неисправностей для алерта С-7 (booking.flood): своя привязка порта, без всего GuardModule
    { provide: INCIDENTS_REPOSITORY, useClass: PrismaIncidentsRepository },
  ],
  // голосовая бронь гостиницы (DATA_MODEL VOICE-BOOKING-OWNER-APPROVAL-20261023) считает цены и места тем же путём
  exports: [WebBookingService, BookingIntentsService],
})
export class WebBookingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(WidgetCorsMiddleware).forRoutes('w/*path');
  }
}
