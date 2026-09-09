import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { ReservationsController } from './reservations.controller';
import { PrismaUnitOfWork, RESERVATIONS_UOW } from './reservations.repository';
import { ReservationsService } from './reservations.service';

@Module({
  controllers: [ReservationsController],
  providers: [
    PrismaService,
    ReservationsService,
    { provide: RESERVATIONS_UOW, useClass: PrismaUnitOfWork },
  ],
})
export class ReservationsModule {}
