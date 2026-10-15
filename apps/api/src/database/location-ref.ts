import type { Db } from '@pms/database';
import type { BusinessVertical } from '@pms/domain';

/**
 * Location — филиал бизнеса партнёра (Platform P1, ADR-104, DATA_MODEL §18.2; Q-199 — вариант Б).
 * Цепочка владения: Organization → Business → Location → Property; canonical vertical живёт ТОЛЬКО
 * на Business — здесь он отдаётся из связки, на филиале не хранится (§18.3).
 *
 * Резолвер повторяет устройство property-ref: один рейс в базу на процесс, ключ памяти — организация
 * плюс схема базы (ADR-042: прогон в pms_test не должен получить id рабочих данных). Путь к объекту
 * и филиалу один — эта цепочка; прежний путь по `properties.organization_id` снят после production
 * backfill (broken_chain = 0, DATA_MODEL v2.6). Отказ не запоминается: у организации ещё может не быть
 * филиала (заведена без объекта), а заведённый позже следующий запрос увидит.
 */
export interface LocationRef {
  id: string;
  businessId: string;
  /** Canonical vertical — с Business (§18.1), на филиале не хранится */
  vertical: BusinessVertical;
  name: string;
  timezone: string;
  currency: string;
}

const cache = new Map<string, LocationRef>();
const schema = (): string => process.env.DATABASE_SCHEMA?.trim() || 'public';

/**
 * Филиал организации через её Business. `null` — у организации нет ни одного филиала (заведена без объекта). Самый ранний — тем же порядком, что выбор объекта (аудит 26.09, С-2):
 * выбор не зависит от порядка строк и не перехватывается созданным позже.
 */
export async function organizationLocationRef(
  db: Db,
  organizationId: string,
): Promise<LocationRef | null> {
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
