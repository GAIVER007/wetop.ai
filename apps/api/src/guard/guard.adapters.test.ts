import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { NestGuardProbes } from './guard.adapters';

/** Фальшивая Prisma: последняя запись журнала по действию (и trigger у полной выгрузки) */
function prismaWith(rows: Array<{ action: string; trigger?: string; createdAt: string }>) {
  const findFirst = async ({ where }: { where: { action: string; after?: unknown } }) => {
    const hit = rows
      .filter((r) => r.action === where.action && (!where.after || r.trigger === 'import'))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return hit ? { createdAt: new Date(hit.createdAt) } : null;
  };
  return { db: { auditLog: { findFirst } } };
}
const probes = (prisma: unknown) =>
  new NestGuardProbes(prisma as never, {} as never, {} as never, {} as never, {} as never);

describe('NestGuardProbes.lastExelySyncAt (exely.stale)', () => {
  it('автосинхронизация без изменений полную выгрузку не делает — время берётся из записи exely.sync (ADR-032)', async () => {
    const at = await probes(
      prismaWith([
        { action: 'channex.fullSync', trigger: 'import', createdAt: '2026-09-13T08:59:58Z' },
        { action: 'exely.sync', createdAt: '2026-09-13T17:30:00Z' },
      ]),
    ).lastExelySyncAt();
    expect(at?.toISOString()).toBe('2026-09-13T17:30:00.000Z');
  });

  it('прогоны до автосинхронизации по-прежнему видны по полной выгрузке с trigger=import', async () => {
    const at = await probes(
      prismaWith([
        { action: 'channex.fullSync', trigger: 'manual', createdAt: '2026-09-13T12:22:55Z' },
        { action: 'channex.fullSync', trigger: 'import', createdAt: '2026-09-13T08:59:58Z' },
      ]),
    ).lastExelySyncAt();
    expect(at?.toISOString()).toBe('2026-09-13T08:59:58.000Z');
  });

  it('синхронизаций не было — null', async () => {
    expect(await probes(prismaWith([])).lastExelySyncAt()).toBeNull();
  });
});
