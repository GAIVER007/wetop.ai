import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { UserErrorsModule } from './user-errors.module';
import { UserErrorsRetentionService } from './user-errors-retention.service';

/**
 * ИИ-помощник в стойке (ТЗ ред. 1, ADR-079): подпись вошедшего для виджета (П1) и уборка журнала ошибок человека
 * (П3) — сам журнал пишет фильтр ошибок сторожа.
 */
@Module({
  imports: [UserErrorsModule],
  controllers: [AssistantController],
  providers: [UserErrorsRetentionService],
})
export class AssistantModule {}
