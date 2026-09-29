import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { PlatformModule } from '../platform/platform.module';
import { UserErrorsModule } from './user-errors.module';
import { UserErrorsRetentionService } from './user-errors-retention.service';
import { PrismaService } from '../database/prisma.provider';
import {
  PrismaRequesterContextRepository,
  REQUESTER_CONTEXT_REPOSITORY,
} from './requester-context.repository';
import { RequesterContextService } from './requester-context.service';

/**
 * ИИ-помощник в стойке (ТЗ ред. 1, ADR-079): подпись вошедшего для виджета (П1) и уборка журнала ошибок человека
 * (П3) — сам журнал пишет фильтр ошибок сторожа.
 */
@Module({
  // PlatformModule — ради ExtensionsService: карточка организации для техподдержки (С5)
  imports: [UserErrorsModule, PlatformModule],
  controllers: [AssistantController],
  providers: [
    UserErrorsRetentionService,
    PrismaService,
    { provide: REQUESTER_CONTEXT_REPOSITORY, useClass: PrismaRequesterContextRepository },
    RequesterContextService,
  ],
})
export class AssistantModule {}
