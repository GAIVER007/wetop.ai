import { msg } from '../../i18n';

/**
 * Разделы риска «Истории действий» (владелец 30.10.2026: «нужно отслеживать: сделал скидку, отменил запись, удалил
 * клиента, этот раздел создан для предотвращения краж»). Коды разделов считает API (audit-query.ts, RISK_SQL).
 */
export const RISK_TABS = [
  { key: 'risk', label: msg('Риски') },
  { key: 'discount', label: msg('Скидки') },
  { key: 'cancel', label: msg('Отмены') },
  { key: 'delete', label: msg('Удаления') },
  { key: 'refund', label: msg('Возвраты') },
  { key: 'access', label: msg('Доступ') },
] as const;

export type RiskKey = 'discount' | 'cancel' | 'delete' | 'refund' | 'access';
export type AuditSummary = Record<RiskKey, { count: number; minor: string }> & { currency?: string | null };

/** Плитки сверху: что владелец проверяет первым. Входы без суммы, у остальных деньги периода. */
export const RISK_TILES: ReadonlyArray<{ key: RiskKey; label: string; tone: 'danger' | 'warning' | 'muted' }> = [
  { key: 'discount', label: msg('Скидки'), tone: 'danger' },
  { key: 'cancel', label: msg('Отмены записей'), tone: 'danger' },
  { key: 'delete', label: msg('Удаления'), tone: 'danger' },
  { key: 'refund', label: msg('Возвраты и правки оплат'), tone: 'warning' },
  { key: 'access', label: msg('Входы и доступ'), tone: 'muted' },
];

export const RISK_TAG: Record<RiskKey, string> = {
  discount: msg('Скидка'),
  cancel: msg('Отмена'),
  delete: msg('Удаление'),
  refund: msg('Возврат'),
  access: msg('Доступ'),
};

const money = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && /^-?\d+$/.test(String(v)) ? String(v) : null;
const text = (v: unknown) => (typeof v === 'string' ? v : null);

/** Было → стало по деньгам: цена до и после правки или одна сумма возврата и аннулирования со знаком минус */
export function riskChange(
  before: Record<string, unknown> = {},
  after: Record<string, unknown> = {},
): { before: string | null; after: string; currency: string | null } | null {
  const currency = text(after['currency']) ?? text(before['currency']);
  const was = money(before['priceMinor']);
  const now = money(after['priceMinor']);
  if (was !== null && now !== null) return { before: was, after: now, currency };
  const amount = money(after['amountMinor']) ?? (after['voided'] === true ? money(before['amountMinor']) : null);
  if (amount !== null) return { before: null, after: amount.startsWith('-') ? amount : `-${amount}`, currency };
  return null;
}

/** Комментарий сотрудника: причина правки или заметка из снимка; пустая строка не считается комментарием */
export function riskComment(before: Record<string, unknown> = {}, after: Record<string, unknown> = {}): string | null {
  for (const v of [after['reason'], after['note'], before['reason'], before['note']]) {
    const s = text(v)?.trim();
    if (s) return s;
  }
  return null;
}
