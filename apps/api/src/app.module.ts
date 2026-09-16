import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AnalyticsModule } from './analytics/analytics.module';
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
    DataConnectionModule,
    AuthModule,
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
  ],
  // Замок непубличных маршрутов. Молчит, пока не задан AUTH_REQUIRED=1 (auth.guard.ts)
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    // автор действия в журнале берётся из сессии (request-context.ts)
    { provide: APP_INTERCEPTOR, useClass: AuthorInterceptor },
  ],
})
export class AppModule {}
