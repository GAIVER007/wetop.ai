import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';

export const USER_ERRORS_REPOSITORY = Symbol('USER_ERRORS_REPOSITORY');

/** Строка журнала ошибок человека (DATA_MODEL §14). Всё, что пишется, уже прошло маску домена */
export interface UserErrorRecord {
  at: Date;
  userId: string;
  organizationId: string;
  method: string;
  route: string;
  status: number;
  message: string;
  requestId: string;
}

export interface UserErrorsQuery {
  userId: string;
  organizationId: string;
  since: Date;
  limit: number;
}

/** Журнал ошибок, которые видит человек (ТЗ ред. 1, П3): пишет фильтр ошибок API, читает помощник (П4) */
export interface UserErrorsRepository {
  record(row: UserErrorRecord): Promise<void>;
  /** Ошибки этого человека в этой организации с даты, новые сверху */
  list(query: UserErrorsQuery): Promise<UserErrorRecord[]>;
  /** Уборка: удалить строки старше границы. Возвращает, сколько удалено */
  deleteBefore(cutoff: Date): Promise<number>;
}

@Injectable()
export class PrismaUserErrorsRepository implements UserErrorsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(row: UserErrorRecord): Promise<void> {
    await this.prisma.db.userError.create({ data: row });
  }

  async list(query: UserErrorsQuery): Promise<UserErrorRecord[]> {
    return this.prisma.db.userError.findMany({
      where: {
        userId: query.userId,
        organizationId: query.organizationId,
        at: { gte: query.since },
      },
      orderBy: { at: 'desc' },
      take: query.limit,
      select: {
        at: true,
        userId: true,
        organizationId: true,
        method: true,
        route: true,
        status: true,
        message: true,
        requestId: true,
      },
    });
  }

  async deleteBefore(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.db.userError.deleteMany({ where: { at: { lt: cutoff } } });
    return count;
  }
}
