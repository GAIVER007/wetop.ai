import type { ExtensionAccess } from '../accounts/extensions';

/**
 * Создание AI-продавца (SA2, plans/business-ai-seller-sa2-2026-09-30.md). Три вещи, общие для сервера и страницы: разбор
 * ввода формы, список настройки страницы агента и состояние кнопки «+ Подключить AI-продавца». Слова живут здесь, чтобы
 * интерфейс ничего не считал сам и не расходился с сервером.
 */

export const AGENT_NAME_MAX = 80;

export interface AgentInput {
  name: string;
  businessId: string;
  locationId: string;
}

export type AgentInputField = 'name' | 'businessId' | 'locationId';

export type AgentInputResult =
  | { ok: true; value: AgentInput }
  | { ok: false; errors: Partial<Record<AgentInputField, string>> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function hasForbiddenChar(text: string): boolean {
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) return true; // управляющие знаки, в том числе переводы строк
    if (c === 0x2028 || c === 0x2029) return true; // разделители строк и абзацев
    if (c === 0x200e || c === 0x200f || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)) return true; // направление письма
    if (ch === '<' || ch === '>') return true; // разметка
  }
  return false;
}

/**
 * Разбор тела создания агента. Организации в значении нет никогда: её называет сервер из вошедшего, а не форма.
 * Лишние поля отбрасываются.
 */
export function parseAgentInput(raw: unknown): AgentInputResult {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const errors: Partial<Record<AgentInputField, string>> = {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length === 0) errors.name = 'Введите название агента.';
  else if ([...name].length > AGENT_NAME_MAX) errors.name = `Название не длиннее ${AGENT_NAME_MAX} знаков.`;
  else if (hasForbiddenChar(name)) errors.name = 'В названии не должно быть переводов строк и разметки.';

  const businessId = typeof body.businessId === 'string' && UUID.test(body.businessId) ? body.businessId : null;
  if (!businessId) errors.businessId = 'Выберите Business.';
  const locationId = typeof body.locationId === 'string' && UUID.test(body.locationId) ? body.locationId : null;
  if (!locationId) errors.locationId = 'Выберите филиал.';

  if (Object.keys(errors).length > 0 || !businessId || !locationId) return { ok: false, errors };
  return { ok: true, value: { name, businessId, locationId } };
}

export type AgentSetupCode = 'basics' | 'behavior' | 'knowledge' | 'data' | 'whatsapp' | 'testing' | 'launch';

export interface AgentSetupItem {
  code: AgentSetupCode;
  label: string;
  /** Этап пройден. Незавершённые, статус «пока недоступно», а не шаг с кнопкой «Далее» (решение владельца 30.09) */
  done: boolean;
}

/**
 * Список настройки агента-черновика. После создания готово только «Основное»; остальные этапы появятся своими срезами
 * (SA3 поведение, SA4 знания, SA5 данные WETOP, SA6 WhatsApp, SA7 тестирование, SA9 запуск) и станут доступны по одному.
 */
export const AGENT_SETUP_ITEMS: readonly AgentSetupItem[] = [
  { code: 'basics', label: 'Основное', done: true },
  { code: 'behavior', label: 'Поведение', done: false },
  { code: 'knowledge', label: 'Знания', done: false },
  { code: 'data', label: 'Данные WETOP', done: false },
  { code: 'whatsapp', label: 'WhatsApp', done: false },
  { code: 'testing', label: 'Тестирование', done: false },
  { code: 'launch', label: 'Запуск', done: false },
];

export const AGENT_SETUP_PENDING_WORD = 'Пока недоступно';

export interface CreateAgentAvailability {
  enabled: boolean;
  /** Почему кнопка неактивна; `null`, когда активна */
  reason: string | null;
}

/**
 * Состояние кнопки «+ Подключить AI-продавца». Порядок причин: расширение, право, филиал, как их проверяет сервер при
 * создании. Кнопку не скрываем: иначе непонятно, есть ли функция вообще (решение владельца 30.09).
 */
export function createAgentAvailability(input: {
  extension: ExtensionAccess;
  /** Право `seller`: владелец и управляющий */
  canManage: boolean;
  locations: { total: number; free: number };
}): CreateAgentAvailability {
  if (input.extension === 'off') return { enabled: false, reason: 'Расширение «ИИ-продавец» не подключено.' };
  if (input.extension === 'expired') return { enabled: false, reason: 'Срок расширения «ИИ-продавец» вышел.' };
  if (!input.canManage) return { enabled: false, reason: 'Создавать агентов могут владелец и управляющий.' };
  const { total, free } = input.locations;
  if (total === 0) return { enabled: false, reason: 'Нет ни одного филиала. Сначала настройте объект.' };
  if (free === 0) {
    return {
      enabled: false,
      reason:
        total === 1
          ? 'Нет свободного филиала. Для этого филиала AI-продавец уже создан.'
          : 'Нет свободного филиала. Во всех филиалах AI-продавец уже создан.',
    };
  }
  return { enabled: true, reason: null };
}
