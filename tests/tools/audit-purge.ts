import type { Db } from '@pms/database';

/**
 * Уборка тестами СВОИХ строк журнала. С миграции `20260925000022_integrity_guards` (ТЗ аудита 25.09, С-14)
 * `audit_logs` только дописывается: DELETE проходит лишь с отметкой `wetop.audit_purge` в той же транзакции —
 * тот же путь, что у `cli-purge-test-data`. Обычному коду приложения этого помощника не давать.
 */
type AuditWhere = NonNullable<NonNullable<Parameters<Db['auditLog']['deleteMany']>[0]>['where']>;

export async function purgeAuditRows(db: Db, where: AuditWhere): Promise<number> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
    const r = await tx.auditLog.deleteMany({ where });
    return r.count;
  });
}
