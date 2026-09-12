import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { ChannelsModule } from './channels/channels.module';
import { ChessboardModule } from './chessboard/chessboard.module';
import { DeskModule } from './desk/desk.module';
import { FinanceModule } from './finance/finance.module';
import { GuestsModule } from './guests/guests.module';
import { InventoryModule } from './inventory/inventory.module';
import { RatesModule } from './rates/rates.module';
import { ReservationsModule } from './reservations/reservations.module';
import { UnitsModule } from './units/units.module';
import { WebBookingModule } from './web-booking/web-booking.module';

@Module({
  imports: [
    InventoryModule,
    ChessboardModule,
    ReservationsModule,
    ChannelsModule,
    RatesModule,
    UnitsModule,
    GuestsModule,
    AuditModule,
    FinanceModule,
    DeskModule,
    AnalyticsModule,
    WebBookingModule,
  ],
})
export class AppModule {}
