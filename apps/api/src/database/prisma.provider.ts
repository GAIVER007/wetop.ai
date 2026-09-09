import 'reflect-metadata';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type Db } from '@pms/database';

export const DB = Symbol('DB');

/** Общий клиент на процесс: каждый модуль Nest получает свой PrismaService, но пул соединений один. */
let shared: { db: Db; refs: number } | null = null;

/** Один PrismaClient на процесс; строку подключения читает программа из окружения (SECURITY.md §3). */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly db: Db;
  constructor() {
    if (!shared) shared = { db: createPrismaClient(), refs: 0 };
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
