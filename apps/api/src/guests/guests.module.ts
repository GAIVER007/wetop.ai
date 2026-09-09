import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { GuestsController } from './guests.controller';
import { GUESTS_REPOSITORY, PrismaGuestsRepository } from './guests.repository';
import { GuestsService } from './guests.service';

@Module({
  controllers: [GuestsController],
  providers: [
    PrismaService,
    GuestsService,
    { provide: GUESTS_REPOSITORY, useClass: PrismaGuestsRepository },
  ],
})
export class GuestsModule {}
