import type { Db } from '@pms/database';
import { parseBusinessVertical } from '@pms/domain';
import type { BusinessVertical, RequestScope } from './request-context';

/**
 * Scope запроса (Platform P2, К1; план `plans/platform-p2-request-context-2026-09-27.md` §4–§5, ADR-120).
 *
 * Указатель выбора приходит заголовком `X-Wetop-Scope: business=<uuid>;location=<uuid>` (стойка пересылает куку
 * `wetop_scope`). Это намерение человека, а не право: API проверяет его на каждом запросе. Любой отказ — чужой,
 * несуществующий или архивный Business или филиал, филиал без Business, битый указатель — тихо даёт ORGANIZATION:
 * устаревшая кука не должна ронять каждый экран, а права она не расширяет. Под RLS те же выборки ещё и режет база.
 */
export const SCOPE_HEADER = 'x-wetop-scope';

export interface ScopePointer {
  businessId?: string;
  locationId?: string;
}

export interface ResolvedScope {
  scope: RequestScope;
  businessId?: string;
  locationId?: string;
  vertical?: BusinessVertical;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEYS = { business: 'businessId', location: 'locationId' } as const;

/** Разобрать заголовок. Не строка, чужой ключ, повтор ключа или не UUID — указателя нет целиком. */
export function parseScopePointer(header: string | string[] | undefined): ScopePointer {
  if (typeof header !== 'string' || !header.trim()) return {};
  const pointer: ScopePointer = {};
  for (const part of header.split(';')) {
    const [rawKey, rawValue, ...rest] = part.split('=');
    const key = rawKey?.trim() as keyof typeof KEYS;
    const value = rawValue?.trim() ?? '';
    const field = KEYS[key];
    if (!field || rest.length > 0 || !UUID.test(value) || pointer[field] !== undefined) return {};
    pointer[field] = value;
  }
  return pointer;
}

type ScopeDb = Pick<Db, 'business' | 'location'>;

/** Проверить указатель в организации вошедшего. Без указателя в базу не ходим. */
export async function resolveScope(
  db: ScopeDb,
  organizationId: string,
  pointer: ScopePointer,
): Promise<ResolvedScope> {
  const organization: ResolvedScope = { scope: 'ORGANIZATION' };
  // филиал без Business — неполный указатель
  if (!pointer.businessId) return organization;
  const business = await db.business.findFirst({
    where: { id: pointer.businessId, organizationId, status: 'ACTIVE' },
    select: { id: true, vertical: true },
  });
  if (!business || !parseBusinessVertical(business.vertical)) return organization;
  if (!pointer.locationId)
    return { scope: 'BUSINESS', businessId: business.id, vertical: business.vertical };
  const location = await db.location.findFirst({
    where: { id: pointer.locationId, businessId: business.id, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!location) return organization;
  return {
    scope: 'LOCATION',
    businessId: business.id,
    locationId: location.id,
    vertical: business.vertical,
  };
}
