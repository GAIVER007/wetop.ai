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
import { ReservationsModule } from '../reservations/reservations.module';
import { BOOKING_MAILER, bookingMailerFromEnv } from './booking-mailer';
import { BotBookingController } from './bot-booking.controller';
import { BookingIntentsService } from './booking-intents.service';
import { BotQuoteController } from './bot-quote.controller';
import { TurnstileService } from './turnstile';
import { WebBookingController } from './web-booking.controller';
import { WebBookingService } from './web-booking.service';

const HOSTS_CACHE_MS = 30_000;

function hostOf(origin: string): string | null {
  try {
    return normalizeHost(new URL(origin).hostname);
  } catch {
    return null;
  }
}

/**
 * CORS для `/w/*`: виджет на сайте шлёт JSON — браузер делает preflight. Разрешаем только домены
 * активных сайтов (и свой хост — демо-страница); чужому Origin заголовков не даём, preflight — 204 всегда.
 */
@Injectable()
export class WidgetCorsMiddleware implements NestMiddleware {
  private cache: { hosts: string[]; at: number } | null = null;
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly sites: AnalyticsRepository) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const origin = req.headers.origin;
    if (origin) {
      const originHost = hostOf(origin);
      const own = req.headers.host ? normalizeHost(req.headers.host) : null;
      const allowed =
        !!originHost && (originHost === own || hostMatches(await this.hosts(), originHost));
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

  private async hosts(): Promise<string[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < HOSTS_CACHE_MS) return this.cache.hosts;
    const sites = await this.sites.sites().catch(() => []);
    const hosts = sites
      .filter((s) => s.status === 'ACTIVE' && s.bookingEnabled)
      .flatMap((s) => s.hosts);
    this.cache = { hosts, at: now };
    return hosts;
  }
}

/** Бронирование с сайта (срез 9): тот же «сайт», что у счётчика, брони — через ReservationsService. */
@Module({
  imports: [AnalyticsModule, ReservationsModule],
  controllers: [WebBookingController, BotQuoteController, BotBookingController],
  providers: [
    PrismaService,
    WebBookingService,
    // ADR-143, DATA_MODEL §25: бронь из чата ИИ-продавца
    BookingIntentsService,
    TurnstileService,
    WidgetCorsMiddleware,
    // ADR-143: письмо гостю с подтверждением; без настроенной почты — null, бронь идёт без письма
    { provide: BOOKING_MAILER, useFactory: () => bookingMailerFromEnv() },
    // журнал неисправностей для алерта С-7 (booking.flood): своя привязка порта, без всего GuardModule
    { provide: INCIDENTS_REPOSITORY, useClass: PrismaIncidentsRepository },
  ],
})
export class WebBookingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(WidgetCorsMiddleware).forRoutes('w/*path');
  }
}
