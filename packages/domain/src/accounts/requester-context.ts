import { MEMBERSHIP_ROLES, type MembershipRole } from './roles';
import { PERMISSIONS, can, type Permission } from './permissions';
import type { ExtensionAccess } from './extensions';

/**
 * Контекст обратившегося для WETOP Support (S4, plans/ai-agents-s4-requester-context-2026-09-29.md): кто пишет, в какой
 * организации, что ему можно и что с подпиской. Чистая сборка ответа: данные читает API внутри контекста запроса
 * (`RequestActor`, ADR-120), здесь — только маска, слова и списки прав. Пароля, телефона, ID пользователя, гостей и
 * денег в ответе нет: типы входа их не принимают, а сборка не копирует лишних полей.
 */

export interface RequesterContextInput {
  user: { name: string | null; email: string };
  role: MembershipRole;
  organization: { name: string; status: string };
  businesses: Array<{
    name: string;
    vertical: string;
    status: string;
    locations: Array<{ name: string; status: string }>;
  }>;
  aiSeller: { access: ExtensionAccess; activeUntil: string | null; daysLeft: number | null };
}

export interface RequesterContext {
  user: { name: string | null; email: string };
  role: { code: MembershipRole; label: string };
  organization: { name: string; status: string };
  businesses: RequesterContextInput['businesses'];
  subscription: { aiSeller: { access: ExtensionAccess; activeUntil: string | null; summary: string } };
  permissions: {
    allowed: Array<{ code: Permission; label: string }>;
    denied: Array<{ code: Permission; label: string }>;
    humanOnly: string[];
  };
}

/** Решения, которые агент не принимает никогда (план ai-agents §3): их делает человек */
export const HUMAN_ONLY_DECISIONS: readonly string[] = [
  'возврат оплаты и сторно начислений',
  'смена тарифа подписки и продление расширений',
  'отключение организации и удаление данных',
  'выдача и смена прав владельца и управляющего',
  'массовые правки броней',
];

/** `a***@example.kz`: первая буква и домен — человек узнаёт свою почту, посторонний ничего не получает */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1 || at === email.length - 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

function dateWords(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}.${m}.${y}` : '';
}

function sellerSummary(seller: RequesterContextInput['aiSeller']): string {
  const until = dateWords(seller.activeUntil);
  if (seller.access === 'active')
    return `Расширение «ИИ-продавец» действует${until ? ` до ${until}` : ' (бессрочно)'}.`;
  if (seller.access === 'expired')
    return `Срок расширения «ИИ-продавец» истёк${until ? ` ${until}` : ''}: раздел только для чтения. Продление — заявкой владельцу платформы.`;
  return 'Расширение «ИИ-продавец» не подключено.';
}

export function buildRequesterContext(input: RequesterContextInput): RequesterContext {
  const codes = Object.keys(PERMISSIONS) as Permission[];
  const view = (code: Permission) => ({ code, label: PERMISSIONS[code].label });
  return {
    user: { name: input.user.name, email: maskEmail(input.user.email) },
    role: { code: input.role, label: MEMBERSHIP_ROLES[input.role] },
    organization: { name: input.organization.name, status: input.organization.status },
    businesses: input.businesses.map((b) => ({
      name: b.name,
      vertical: b.vertical,
      status: b.status,
      locations: b.locations.map((l) => ({ name: l.name, status: l.status })),
    })),
    subscription: {
      aiSeller: {
        access: input.aiSeller.access,
        activeUntil: input.aiSeller.activeUntil,
        summary: sellerSummary(input.aiSeller),
      },
    },
    permissions: {
      allowed: codes.filter((c) => can(input.role, c)).map(view),
      denied: codes.filter((c) => !can(input.role, c)).map(view),
      humanOnly: [...HUMAN_ONLY_DECISIONS],
    },
  };
}
