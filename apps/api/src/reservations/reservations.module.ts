import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { PrismaService } from '../database/prisma.provider';
import { RatePlansController, ReservationsController } from './reservations.controller';
import { PrismaUnitOfWork, RESERVATIONS_UOW } from './reservations.repository';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [ChannelsModule],
  controllers: [ReservationsController, RatePlansController],
  providers: [
    PrismaService,
    ReservationsService,
    { provide: RESERVATIONS_UOW, useClass: PrismaUnitOfWork },
  ],
  // Виджет сайта (срез 9) создаёт брони тем же сервисом и читает доступность тем же репозиторием
  exports: [ReservationsService, RESERVATIONS_UOW],
})
export class ReservationsModule {}
