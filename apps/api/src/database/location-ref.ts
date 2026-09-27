import type { Db } from '@pms/database';

/**
 * Location — точка бизнеса организации (Phase 2, ADR-100 §17.1, DATA_MODEL v2.2 §17.6).
 *
 * Резолвер повторяет устройство property-ref: один рейс в базу на процесс, ключ памяти — организация
 * плюс схема базы (ADR-042: прогон в pms_test не должен получить id рабочих данных). Отказ не
 * запоминается: до применения миграции Phase 2 таблица `locations` пуста, и стойка живёт прежним
 * путём по `properties.organization_id` — как только Location появится, следующий запрос её увидит.
 */
export interface LocationRef {
  id: string;
  organizationId: string;
  /** Денормализованная неизменяемая копия (каноническое хранилище — Business, Phase 2.5) */
  vertical: 'HOSPITALITY' | 'BEAUTY';
  name: string;
  timezone: string;
  currency: string;
}

const cache = new Map<string, LocationRef>();
const schema = (): string => process.env.DATABASE_SCHEMA?.trim() || 'public';

/**
 * Location организации. `null` — у организации ещё нет Location (миграция Phase 2 не применена или
 * организация ещё не прошла онбординг). Самая ранняя — тем же порядком, что выбор объекта (аудит 26.09, С-2):
 * выбор не зависит от порядка строк и не перехватывается созданной позже.
 */
export async function organizationLocationRef(db: Db, organizationId: string): Promise<LocationRef | null> {
  const key = `${schema()}|org|${organizationId}`;
  const known = cache.get(key);
  if (known) return known;
  const found = await db.location.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, organizationId: true, vertical: true, name: true, timezone: true, currency: true },
  });
  if (!found) return null;
  cache.set(key, found);
  return found;
}

/** Забыть запомненное: тесты и случай, когда точку пересоздали. */
export function forgetLocationRef(): void {
  cache.clear();
}
