import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { PrismaService } from '../database/prisma.provider';
import { UnitsController } from './units.controller';
import { PrismaUnitsRepository, UNITS_REPOSITORY } from './units.repository';
import { UnitsService } from './units.service';

@Module({
  imports: [ChannelsModule],
  controllers: [UnitsController],
  providers: [
    PrismaService,
    UnitsService,
    { provide: UNITS_REPOSITORY, useClass: PrismaUnitsRepository },
  ],
})
export class UnitsModule {}
