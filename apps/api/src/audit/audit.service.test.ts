import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { AuditService } from './audit.module';

/**
 * Журнал действий (волна 3, plans/wetop-domain-2026-09-14.md §7.3). Поиск шёл в браузере по последним 200 строкам, а
 * синхронизация Exely пишет `exely.sync` каждые 5 минут — это ~17 часов, и вкладка «История» брони была пустой.
 */
function fakePrisma(rows: unknown[] = []) {
  const calls: Array<{ where: Record<string, unknown>; take: number; include?: unknown }> = [];
  const prisma = {
    db: {
      auditLog: {
        async findMany(args: { where: Record<string, unknown>; take: number; include?: unknown }) {
          calls.push(args);
          return rows;
        },
      },
    },
  } as unknown as PrismaService;
  return { service: new AuditService(prisma), calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'a-1',
  createdAt: new Date('2026-09-15T10:00:00Z'),
  entityType: 'Reservation',
  entityId: 'r-1',
  action: 'reservation.checkIn',
  before: null,
  after: { confirmationNumber: 'WT-1' },
  user: null,
  ...over,
});

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

/**
 * Автор действия (DATA_MODEL §13 шаг 1, ADR-046). ADR-023 обещал: «когда появится вход по пользователям,
 * к записи добавится, кто именно» — журнал должен это показывать, иначе записанный автор никому не виден.
 */
describe('AuditService.list — кто сделал', () => {
  it('отдаёт имя вошедшего рядом с действием', async () => {
    const { service } = fakePrisma([
      row({ user: { name: 'Айгуль Сеитова' } }),
    ]);
    const [entry] = await service.list({ limit: 10 });
    expect(entry).toMatchObject({ action: 'reservation.checkIn', author: 'Айгуль Сеитова' });
  });

  it('действие без автора — это система: импорт, сторож, скрипт сверки', async () => {
    const { service } = fakePrisma([row({ action: 'exely.sync', user: null })]);
    const [entry] = await service.list({ limit: 10, system: true });
    expect(entry!.author).toBeNull();
  });

  it('берёт из учётной записи только имя: почта сотрудника в журнал не выводится', async () => {
    const { service, calls } = fakePrisma([row({ user: { name: 'Айгуль Сеитова' } })]);
    const [entry] = await service.list({ limit: 10 });
    expect(entry!.author).toBe('Айгуль Сеитова');
    expect(JSON.stringify(calls[0]!.include)).toContain('name');
    expect(JSON.stringify(calls[0]!.include)).not.toContain('email');
  });

  it('действия с учётными записями видны как обычные строки журнала', async () => {
    const { service } = fakePrisma([
      row({ entityType: 'user', action: 'user.login', after: {}, user: { name: 'Дана Тестова' } }),
    ]);
    const [entry] = await service.list({ limit: 10 });
    expect(entry).toMatchObject({ entityType: 'user', action: 'user.login', author: 'Дана Тестова' });
  });
});
