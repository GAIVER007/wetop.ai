import 'reflect-metadata';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type Db } from '@pms/database';

export const DB = Symbol('DB');

/** Один PrismaClient на процесс; строку подключения читает программа из окружения (SECURITY.md §3). */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly db: Db;
  constructor() {
    this.db = createPrismaClient();
  }
  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect();
  }
}
