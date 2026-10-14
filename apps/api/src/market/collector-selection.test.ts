import { describe, expect, it, vi } from 'vitest';
import { PrismaMarketRepository } from './market.repository';
import type { PrismaService } from '../database/prisma.provider';

describe('выбор соседей для автоматического сбора загрузки', () => {
  it('список учитывает включённое автообновление и исключает мониторинг только цен', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaMarketRepository({ db: { competitor: { findMany } } } as unknown as PrismaService);
    await repo.collectorTargets();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      active: true, autoRefresh: true, monitoring: { in: ['OCCUPANCY', 'BOTH'] },
    } }));
  });
  it('адресная запись сохраняет проверку действующего конкурента', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaMarketRepository({ db: { competitor: { findMany } } } as unknown as PrismaService);
    await repo.collectorTarget('test-id');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'test-id', active: true } }));
  });
});
