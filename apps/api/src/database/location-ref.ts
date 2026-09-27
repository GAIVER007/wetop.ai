import type { Db } from '@pms/database';

/**
 * Location — филиал бизнеса партнёра (Platform P1, ADR-104, DATA_MODEL §18.2; Q-199 — вариант Б).
 * Цепочка владения: Organization → Business → Location → Property; canonical vertical живёт ТОЛЬКО
 * на Business — здесь он отдаётся из связки, на филиале не хранится (§18.3).
 *
 * Резолвер повторяет устройство property-ref: один рейс в базу на процесс, ключ памяти — организация
 * плюс схема базы (ADR-042: прогон в pms_test не должен получить id рабочих данных). Отказ не
 * запоминается: до применения миграции Platform P1 таблиц нет, и стойка живёт прежним путём по
 * `properties.organization_id` — как только цепочка появится, следующий запрос её увидит.
 */
export interface LocationRef {
  id: string;
  businessId: string;
  /** Canonical vertical — с Business (§18.1), на филиале не хранится */
  vertical: 'HOSPITALITY' | 'BEAUTY';
  name: string;
  timezone: string;
  currency: string;
}

const cache = new Map<string, LocationRef>();
const schema = (): string => process.env.DATABASE_SCHEMA?.trim() || 'public';

/**
 * Филиал организации через её Business. `null` — цепочки ещё нет (миграция Platform P1 не применена или
 * организация не прошла онбординг). Самый ранний — тем же порядком, что выбор объекта (аудит 26.09, С-2):
 * выбор не зависит от порядка строк и не перехватывается созданным позже.
 */
export async function organizationLocationRef(db: Db, organizationId: string): Promise<LocationRef | null> {
  const key = `${schema()}|org|${organizationId}`;
  const known = cache.get(key);
  if (known) return known;
  const found = await db.location.findFirst({
    where: { business: { organizationId } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      businessId: true,
      name: true,
      timezone: true,
      currency: true,
      business: { select: { vertical: true } },
    },
  });
  if (!found) return null;
  const ref: LocationRef = {
    id: found.id,
    businessId: found.businessId,
    vertical: found.business.vertical,
    name: found.name,
    timezone: found.timezone,
    currency: found.currency,
  };
  cache.set(key, ref);
  return ref;
}

/** Забыть запомненное: тесты и случай, когда филиал пересоздали. */
export function forgetLocationRef(): void {
  cache.clear();
}
