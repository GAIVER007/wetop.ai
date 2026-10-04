import { WizardModule } from './wizard/wizard.module';
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AccountsModule } from './accounts/accounts.module';
import { AiSellerModule } from './ai-seller/ai-seller.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AssistantModule } from './assistant/assistant.module';
import { AuthModule } from './auth/auth.module';
import { SessionGuard } from './auth/auth.guard';
import { RoleGuard } from './auth/role.guard';
import { AuthorInterceptor } from './auth/author.interceptor';
import { PrismaService } from './database/prisma.provider';
import { AuditModule } from './audit/audit.module';
import { ChannelsModule } from './channels/channels.module';
import { ChessboardModule } from './chessboard/chessboard.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DeskModule } from './desk/desk.module';
import { FinanceModule } from './finance/finance.module';
import { MarketModule } from './market/market.module';
import { FreshnessModule } from './freshness/freshness.module';
import { GuardModule } from './guard/guard.module';
import { HealthModule } from './health/health.module';
import { GuestsModule } from './guests/guests.module';
import { InventoryModule } from './inventory/inventory.module';
import { BeautyModule } from './beauty/beauty.module';
import { HotelModule } from './hotel/hotel.module';
import { PlatformModule } from './platform/platform.module';
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
    // главный администратор: организации и их расширения (ADR-083)
    PlatformModule,
    InventoryModule,
    BeautyModule,
    HotelModule,
    ChessboardModule,
    ReservationsModule,
    ChannelsModule,
    RatesModule,
    UnitsModule,
    GuestsModule,
    AuditModule,
    FinanceModule,
    MarketModule,
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
    WizardModule,
  ],
  // Замок непубличных маршрутов. В боевом образе включён, пока не выключен явным AUTH_REQUIRED=0 (auth.guard.ts)
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    // Замок ролей — сразу за ним: право маршрута (@Access) против роли вошедшего (ADR-107, DATA_MODEL §16.5)
    { provide: APP_GUARD, useClass: RoleGuard },
    // автор действия в журнале берётся из сессии (request-context.ts); там же — scope запроса (Platform P2, К1),
    // ему нужна база: пул один на процесс, лишнего подключения нет
    PrismaService,
    { provide: APP_INTERCEPTOR, useClass: AuthorInterceptor },
  ],
})
export class AppModule {}
