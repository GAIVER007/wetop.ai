/**
 * Каталог салона: разбор ввода (DATA_MODEL §19.1, срез B3). Те же правила, что у каталога услуг гостиницы
 * (`property/services.ts`): деньги целыми тиынами (ADR-008), название обрезается, удаления нет (архив полем).
 *
 * Разбор отдельно от записи: экран и API проверяют одно и то же, а тесты идут без базы.
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

const NAME_LIMIT = 200;
const CATEGORY_LIMIT = 100;
const PHONE_LIMIT = 32;
const EMAIL_LIMIT = 320;

/** Услуга каталога бизнеса: имя, группа, длительность, цена и её валюта (Q-257) */
export interface BeautyServiceInput {
  name: string;
  category: string | null;
  durationMinutes: number;
  priceMinor: bigint;
  currency: string;
  active: boolean;
}

/** Что меняет филиал у услуги каталога: включение и свои цена с длительностью */
export interface LocationServiceInput {
  enabled: boolean;
  priceOverrideMinor: bigint | null;
  durationOverrideMinutes: number | null;
}

/** Мастер сети: имя и необязательные контакты */
export interface EmployeeInput {
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
}

export function parseBeautyServiceInput(
  raw: unknown,
  options: { partial?: boolean } = {},
): ParseResult<Partial<BeautyServiceInput>> {
  const body = (raw ?? {}) as Record<string, unknown>;
  const partial = options.partial === true;
  const value: Partial<BeautyServiceInput> = {};

  if (!partial || body['name'] !== undefined) {
    const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
    if (!name) return { ok: false, reason: 'Укажите название услуги' };
    if (name.length > NAME_LIMIT)
      return { ok: false, reason: `Название услуги: не больше ${NAME_LIMIT} символов` };
    value.name = name;
  }

  if (!partial || body['category'] !== undefined) {
    const raw = body['category'];
    const category = typeof raw === 'string' ? raw.trim() : '';
    if (category.length > CATEGORY_LIMIT)
      return { ok: false, reason: `Группа услуг: не больше ${CATEGORY_LIMIT} символов` };
    value.category = category || null;
  }

  if (!partial || body['durationMinutes'] !== undefined) {
    const minutes = parseMinutes(body['durationMinutes']);
    if (minutes === null)
      return { ok: false, reason: 'Длительность услуги: целое число минут больше нуля' };
    value.durationMinutes = minutes;
  }

  if (!partial || body['priceMinor'] !== undefined) {
    const price = parseMinor(body['priceMinor']);
    if (price === null) return { ok: false, reason: 'Цена услуги: целое число в тиынах, не меньше нуля' };
    value.priceMinor = price;
  }

  if (!partial || body['currency'] !== undefined) {
    const currency = parseCurrency(body['currency']);
    if (currency === null) return { ok: false, reason: 'Выберите валюту цены' };
    value.currency = currency;
  }

  if (!partial || body['active'] !== undefined) {
    if (body['active'] !== undefined && typeof body['active'] !== 'boolean')
      return { ok: false, reason: 'Состояние услуги: «активна» или «в архиве»' };
    value.active = body['active'] === undefined ? true : body['active'];
  }

  if (partial && Object.keys(value).length === 0)
    return { ok: false, reason: 'Нечего менять: пришло пустое изменение' };
  return { ok: true, value };
}

export function parseLocationServiceInput(raw: unknown): ParseResult<LocationServiceInput> {
  const body = (raw ?? {}) as Record<string, unknown>;
  if (typeof body['enabled'] !== 'boolean')
    return { ok: false, reason: 'Укажите, оказывает ли филиал эту услугу' };

  // пусто: переопределения нет, действует каталог бизнеса (§19.1)
  const priceRaw = body['priceOverrideMinor'];
  let priceOverrideMinor: bigint | null = null;
  if (priceRaw !== undefined && priceRaw !== null && priceRaw !== '') {
    const parsed = parseMinor(priceRaw);
    if (parsed === null)
      return { ok: false, reason: 'Цена филиала: целое число в тиынах, не меньше нуля' };
    priceOverrideMinor = parsed;
  }

  const durationRaw = body['durationOverrideMinutes'];
  let durationOverrideMinutes: number | null = null;
  if (durationRaw !== undefined && durationRaw !== null && durationRaw !== '') {
    const parsed = parseMinutes(durationRaw);
    if (parsed === null)
      return { ok: false, reason: 'Длительность в филиале: целое число минут больше нуля' };
    durationOverrideMinutes = parsed;
  }

  return { ok: true, value: { enabled: body['enabled'], priceOverrideMinor, durationOverrideMinutes } };
}

export function parseEmployeeInput(
  raw: unknown,
  options: { partial?: boolean } = {},
): ParseResult<Partial<EmployeeInput>> {
  const body = (raw ?? {}) as Record<string, unknown>;
  const partial = options.partial === true;
  const value: Partial<EmployeeInput> = {};

  if (!partial || body['name'] !== undefined) {
    const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
    if (!name) return { ok: false, reason: 'Укажите имя мастера' };
    if (name.length > NAME_LIMIT)
      return { ok: false, reason: `Имя мастера: не больше ${NAME_LIMIT} символов` };
    value.name = name;
  }

  if (!partial || body['phone'] !== undefined) {
    const phone = typeof body['phone'] === 'string' ? body['phone'].trim() : '';
    if (phone.length > PHONE_LIMIT)
      return { ok: false, reason: `Телефон: не больше ${PHONE_LIMIT} символов` };
    value.phone = phone || null;
  }

  if (!partial || body['email'] !== undefined) {
    const email = typeof body['email'] === 'string' ? body['email'].trim().toLowerCase() : '';
    if (email) {
      if (email.length > EMAIL_LIMIT || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return { ok: false, reason: 'Почта мастера не похожа на почту' };
    }
    value.email = email || null;
  }

  if (!partial || body['active'] !== undefined) {
    if (body['active'] !== undefined && typeof body['active'] !== 'boolean')
      return { ok: false, reason: 'Состояние мастера: «работает» или «в архиве»' };
    value.active = body['active'] === undefined ? true : body['active'];
  }

  if (partial && Object.keys(value).length === 0)
    return { ok: false, reason: 'Нечего менять: пришло пустое изменение' };
  return { ok: true, value };
}

function parseMinutes(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseMinor(raw: unknown): bigint | null {
  if (typeof raw === 'bigint') return raw >= 0n ? raw : null;
  if (typeof raw === 'number') return Number.isInteger(raw) && raw >= 0 ? BigInt(raw) : null;
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  return BigInt(text);
}

function parseCurrency(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  return Intl.supportedValuesOf('currency').includes(code) ? code : null;
}
