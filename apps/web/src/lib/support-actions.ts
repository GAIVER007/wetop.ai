import type { BadgeTone } from '../components/ui';

/**
 * Журнал действий WETOP Support в кабинете (S6, plans/ai-agents-s6-actions-2026-09-29.md): слова для действий,
 * классов и статусов. Только показ; матрица и правила — у бота.
 */
const ACTIONS: Record<string, string> = {
  channel_pull: 'Подтянуть ленту Channex',
  channel_sync: 'Полная выгрузка в Channex',
  refund: 'Возврат оплаты',
  subscription: 'Подписка',
  organization_disable: 'Отключение организации',
  owner_rights: 'Права и роли',
  data_delete: 'Удаление данных',
  reservations_bulk: 'Массовые правки броней',
  other_human: 'Другое',
};

const CLASSES: Record<string, string> = {
  SAFE: 'сам',
  CONFIRM: 'после подтверждения',
  HUMAN_ONLY: 'только человек',
};

const STATUSES: Record<string, { label: string; tone: BadgeTone }> = {
  PROPOSED: { label: 'Ждёт подтверждения', tone: 'warn' },
  CONFIRMED: { label: 'Подтверждено', tone: 'info' },
  DONE: { label: 'Выполнено', tone: 'ok' },
  FAILED: { label: 'Не удалось', tone: 'danger' },
  CANCELLED: { label: 'Отменено', tone: 'neutral' },
  EXPIRED: { label: 'Устарело', tone: 'neutral' },
  REFUSED: { label: 'Отказ: только человек', tone: 'warn' },
  ESCALATED: { label: 'Передано человеку', tone: 'warn' },
};

export function actionLabel(action: string | null | undefined): string {
  return (action && ACTIONS[action]) || action || 'Действие';
}

export function actionClassLabel(cls: string | null | undefined): string {
  return (cls && CLASSES[cls]) || 'класс неизвестен';
}

export function actionStatus(status: string | null | undefined): { label: string; tone: BadgeTone } {
  return (status && STATUSES[status]) || { label: status || 'статус неизвестен', tone: 'neutral' };
}
