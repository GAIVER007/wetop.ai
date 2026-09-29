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
import { ChannelsModule } from '../channels/channels.module';
import { DIAGNOSTICS_REPOSITORY, PrismaDiagnosticsRepository } from './diagnostics.repository';
import { DiagnosticsService } from './diagnostics.service';
import { AssistantActionsService, INTEGRATION_OWNER_CHECK } from './actions.service';
import { isIntegrationActor } from '../channels/integration-owner';

/**
 * ИИ-помощник в стойке (ТЗ ред. 1, ADR-079): подпись вошедшего для виджета (П1) и уборка журнала ошибок человека
 * (П3) — сам журнал пишет фильтр ошибок сторожа.
 */
@Module({
  // PlatformModule — ради ExtensionsService: карточка организации для техподдержки (С5)
  // ChannelsModule — ради снимка сторожа webhook в диагностике (S5); живых вызовов Channex отсюда нет
  imports: [UserErrorsModule, PlatformModule, ChannelsModule],
  controllers: [AssistantController],
  providers: [
    UserErrorsRetentionService,
    PrismaService,
    { provide: REQUESTER_CONTEXT_REPOSITORY, useClass: PrismaRequesterContextRepository },
    RequesterContextService,
    { provide: DIAGNOSTICS_REPOSITORY, useClass: PrismaDiagnosticsRepository },
    DiagnosticsService,
    // S6: действия — подтянуть ленту и полная выгрузка; «подключены ли каналы» — та же проверка, что у разделов каналов
    {
      provide: INTEGRATION_OWNER_CHECK,
      useFactory: (prisma: PrismaService) => (organizationId: string) =>
        isIntegrationActor(prisma, { organizationId }),
      inject: [PrismaService],
    },
    AssistantActionsService,
  ],
})
export class AssistantModule {}
