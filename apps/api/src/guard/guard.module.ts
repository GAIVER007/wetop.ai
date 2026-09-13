import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaService } from '../database/prisma.provider';
import { ChannelsModule } from '../channels/channels.module';
import { ApiErrorFilter } from './api-error.filter';
import {
  NestGuardFixes,
  NestGuardProbes,
  heartbeatFromEnv,
  notifierFromEnv,
} from './guard.adapters';
import { GuardController } from './guard.controller';
import { ALERT_NOTIFIER, GUARD_FIXES, GUARD_HEARTBEAT, GUARD_PROBES } from './guard.ports';
import { GuardService } from './guard.service';
import { INCIDENTS_REPOSITORY, PrismaIncidentsRepository } from './incidents.repository';

/** Сторож системы и одно место для неисправностей (срез 11, ADR-028, DATA_MODEL §12). */
@Module({
  imports: [ChannelsModule],
  controllers: [GuardController],
  providers: [
    PrismaService,
    { provide: INCIDENTS_REPOSITORY, useClass: PrismaIncidentsRepository },
    { provide: GUARD_PROBES, useClass: NestGuardProbes },
    { provide: GUARD_FIXES, useClass: NestGuardFixes },
    { provide: ALERT_NOTIFIER, useFactory: notifierFromEnv },
    { provide: GUARD_HEARTBEAT, useFactory: heartbeatFromEnv },
    GuardService,
    { provide: APP_FILTER, useClass: ApiErrorFilter },
  ],
})
export class GuardModule {}
