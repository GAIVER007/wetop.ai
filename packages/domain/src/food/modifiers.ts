import { foodId, foodInt, foodObject, foodText } from './food';

/**
 * Модификаторы блюд и деление счёта (DATA_MODEL §33.7, миграция 144). Деньги bigint minor units (ADR-008).
 * Группа обязательная, когда `minSelect >= 1`; при `maxSelect = 1` выбор одним.
 */
export interface ModifierRule {
  id: string;
  name: string;
  priceDelta: bigint;
  active: boolean;
}
export interface ModifierGroupRule {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: ModifierRule[];
}
/** Снимок выбранного модификатора для строки заказа */
export interface ChosenModifier {
  modifierId: string;
  groupName: string;
  name: string;
  priceDelta: bigint;
  sortOrder: number;
}

export const MODIFIER_MAX_SELECT = 20;
export const MODIFIERS_PER_GROUP = 50;
export const MODIFIER_DELTA_LIMIT = 100_000_000_000;

/**
 * Проверка выбора по группам блюда (активные группы, в порядке блюда). Возвращает снимки в порядке групп и
 * модификаторов. Модификатор не из этих групп (другое блюдо, другой бизнес) или выключенный = отказ.
 */
export function checkModifierChoice(groups: ModifierGroupRule[], ids: string[]): ChosenModifier[] {
  if (new Set(ids).size !== ids.length) throw new Error('Добавка выбрана дважды');
  const wanted = new Set(ids);
  const known = new Set<string>();
  const out: ChosenModifier[] = [];
  for (const g of groups) {
    const picked = g.modifiers.filter((m) => m.active && wanted.has(m.id));
    for (const m of g.modifiers) if (m.active) known.add(m.id);
    if (picked.length > g.maxSelect) throw new Error(`${g.name}: не больше ${g.maxSelect}`);
    if (picked.length < g.minSelect)
      throw new Error(g.minSelect === 1 && picked.length === 0 ? `Выберите: ${g.name}` : `${g.name}: выберите не меньше ${g.minSelect}`);
    for (const m of picked)
      out.push({ modifierId: m.id, groupName: g.name, name: m.name, priceDelta: m.priceDelta, sortOrder: out.length });
  }
  if (ids.some((id) => !known.has(id))) throw new Error('Добавка недоступна для этого блюда');
  return out;
}

/** Цена строки = цена блюда + прибавки; замораживается в строке заказа */
export function linePrice(base: bigint, deltas: readonly bigint[]): bigint {
  const price = deltas.reduce((sum, d) => sum + d, base);
  if (price < 0n) throw new Error('Цена позиции с добавками меньше нуля');
  return price;
}

/** Ключ строки при правке состава: одно блюдо с разными добавками или комментарием это разные строки */
export function orderLineKey(menuItemId: string, modifierIds: readonly string[], notes: string | null): string {
  return [menuItemId, [...modifierIds].sort().join(','), notes ?? ''].join('|');
}

function delta(v: unknown): bigint {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || Math.abs(v) > MODIFIER_DELTA_LIMIT)
    throw new Error('Прибавка к цене: целое число minor units');
  return BigInt(v);
}

export interface ModifierInput {
  id: string | null;
  name: string;
  priceDelta: bigint;
  active: boolean;
  sortOrder: number;
}
export interface ModifierGroupInput {
  name?: string;
  minSelect?: number;
  maxSelect?: number;
  sortOrder?: number;
  active?: boolean;
  modifiers?: ModifierInput[];
}

/** Группа целиком с модификаторами (создание) или частичная правка; модификаторы присылаются списком целиком */
export function parseModifierGroupInput(raw: unknown, partial = false): ModifierGroupInput {
  const b = foodObject(raw, ['name', 'minSelect', 'maxSelect', 'sortOrder', 'active', 'modifiers']);
  const out: ModifierGroupInput = {};
  if (!partial || b.name !== undefined) out.name = foodText(b.name, 100);
  if (!partial || b.minSelect !== undefined) out.minSelect = b.minSelect === undefined ? 0 : foodInt(b.minSelect, 0, MODIFIER_MAX_SELECT);
  if (!partial || b.maxSelect !== undefined) out.maxSelect = b.maxSelect === undefined ? 1 : foodInt(b.maxSelect, 1, MODIFIER_MAX_SELECT);
  if (b.sortOrder !== undefined) out.sortOrder = foodInt(b.sortOrder, 0, 100000);
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') throw new Error('Нужно логическое значение');
    out.active = b.active;
  }
  if (!partial || b.modifiers !== undefined) {
    if (!Array.isArray(b.modifiers) || b.modifiers.length > MODIFIERS_PER_GROUP)
      throw new Error(`Добавки группы списком до ${MODIFIERS_PER_GROUP}`);
    const names = new Set<string>();
    out.modifiers = b.modifiers.map((row, index) => {
      const m = foodObject(row, ['id', 'name', 'priceDeltaMinor', 'active']);
      const name = foodText(m.name, 100);
      const key = name.toLocaleLowerCase('ru');
      if (names.has(key)) throw new Error(`Добавка «${name}» повторяется`);
      names.add(key);
      if (m.active !== undefined && typeof m.active !== 'boolean') throw new Error('Нужно логическое значение');
      return {
        id: m.id == null ? null : foodId(m.id),
        name,
        priceDelta: delta(m.priceDeltaMinor ?? 0),
        active: m.active === undefined ? true : (m.active as boolean),
        sortOrder: index,
      };
    });
  }
  if (out.minSelect !== undefined && out.maxSelect !== undefined && out.minSelect > out.maxSelect)
    throw new Error('Минимум выбора больше максимума');
  if (out.modifiers && out.minSelect !== undefined && out.modifiers.filter((m) => m.active).length < out.minSelect)
    throw new Error('В группе меньше добавок, чем минимум выбора');
  return out;
}

/** Группы блюда списком в нужном порядке (замена целиком) */
export function parseItemModifierGroups(raw: unknown): string[] {
  const b = foodObject(raw, ['groupIds']);
  if (!Array.isArray(b.groupIds) || b.groupIds.length > 20) throw new Error('Группы блюда списком до 20');
  const ids = b.groupIds.map(foodId);
  if (new Set(ids).size !== ids.length) throw new Error('Группа указана дважды');
  return ids;
}

export function parseModifierIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 50) throw new Error('Добавки позиции списком до 50');
  return raw.map(foodId);
}

/** «Поровну на N»: N частей, остаток minor units первому гостю */
export function splitEvenly(amount: bigint, parts: number): bigint[] {
  if (!Number.isInteger(parts) || parts < 1 || parts > 50) throw new Error('Гостей от 1 до 50');
  if (amount <= 0n) throw new Error('Нечего делить');
  const n = BigInt(parts);
  if (amount < n) throw new Error('Сумма меньше числа гостей');
  const base = amount / n;
  return Array.from({ length: parts }, (_, i) => (i === 0 ? base + (amount - base * n) : base));
}

export interface PayableLine {
  id: string;
  price: bigint;
  qty: number;
  /** строка уже в действующем платеже */
  paid: boolean;
}
/** «По позициям»: сумма выбранных неоплаченных строк заказа (цена × количество) */
export function itemsPaymentAmount(lines: readonly PayableLine[], ids: readonly string[]): bigint {
  if (!ids.length) throw new Error('Отметьте хотя бы одну позицию');
  if (new Set(ids).size !== ids.length) throw new Error('Позиция отмечена дважды');
  const byId = new Map(lines.map((l) => [l.id, l]));
  let sum = 0n;
  for (const id of ids) {
    const line = byId.get(id);
    if (!line) throw new Error('Позиция не из этого заказа');
    if (line.paid) throw new Error('Позиция уже оплачена');
    sum += line.price * BigInt(line.qty);
  }
  return sum;
}
