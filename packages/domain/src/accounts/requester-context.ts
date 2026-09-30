import { PERMISSIONS, can, type Permission } from './permissions';
import type { MembershipRole } from './roles';
import { canWrite, statusAfterTrial, type OrganizationStatus } from './trial';

/**
 * Контекст обратившегося для техподдержки (S4, plans/ai-agents-wetop-support-2026-09-29.md; решения Q-A2, Q-A6).
 * Чистая сборка: что модель вправе знать о человеке и его организации. Всё, чего здесь нет, остаётся у сервера —
 * почта, телефон, имя, внутренние id, сессия, ключи. Область (`scope`) вычисляет сервер, модель её не выбирает.
 */
export type AccountStatusWord = OrganizationStatus;

export interface AccountStatusView {
  status: AccountStatusWord;
  /** Можно ли менять данные: пишут только TRIAL в срок и ACTIVE (ADR-102) */
  canMutate: boolean;
  trialEndsAt: string | null;
  /** Безопасный продуктовый код, не текст платёжной системы */
  reasonCode: 'TRIAL_ENDED' | 'READ_ONLY_BY_PLATFORM' | 'SUSPENDED' | null;
}

export interface RequesterContext {
  requester: {
    /** Псевдоним: по нему ход различает человека, не раскрывая id */
    ref: string;
    role: 'owner' | 'manager' | 'staff';
    /** Главный администратор платформы — отдельный вид, а не «ещё один пользователь организации» */
    kind: 'TENANT_USER' | 'PLATFORM_ADMIN';
  };
  organization: { displayName: string };
  scope: 'ORGANIZATION';
  businesses: Array<{
    displayName: string;
    vertical: string;
    locations: Array<{ displayName: string }>;
  }>;
  account: AccountStatusView;
  /** Право → есть ли оно у роли. Ключи — все права таблицы ролей, значения — булевы */
  permissions: Record<Permission, boolean>;
}

export const REQUESTER_MAX_BUSINESSES = 5;
export const REQUESTER_MAX_LOCATIONS = 10;

export function accountStatusOf(
  organization: { status: OrganizationStatus; trialEndsAt: Date | null },
  now: Date,
): AccountStatusView {
  const status = statusAfterTrial(organization.status, organization.trialEndsAt, now);
  const trialEnded = organization.status === 'TRIAL' && status === 'READ_ONLY';
  const showTrialEnd = status === 'TRIAL' || trialEnded;
  return {
    status,
    canMutate: canWrite(organization.status, organization.trialEndsAt, now),
    trialEndsAt: showTrialEnd && organization.trialEndsAt ? organization.trialEndsAt.toISOString() : null,
    reasonCode: trialEnded
      ? 'TRIAL_ENDED'
      : status === 'READ_ONLY'
        ? 'READ_ONLY_BY_PLATFORM'
        : status === 'SUSPENDED'
          ? 'SUSPENDED'
          : null,
  };
}

export function buildRequesterContext(input: {
  userRef: string;
  role: MembershipRole;
  platformAdmin: boolean;
  organization: { name: string; status: OrganizationStatus; trialEndsAt: Date | null };
  businesses: Array<{ name: string; vertical: string; locations: Array<{ name: string }> }>;
  now: Date;
}): RequesterContext {
  const permissions = Object.fromEntries(
    (Object.keys(PERMISSIONS) as Permission[]).map((permission) => [permission, can(input.role, permission)]),
  ) as Record<Permission, boolean>;
  return {
    requester: {
      ref: input.userRef,
      role: input.role.toLowerCase() as 'owner' | 'manager' | 'staff',
      kind: input.platformAdmin ? 'PLATFORM_ADMIN' : 'TENANT_USER',
    },
    organization: { displayName: input.organization.name },
    scope: 'ORGANIZATION',
    businesses: input.businesses.slice(0, REQUESTER_MAX_BUSINESSES).map((business) => ({
      displayName: business.name,
      vertical: business.vertical,
      locations: business.locations
        .slice(0, REQUESTER_MAX_LOCATIONS)
        .map((location) => ({ displayName: location.name })),
    })),
    account: accountStatusOf(input.organization, input.now),
    permissions,
  };
}
