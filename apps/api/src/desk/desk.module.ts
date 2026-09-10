import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { DeskController } from './desk.controller';
import { DESK_REPOSITORY, PrismaDeskRepository } from './desk.repository';
import { DeskService } from './desk.service';

@Module({
  controllers: [DeskController],
  providers: [
    PrismaService,
    DeskService,
    { provide: DESK_REPOSITORY, useClass: PrismaDeskRepository },
  ],
})
export class DeskModule {}
