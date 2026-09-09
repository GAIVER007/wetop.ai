import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ChessboardModule } from './chessboard/chessboard.module';
import { InventoryModule } from './inventory/inventory.module';

@Module({ imports: [InventoryModule, ChessboardModule] })
export class AppModule {}
