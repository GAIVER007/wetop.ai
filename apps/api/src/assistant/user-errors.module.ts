import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { PrismaUserErrorsRepository, USER_ERRORS_REPOSITORY } from './user-errors.repository';

/**
 * Журнал ошибок, которые видит человек (DATA_MODEL §14, ТЗ ред. 1 П3). Отдельный модуль, потому что у журнала два
 * хозяина: пишет фильтр ошибок сторожа (`GuardModule`), читает и чистит помощник (`AssistantModule`).
 */
@Module({
  providers: [
    PrismaService,
    { provide: USER_ERRORS_REPOSITORY, useClass: PrismaUserErrorsRepository },
  ],
  exports: [USER_ERRORS_REPOSITORY],
})
export class UserErrorsModule {}
