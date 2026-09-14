import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { AuditService } from './audit.module';

/**
 * Журнал действий (волна 3, plans/wetop-domain-2026-09-14.md §7.3). Поиск шёл в браузере по последним 200 строкам, а
 * синхронизация Exely пишет `exely.sync` каждые 5 минут — это ~17 часов, и вкладка «История» брони была пустой.
 */
function fakePrisma() {
  const calls: Array<{ where: Record<string, unknown>; take: number }> = [];
  const prisma = {
    db: {
      auditLog: {
        async findMany(args: { where: Record<string, unknown>; take: number }) {
          calls.push(args);
          return [];
        },
      },
    },
  } as unknown as PrismaService;
  return { service: new AuditService(prisma), calls };
}

describe('AuditService.list', () => {
  it('ищет номер брони или код ячейки в базе по всей истории, а не в последних 200 строках', async () => {
    const { service, calls } = fakePrisma();
    await service.list({ limit: 200, q: '20260914-513903-1263744450' });
    const where = JSON.stringify(calls[0]!.where);
    for (const key of ['confirmationNumber', 'code', 'uniqueId']) expect(where).toContain(key);
    expect(where).toContain('20260914-513903-1263744450');
  });

  it('служебные строки синхронизации Exely по умолчанию скрыты, по запросу — показаны', async () => {
    const { service, calls } = fakePrisma();
    await service.list({ limit: 200 });
    expect(JSON.stringify(calls[0]!.where)).toContain('exely.sync');
    await service.list({ limit: 200, system: true });
    expect(JSON.stringify(calls[1]!.where)).not.toContain('exely.sync');
  });
});
