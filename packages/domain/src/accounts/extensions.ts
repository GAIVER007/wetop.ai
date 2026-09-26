import { zonedStartOfDay } from '../web-analytics/metrics';

/**
 * Платные расширения организации (DATA_MODEL §16.3, ADR-083, Q-183). Пока одно — «ИИ-продавец». Включает, продлевает
 * и выключает только главный администратор; оплата — по счёту вручную (умолчание Q-141), денег здесь нет.
 */
export type ExtensionStatus = 'TRIAL' | 'ACTIVE' | 'OFF';

export const EXTENSION_STATUSES: Readonly<Record<ExtensionStatus, string>> = {
  TRIAL: 'пробный',
  ACTIVE: 'оплачен',
  OFF: 'выключен',
};

export interface ExtensionState {
  status: ExtensionStatus;
  /** `null` — бессрочно (пробный без срока не действует) */
  activeUntil: Date | null;
}

/** Действует: пробный или оплачен, и срок не вышел; в саму минуту окончания — уже нет */
export function isExtensionActive(row: ExtensionState | null, now: Date): boolean {
  if (!row || row.status === 'OFF') return false;
  if (row.activeUntil === null) return row.status === 'ACTIVE';
  return now < row.activeUntil;
}

/**
 * Доступ к разделу по расширению (ADR-083, Q-183 вариант (а)): `active` — раздел целиком; `expired` — срок пробного или
 * оплаченного вышел: раздел только для чтения, правка и ответы гостям закрыты, ничего не удаляется; `off` — выключено
 * или не подключали: раздела в меню нет.
 */
export type ExtensionAccess = 'active' | 'expired' | 'off';

export function extensionAccess(row: ExtensionState | null, now: Date): ExtensionAccess {
  if (isExtensionActive(row, now)) return 'active';
  return row && row.status !== 'OFF' ? 'expired' : 'off';
}

/**
 * Сколько дней до конца — для напоминания владельцу организации за 7 дней и в последний день (Q-183). Неполный день
 * считается днём; срок вышел — 0; бессрочно или выключено — `null`.
 */
export function extensionDaysLeft(row: ExtensionState | null, now: Date): number | null {
  if (!row || row.status === 'OFF' || row.activeUntil === null) return null;
  const ms = row.activeUntil.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/**
 * Пояс платформы: сроки расширений — по Алматы (главный администратор пишет дату, а не момент), и он же —
 * запасной пояс стойки, пока настройки объекта не пришли (С-13, ТЗ аудита 25.09.2026). Одно место на систему.
 */
export const PLATFORM_TIMEZONE = 'Asia/Almaty';
const NOTE_MAX = 300;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface ExtensionChange {
  status: ExtensionStatus;
  activeUntil: Date | null;
  note: string | null;
}

/**
 * Изменение расширения из формы «Платформа → Организации»: статус, дата «до» (`ГГГГ-ММ-ДД`, включительно — до конца
 * этого дня по Алматы; пусто — бессрочно) и заметка (номер счёта). Все причины отказа называются сразу.
 */
export function parseExtensionChange(
  raw: unknown,
  now: Date,
): { ok: true; value: ExtensionChange } | { ok: false; errors: string[] } {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const status = input.status;
  const known = typeof status === 'string' && Object.hasOwn(EXTENSION_STATUSES, status);
  if (!known) errors.push('Статус: пробный, оплачен или выключен');

  const day = typeof input.activeUntil === 'string' ? input.activeUntil.trim() : '';
  let activeUntil: Date | null = null;
  if (known && status !== 'OFF') {
    if (day === '') {
      if (status === 'TRIAL') errors.push('У пробного доступа нужен срок');
    } else if (!DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
      errors.push('Срок: дата ГГГГ-ММ-ДД');
    } else {
      const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      activeUntil = zonedStartOfDay(next, PLATFORM_TIMEZONE);
      if (activeUntil <= now) errors.push('Срок уже прошёл');
    }
  }

  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > NOTE_MAX) errors.push(`Заметка: не длиннее ${NOTE_MAX} знаков`);

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { status: status as ExtensionStatus, activeUntil, note: note === '' ? null : note },
  };
}
