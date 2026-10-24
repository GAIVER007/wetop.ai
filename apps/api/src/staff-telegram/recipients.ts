import type { DbTx } from '@pms/database';
import {
  parseBeautyPermissions,
  staffNotificationRecipient,
  type BeautyAssignment,
  type MembershipRole,
  type ScopeAssignment,
  type StaffNotificationKind,
} from '@pms/domain';

/**
 * Получатели и запись в очередь уведомлений сотрудникам (STAFF-TG-20261020, AGENTS.md §11). Запись идёт в ТОЙ ЖЕ
 * транзакции, что и бронь с сайта: бронь без строки очереди не фиксируется, а повтор брони (тот же ключ создания)
 * второй строки не даёт (UNIQUE kind, source_id, recipient_user_id). В строке только тип события и id: текст
 * собирается при отправке (ADR-018).
 */
type Db = Pick<DbTx, '$queryRaw' | '$executeRaw'>;

export interface StaffEventTarget {
  organizationId: string;
  businessId: string;
  locationId: string;
  vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
  kind: StaffNotificationKind;
  /** Мастер записи салона: для права OWN («только свои записи») */
  employeeId?: string | null;
}

interface CandidateRow {
  user_id: string;
  user_status: string;
  role: MembershipRole;
  membership_status: 'ACTIVE' | 'SUSPENDED';
  scopes: Array<{ role: MembershipRole; businessId: string; locationId: string | null }> | null;
  assignments: Array<{
    businessId: string;
    locationId: string | null;
    revokedAt: string | null;
    archivedAt: string | null;
    permissions: Array<{ section: string; action: string; scope: string }>;
  }> | null;
  own_employee: boolean;
}

/**
 * Кандидаты одним запросом: действующая привязка с включённым «Брони с сайта» и членство в организации события,
 * плюс область доступа и должности салона. Решение «получает или нет» принимает домен (`staffNotificationRecipient`),
 * чтобы правило было одно и для записи в очередь, и для проверки при отправке. `onlyUserId`: проверка одного сотрудника.
 */
export async function staffRecipients(db: Db, target: StaffEventTarget, onlyUserId?: string): Promise<string[]> {
  const rows = await db.$queryRaw<CandidateRow[]>`
    SELECT u.id AS user_id, u.status::text AS user_status, m.role, m.status::text AS membership_status,
      (SELECT json_agg(json_build_object('role', s.role, 'businessId', s.business_id, 'locationId', s.location_id))
         FROM membership_scopes s WHERE s.user_id = u.id AND s.organization_id = m.organization_id) AS scopes,
      (SELECT json_agg(json_build_object(
          'businessId', a.business_id, 'locationId', a.location_id, 'revokedAt', a.revoked_at,
          'archivedAt', p.archived_at,
          'permissions', COALESCE((SELECT json_agg(json_build_object('section', pp.section, 'action', pp.action, 'scope', pp.scope))
                                     FROM beauty_position_permissions pp WHERE pp.position_id = p.id), '[]'::json)))
         FROM beauty_position_assignments a JOIN beauty_positions p ON p.id = a.position_id
        WHERE a.user_id = u.id AND a.organization_id = m.organization_id) AS assignments,
      EXISTS (SELECT 1 FROM employees e WHERE e.user_id = u.id AND e.id = ${target.employeeId ?? null}::uuid) AS own_employee
    FROM staff_telegram_links l
    JOIN users u ON u.id = l.user_id
    JOIN memberships m ON m.user_id = l.user_id AND m.organization_id = ${target.organizationId}::uuid
    WHERE l.disabled_at IS NULL AND l.site_bookings
      AND (${onlyUserId ?? null}::uuid IS NULL OR l.user_id = ${onlyUserId ?? null}::uuid)
    ORDER BY u.id`;
  return rows
    .filter((row) =>
      staffNotificationRecipient({
        kind: target.kind,
        vertical: target.vertical,
        target: { businessId: target.businessId, locationId: target.locationId },
        userActive: row.user_status === 'ACTIVE',
        membership: { role: row.role, status: row.membership_status },
        scopes: (row.scopes ?? [])
          .filter((s) => s.role !== 'OWNER')
          .map((s) => ({ role: s.role as ScopeAssignment['role'], businessId: s.businessId, locationId: s.locationId })),
        beautyAssignments: (row.assignments ?? []).map((a): BeautyAssignment => {
          const parsed = parseBeautyPermissions(a.permissions);
          return {
            businessId: a.businessId,
            locationId: a.locationId,
            revokedAt: a.revokedAt,
            position: { archivedAt: a.archivedAt, permissions: parsed.ok ? parsed.value : [] },
          };
        }),
        ownEmployee: row.own_employee,
      }),
    )
    .map((row) => row.user_id);
}

/**
 * Строки очереди на событие: по одной на получателя, повтор события пропускается. Возвращает число новых строк.
 * Пока бот не подключён (`TELEGRAM_STAFF_BOT_TOKEN` не задан), событие пишется в журнал сразу со статусом SKIPPED:
 * после включения бота старые не досылаются, только новые (план, раздел «Подключение» п. 4).
 */
export async function enqueueStaffNotifications(
  db: Db,
  target: StaffEventTarget & { sourceId: string },
  env: Record<string, string | undefined> = process.env,
): Promise<number> {
  const recipients = await staffRecipients(db, target);
  if (recipients.length === 0) return 0;
  const botOn = !!env.TELEGRAM_STAFF_BOT_TOKEN?.trim();
  const status = botOn ? 'PENDING' : 'SKIPPED';
  const lastError = botOn ? null : 'bot-not-configured';
  return db.$executeRaw`
    INSERT INTO staff_notifications (organization_id, location_id, kind, source_id, recipient_user_id, status, last_error)
    SELECT ${target.organizationId}::uuid, ${target.locationId}::uuid, ${target.kind}::"StaffNotificationKind",
           ${target.sourceId}::uuid, r, ${status}::"StaffNotificationStatus", ${lastError}
      FROM unnest(${recipients}::uuid[]) AS r
    ON CONFLICT (kind, source_id, recipient_user_id) DO NOTHING`;
}

/** Цепочка филиала для записи из гостиничной брони: у объекта свой филиал, организация и направление из Business */
export async function staffTargetOfProperty(
  db: Db,
  propertyId: string,
): Promise<Omit<StaffEventTarget, 'kind'> | null> {
  const [row] = await db.$queryRaw<
    Array<{ organization_id: string; business_id: string; location_id: string; vertical: StaffEventTarget['vertical'] }>
  >`
    SELECT b.organization_id, b.id AS business_id, l.id AS location_id, b.vertical::text AS vertical
      FROM properties p JOIN locations l ON l.id = p.location_id JOIN businesses b ON b.id = l.business_id
     WHERE p.id = ${propertyId}::uuid`;
  return row
    ? { organizationId: row.organization_id, businessId: row.business_id, locationId: row.location_id, vertical: row.vertical }
    : null;
}
