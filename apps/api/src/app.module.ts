import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ChannelsModule } from './channels/channels.module';
import { ChessboardModule } from './chessboard/chessboard.module';
import { InventoryModule } from './inventory/inventory.module';
import { RatesModule } from './rates/rates.module';
import { ReservationsModule } from './reservations/reservations.module';

@Module({
  imports: [InventoryModule, ChessboardModule, ReservationsModule, ChannelsModule, RatesModule],
})
export class AppModule {}
