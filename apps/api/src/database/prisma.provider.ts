import 'reflect-metadata';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type Db } from '@pms/database';
import { attachAuthor, currentUserId, databaseTenant } from '../auth/request-context';

export const DB = Symbol('DB');

/** Общий клиент на процесс: каждый модуль Nest получает свой PrismaService, но пул соединений один. */
let shared: { db: Db; refs: number } | null = null;

/**
 * Записи журнала подписываются автором сами: `auditLog.create` берёт вошедшего из контекста запроса
 * (ADR-023, DATA_MODEL §13 шаг 1). Явно переданный `userId` сильнее — его не перебиваем.
 */
function withAuthor(db: Db): Db {
  return db.$extends({
    query: {
      auditLog: {
        create({ args, query }) {
          return query(attachAuthor(args, currentUserId()));
        },
      },
    },
  }) as unknown as Db;
}

/** Один PrismaClient на процесс; строку подключения читает программа из окружения (SECURITY.md §3). */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly db: Db;
  constructor() {
    // RLS (DATA_MODEL §17, ADR-103): запросы организации — ролью wetop_app по DATABASE_APP_URL; пока её нет — прежняя роль
    if (!shared)
      shared = {
        db: withAuthor(
          createPrismaClient(undefined, undefined, {
            of: databaseTenant,
            appConnectionString: process.env.DATABASE_APP_URL,
          }),
        ),
        refs: 0,
      };
    shared.refs += 1;
    this.db = shared.db;
  }
  async onModuleDestroy(): Promise<void> {
    if (!shared) return;
    shared.refs -= 1;
    if (shared.refs <= 0) {
      const db = shared.db;
      shared = null;
      await db.$disconnect();
    }
  }
}
