/**
 * Управляемая база знаний WETOP Support в кабинете (S3, plans/ai-agents-s3-knowledge-2026-09-29.md): слова и тона для
 * категорий, видимости и статусов. Только показ; правила состояния — у бота и API (отвечает ACTIVE, публикует главный
 * администратор).
 */
export const KB_CATEGORIES = [
  ['PRODUCT', 'Продукт'],
  ['HOW_TO', 'Как сделать'],
  ['TROUBLESHOOTING', 'Разбор проблем'],
  ['BILLING', 'Оплата и подписка'],
  ['INTEGRATIONS', 'Интеграции'],
  ['SECURITY', 'Безопасность'],
  ['KNOWN_ISSUE', 'Известные проблемы'],
  ['RUNBOOK', 'Регламенты'],
] as const;

export const KB_VISIBILITIES = [
  ['PUBLIC_SUPPORT', 'Публичное'],
  ['INTERNAL_SUPPORT', 'Внутреннее'],
  ['PLATFORM_ADMIN_ONLY', 'Только администратор платформы'],
] as const;

export const KB_STATUSES = [
  ['DRAFT', 'Черновик'],
  ['ACTIVE', 'Отвечает'],
  ['OUTDATED', 'Устарело'],
  ['ARCHIVED', 'В архиве'],
] as const;

const word = (table: ReadonlyArray<readonly [string, string]>, value: string | null | undefined) =>
  table.find(([key]) => key === value)?.[1] ?? '—';

export const kbCategoryLabel = (value: string | null | undefined) => word(KB_CATEGORIES, value);
export const kbVisibilityLabel = (value: string | null | undefined) => word(KB_VISIBILITIES, value);
export const kbStatusLabel = (value: string | null | undefined) => word(KB_STATUSES, value);

export type KbTone = 'neutral' | 'ok' | 'warn' | 'info';
export const kbStatusTone = (value: string | null | undefined): KbTone =>
  value === 'ACTIVE' ? 'ok' : value === 'DRAFT' ? 'info' : value === 'OUTDATED' ? 'warn' : 'neutral';

/** Что можно сделать с записью в этом статусе: ACTIVE ставит только публикация чернового текста */
export function kbActions(status: string | null | undefined): Array<'publish' | 'outdated' | 'archive' | 'draft'> {
  switch (status) {
    case 'DRAFT':
      return ['publish', 'archive'];
    case 'ACTIVE':
      return ['outdated', 'archive'];
    case 'OUTDATED':
      return ['draft', 'archive'];
    case 'ARCHIVED':
      return ['draft'];
    default:
      return [];
  }
}

/** Разбор `?status=`, `?category=`, `?visibility=` из адреса: чужое значение — «без отбора» */
export function kbFilter(query: Record<string, string>): {
  status: string;
  category: string;
  visibility: string;
  q: string;
} {
  const pick = (table: ReadonlyArray<readonly [string, string]>, value: string) =>
    table.some(([key]) => key === value) ? value : '';
  return {
    status: pick(KB_STATUSES, query.status ?? ''),
    category: pick(KB_CATEGORIES, query.category ?? ''),
    visibility: pick(KB_VISIBILITIES, query.visibility ?? ''),
    q: (query.q ?? '').trim().slice(0, 200),
  };
}

/** Адрес каталога с отбором: пустые части не пишутся */
export function kbHref(filter: Partial<Record<'status' | 'category' | 'visibility' | 'q' | 'id', string>>): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(filter)) if (value) params.set(name, value);
  const qs = params.toString();
  return `/platform/support/base${qs ? `?${qs}` : ''}`;
}
