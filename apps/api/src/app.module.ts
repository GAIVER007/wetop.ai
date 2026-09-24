import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AccountsModule } from './accounts/accounts.module';
import { AiSellerModule } from './ai-seller/ai-seller.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AssistantModule } from './assistant/assistant.module';
import { AuthModule } from './auth/auth.module';
import { SessionGuard } from './auth/auth.guard';
import { AuthorInterceptor } from './auth/author.interceptor';
import { AuditModule } from './audit/audit.module';
import { ChannelsModule } from './channels/channels.module';
import { ChessboardModule } from './chessboard/chessboard.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DeskModule } from './desk/desk.module';
import { FinanceModule } from './finance/finance.module';
import { FreshnessModule } from './freshness/freshness.module';
import { GuardModule } from './guard/guard.module';
import { HealthModule } from './health/health.module';
import { GuestsModule } from './guests/guests.module';
import { InventoryModule } from './inventory/inventory.module';
import { HotelModule } from './hotel/hotel.module';
import { RatesModule } from './rates/rates.module';
import { ReservationsModule } from './reservations/reservations.module';
import { UnitsModule } from './units/units.module';
import { WebBookingModule } from './web-booking/web-booking.module';
import { DataConnectionModule } from './database/connection';

@Module({
  imports: [
    // Проверка живости для Docker и туннеля: без входа, SELECT 1 (plans/server-kz-2026-09-18.md)
    HealthModule,
    DataConnectionModule,
    // Два способа входа живут рядом, пока владелец не выбрал (Q-146): пароль — AuthModule (ADR-049),
    // одноразовый код на почту — AccountsModule (ADR-046).
    AuthModule,
    AccountsModule,
    InventoryModule,
    HotelModule,
    ChessboardModule,
    ReservationsModule,
    ChannelsModule,
    RatesModule,
    UnitsModule,
    GuestsModule,
    AuditModule,
    FinanceModule,
    DeskModule,
    DashboardModule,
    AnalyticsModule,
    WebBookingModule,
    GuardModule,
    FreshnessModule,
    // ИИ-помощник: подпись вошедшего для виджета, журнал ошибок человека (ТЗ ред. 1, ADR-079)
    AssistantModule,
    // Раздел «ИИ-продавец»: профиль, прокси к продавцу, применение и сверка (ТЗ ред. 1, ADR-079)
    AiSellerModule,
  ],
  // Замок непубличных маршрутов. Молчит, пока не задан AUTH_REQUIRED=1 (auth.guard.ts)
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    // автор действия в журнале берётся из сессии (request-context.ts)
    { provide: APP_INTERCEPTOR, useClass: AuthorInterceptor },
  ],
})
export class AppModule {}
