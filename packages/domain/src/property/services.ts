import { parseMoney } from '../finance/finance';

/**
 * Услуга каталога глазами «Настроек объекта» (SET3, `plans/property-settings-set2-set3-2026-09-28.md`): название,
 * группа, цена и статус. Код услуги даёт система — пользователю он не нужен; казахское название и налог в модели есть,
 * но из стойки не правятся. Удаления нет: начисления ссылаются на услугу, поэтому она уходит в архив (`active = false`).
 */
export interface ServiceInput {
  name?: string;
  group?: string | null;
  priceMinor?: bigint;
  active?: boolean;
}

export type ServiceInputField = 'name' | 'group' | 'price' | 'active';
export type ServiceInputParse =
  { ok: true; value: ServiceInput } | { ok: false; reason: string; field?: ServiceInputField };

const NAME_MAX = 200;
const GROUP_MAX = 100;
export const SERVICE_PRICE_MESSAGE = 'Цена — больше нуля, например 700 или 700,50';

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.replace(/\s+/g, ' ').trim() !== ''
    ? v.replace(/\s+/g, ' ').trim()
    : null;

/** Цена из поля: «700», «700,50», «8 000» → тиыны; ноль, минус и лишние знаки — null */
export function parseServicePrice(v: unknown): bigint | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const raw = String(v).replace(/[\s\u00a0]/g, '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw)) return null;
  const minor = parseMoney(raw);
  return minor > 0n ? minor : null;
}

/**
 * Разбор ввода услуги. Новая (`partial` нет): название и цена обязательны, статус по умолчанию — активна. Правка
 * (`partial`): только присланные поля. Ошибка называет поле — стойка подсвечивает его.
 */
export function parseServiceInput(
  raw: unknown,
  opts: { partial?: boolean } = {},
): ServiceInputParse {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Нечего сохранять' };
  const body = raw as Record<string, unknown>;
  const out: ServiceInput = {};
  for (const key of Object.keys(body)) {
    const value = body[key];
    switch (key) {
      case 'name': {
        const s = text(value);
        if (s === null) return { ok: false, reason: 'Укажите название услуги', field: 'name' };
        if (s.length > NAME_MAX)
          return { ok: false, reason: `Название — не длиннее ${NAME_MAX} знаков`, field: 'name' };
        out.name = s;
        break;
      }
      case 'group': {
        if (value !== null && value !== undefined && typeof value !== 'string')
          return { ok: false, reason: 'Группа — текстом', field: 'group' };
        const s = text(value);
        if (s !== null && s.length > GROUP_MAX)
          return { ok: false, reason: `Группа — не длиннее ${GROUP_MAX} знаков`, field: 'group' };
        out.group = s;
        break;
      }
      case 'price': {
        const minor = parseServicePrice(value);
        if (minor === null) return { ok: false, reason: SERVICE_PRICE_MESSAGE, field: 'price' };
        out.priceMinor = minor;
        break;
      }
      case 'active': {
        if (typeof value !== 'boolean')
          return { ok: false, reason: 'Статус — «активна» или «в архиве»', field: 'active' };
        out.active = value;
        break;
      }
      default:
        return { ok: false, reason: `Неизвестное поле: ${key}` };
    }
  }
  if (opts.partial) {
    if (Object.keys(out).length === 0) return { ok: false, reason: 'Нечего сохранять' };
    return { ok: true, value: out };
  }
  if (out.name === undefined)
    return { ok: false, reason: 'Укажите название услуги', field: 'name' };
  if (out.priceMinor === undefined)
    return { ok: false, reason: 'Укажите цену услуги', field: 'price' };
  return {
    ok: true,
    value: {
      name: out.name,
      group: out.group ?? null,
      priceMinor: out.priceMinor,
      active: out.active ?? true,
    },
  };
}
