import { ConflictException, HttpException } from '@nestjs/common';
import { GENERATION_ERROR_TEXT, SITE_AI_REQUESTS_PER_HOUR, utcDayStart } from '@pms/domain';
import type { DbTx } from '@pms/database';

/**
 * Общие правила ИИ сайта (MKT9.2, Q-274, Q-279) для сборки (`generation_runs`) и разговора (`site_ai_runs`) вместе:
 * - одна активная задача ИИ на сайт, какой бы режим ни был (проверка под замком строки сайта);
 * - 10 запросов в час на человека в организации на все режимы;
 * - один дневной пул токенов организации на обе таблицы (кэш уже часть входа и второй раз не считается);
 * - неизвестный расход за сутки UTC останавливает ИИ сайта организации до следующих суток.
 * Запросы идут и под ролью приложения (RLS режет по организации), и служебным путём воркера.
 */
type Db = Pick<DbTx, '$queryRaw'>;


export const AI_BUSY = 'ИИ уже работает над этим сайтом: дождитесь результата';

export async function assertNoActiveSiteAi(tx: Db, siteId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ n: number }>>`
    SELECT (SELECT count(*) FROM generation_runs WHERE site_id = ${siteId}::uuid AND status IN ('QUEUED', 'RUNNING'))::int
         + (SELECT count(*) FROM site_ai_runs WHERE site_id = ${siteId}::uuid AND status IN ('QUEUED', 'RUNNING'))::int AS n`;
  if ((rows[0]?.n ?? 0) > 0) throw new ConflictException({ code: 'AI_BUSY', message: AI_BUSY });
}

/** Запросы человека к ИИ сайтов этой организации за последний час, обе таблицы */
export async function assertHourlyLimit(tx: Db, userId: string | null, organizationId: string, now: Date): Promise<void> {
  if (!userId) return;
  const since = new Date(now.getTime() - 3_600_000);
  const rows = await tx.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM (
      SELECT r.site_id FROM generation_runs r WHERE r.requested_by_id = ${userId}::uuid AND r.created_at > ${since}
      UNION ALL
      SELECT a.site_id FROM site_ai_runs a WHERE a.requested_by_id = ${userId}::uuid AND a.created_at > ${since}
    ) q
    JOIN marketing_sites s ON s.id = q.site_id
    JOIN locations l ON l.id = s.location_id
    JOIN businesses b ON b.id = l.business_id
   WHERE b.organization_id = ${organizationId}::uuid`;
  if ((rows[0]?.n ?? 0) >= SITE_AI_REQUESTS_PER_HOUR)
    throw new HttpException({ code: 'RATE_LIMITED', message: 'Лимит запросов к ИИ сайта за час исчерпан. Попробуйте позже.' }, 429);
}

/** Расход дня организации по обеим таблицам и был ли за сутки неизвестный расход (Q-279) */
export async function siteAiDay(tx: Db, organizationId: string, at: Date): Promise<{ spent: number; unknown: boolean }> {
  const from = utcDayStart(at);
  const to = new Date(from.getTime() + 86_400_000);
  const rows = await tx.$queryRaw<Array<{ spent: bigint | number | null; unknown: boolean | null }>>`
    SELECT COALESCE(SUM(COALESCE(q.tokens_input, 0) + COALESCE(q.tokens_output, 0)), 0) AS spent,
           COALESCE(bool_or(q.error_code = 'USAGE_UNAVAILABLE'), false) AS unknown
      FROM (
        SELECT site_id, tokens_input, tokens_output, error_code FROM generation_runs WHERE started_at >= ${from} AND started_at < ${to}
        UNION ALL
        SELECT site_id, tokens_input, tokens_output, error_code FROM site_ai_runs WHERE started_at >= ${from} AND started_at < ${to}
      ) q
      JOIN marketing_sites s ON s.id = q.site_id
      JOIN locations l ON l.id = s.location_id
      JOIN businesses b ON b.id = l.business_id
     WHERE b.organization_id = ${organizationId}::uuid`;
  return { spent: Number(rows[0]?.spent ?? 0), unknown: rows[0]?.unknown === true };
}

/** Q-279 при постановке: неизвестный расход сегодня, новые запросы до следующих суток UTC не ставятся */
export async function assertUsageKnown(tx: Db, organizationId: string, now: Date): Promise<void> {
  if ((await siteAiDay(tx, organizationId, now)).unknown)
    throw new ConflictException({ code: 'USAGE_UNAVAILABLE', message: GENERATION_ERROR_TEXT.USAGE_UNAVAILABLE });
}
