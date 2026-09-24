import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';

/** ИИ-помощник в стойке (ТЗ ред. 1, ADR-075): подпись вошедшего для виджета */
@Module({
  controllers: [AssistantController],
})
export class AssistantModule {}
