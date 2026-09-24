import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { UserErrorRecord, UserErrorsRepository } from './user-errors.repository';
import { UserErrorsRetentionService } from './user-errors-retention.service';

/** Журнал ошибок человека хранится 30 суток (DATA_MODEL §14): уборка раз в сутки после 04:00 Алматы */

class Repo implements UserErrorsRepository {
  cutoffs: Date[] = [];
  async record(): Promise<void> {}
  async list(): Promise<UserErrorRecord[]> {
    return [];
  }
  async deleteBefore(cutoff: Date): Promise<number> {
    this.cutoffs.push(cutoff);
    return 3;
  }
}

describe('UserErrorsRetentionService', () => {
  it('до 04:00 по Алматы не чистит', async () => {
    const repo = new Repo();
    const service = new UserErrorsRetentionService(repo);
    // 22:30 UTC = 03:30 Алматы
    const run = await service.runIfDue(new Date('2026-09-24T22:30:00Z'));
    expect(run.ran).toBe(false);
    expect(repo.cutoffs).toHaveLength(0);
  });

  it('после 04:00 удаляет строки старше 30 суток — один раз за местные сутки', async () => {
    const repo = new Repo();
    const service = new UserErrorsRetentionService(repo);
    // 23:10 UTC = 04:10 Алматы 25.09
    const now = new Date('2026-09-24T23:10:00Z');
    const run = await service.runIfDue(now);
    expect(run).toEqual({ ran: true, deleted: 3, cutoff: '2026-08-25T23:10:00.000Z' });
    expect(repo.cutoffs.map((d) => d.toISOString())).toEqual(['2026-08-25T23:10:00.000Z']);

    const again = await service.runIfDue(new Date('2026-09-25T05:00:00Z'));
    expect(again.ran).toBe(false);
    expect(repo.cutoffs).toHaveLength(1);
  });
});
