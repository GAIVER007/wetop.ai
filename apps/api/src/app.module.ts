import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ChessboardModule } from './chessboard/chessboard.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReservationsModule } from './reservations/reservations.module';

@Module({ imports: [InventoryModule, ChessboardModule, ReservationsModule] })
export class AppModule {}
