/**
 * Запуск рекламы из WETOP (DATA_MODEL §57, ADR-MKT-LAUNCH): правило денег и проверка настроек мастера. Чистые функции:
 * сервис API считает суммы из базы и зовёт их до Meta. Деньги целыми minor units (ADR-008), курс десятичной строкой.
 */
import type { AdDestination } from './ad-proposal';
import { MarketingBudgetError } from './budget';

const fail = (msg: string): never => {
  throw new MarketingBudgetError(msg);
};

/** Дни до конца месяца, включая сегодня; день в поясе филиала даёт вызывающий */
export function daysLeftInMonth(today: string): number {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate() - d + 1;
}

const RATE = /^(\d{1,8})(?:\.(\d{1,6}))?$/;

/** Бюджет дня в валюте отчётности: сумма × курс, вверх до тиына, чтобы предел не занижался */
export function toBaseMinor(minor: bigint, fxRate: string): bigint {
  const m = RATE.exec(fxRate);
  if (!m) return fail('Курс к валюте отчётности: число, до 6 знаков после точки');
  const scaled = BigInt(m[1]!) * 1_000_000n + BigInt((m[2] ?? '').padEnd(6, '0'));
  if (scaled <= 0n) return fail('Курс к валюте отчётности должен быть больше нуля');
  return (minor * scaled + 999_999n) / 1_000_000n;
}

const major = (minor: bigint) => {
  const whole = (minor / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const cents = minor % 100n;
  return cents === 0n ? whole : `${whole},${cents.toString().padStart(2, '0')}`;
};

/**
 * Решение владельца 16.10.2026, вариант «остаток плана / дни»: (дневные бюджеты действующих запусков кабинета + новый)
 * × оставшиеся дни месяца не больше плана канала Meta на месяц минус учтённый расход канала. Всё в валюте отчётности.
 */
export function checkLaunchBudget(q: {
  planMinor: bigint | null;
  spentMinor: bigint;
  activeDailyMinor: bigint;
  newDailyMinor: bigint;
  daysLeft: number;
}): void {
  if (q.planMinor === null)
    fail('Нет плана канала Meta на этот месяц: задайте его в «Бюджете», запуск сверяется с планом');
  const left = q.planMinor! - q.spentMinor;
  if (left <= 0n) fail('План канала Meta на этот месяц исчерпан: увеличьте план в «Бюджете»');
  const days = BigInt(q.daysLeft);
  if ((q.activeDailyMinor + q.newDailyMinor) * days > left) {
    const room = left / days - q.activeDailyMinor;
    fail(
      room > 0n
        ? `Остаток плана Meta на месяц позволяет новой кампании не больше ${major(room)} в день (в валюте отчётности)`
        : 'Остаток плана Meta на месяц уже занят идущими кампаниями: остановите одну или увеличьте план',
    );
  }
}

/** Сколько ещё можно поставить новой кампании в день по тому же правилу (подсказка мастера); null: плана нет */
export function launchBudgetRoom(q: {
  planMinor: bigint | null;
  spentMinor: bigint;
  activeDailyMinor: bigint;
  daysLeft: number;
}): bigint | null {
  if (q.planMinor === null) return null;
  const room = (q.planMinor - q.spentMinor) / BigInt(q.daysLeft) - q.activeDailyMinor;
  return room > 0n ? room : 0n;
}

export interface AdLaunchInput {
  requestKey: string;
  creativeId: string;
  destination: AdDestination;
  /** Бюджет дня в minor units валюты кабинета */
  dailyBudgetMinor: bigint;
  /** Курс к валюте отчётности, ручной (Q-MKT-FX); «1» при той же валюте */
  fxRate: string;
  headline: string;
  primaryText: string;
  description: string | null;
  pageId: string;
  instagramUserId: string | null;
  leadFormId: string | null;
  link: string | null;
  countryCode: string;
  cities: Array<{ key: string; name: string }>;
  ageMin: number;
  ageMax: number;
  genders: number[];
  advantageAudience: boolean;
  welcome: { text: string; autofill: string } | null;
  /** Предложение ИИ как пришло, для сравнения «ИИ / человек» (§57 `proposal`) */
  proposal: Record<string, unknown> | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const META_ID = /^\d{1,40}$/;
const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s === '' ? null : s.slice(0, max);
};
const id = (v: unknown, what: string, required: boolean): string | null => {
  const s = str(v, 40);
  if (s === null) return required ? fail(`Не выбрано: ${what}`) : null;
  return META_ID.test(s) ? s : fail(`Неверный номер: ${what}`);
};

export function parseLaunchInput(raw: unknown): AdLaunchInput {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const requestKey =
    typeof b.requestKey === 'string' && UUID.test(b.requestKey)
      ? b.requestKey.toLowerCase()
      : fail('Повторите запуск из мастера');
  const creativeId =
    typeof b.creativeId === 'string' && UUID.test(b.creativeId)
      ? b.creativeId.toLowerCase()
      : fail('Загрузите креатив');
  const destination = b.destination as AdDestination;
  if (destination === 'MESSENGER' || destination === 'INSTAGRAM_DIRECT')
    fail('Реклама в Messenger и Instagram Direct из WETOP пока не запускается');
  if (!['LEAD_FORM', 'WHATSAPP', 'WEBSITE'].includes(destination))
    fail('Выберите, куда ведёт реклама');
  const budget =
    typeof b.dailyBudgetMinor === 'string' && /^\d{1,15}$/.test(b.dailyBudgetMinor)
      ? BigInt(b.dailyBudgetMinor)
      : 0n;
  if (budget <= 0n) fail('Бюджет в день: целая сумма больше нуля');
  const fxRate = typeof b.fxRate === 'string' ? b.fxRate.trim() : '';
  toBaseMinor(1n, fxRate);
  const headline = str(b.headline, 40) ?? fail('Нужен заголовок');
  const primaryText = str(b.primaryText, 500) ?? fail('Нужен текст объявления');
  const leadFormId = id(b.leadFormId, 'форма заявок', destination === 'LEAD_FORM');
  const link = str(b.link, 1000);
  if (destination === 'WEBSITE' && !(link && /^https:\/\/[^\s/]+\.[^\s]+$/.test(link)))
    fail('Адрес сайта: полный, с https://');
  const countryCode =
    typeof b.countryCode === 'string' && /^[A-Z]{2}$/.test(b.countryCode)
      ? b.countryCode
      : fail('Укажите страну');
  const cities = (Array.isArray(b.cities) ? b.cities : []).slice(0, 25).map((c) => {
    const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    const key =
      typeof o.key === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(o.key)
        ? o.key
        : fail('Город выберите из списка');
    return { key, name: str(o.name, 100) ?? key };
  });
  const age = (v: unknown) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 18 && v <= 65
      ? v
      : fail('Возраст от 18 до 65');
  const ageMin = age(b.ageMin);
  const ageMax = age(b.ageMax);
  if (ageMin > ageMax) fail('Возраст «от» больше, чем «до»');
  const advantageAudience = b.advantageAudience === true;
  if (advantageAudience && ageMin > 25)
    fail('С расширением аудитории Meta минимальный возраст только 18–25');
  const genders =
    Array.isArray(b.genders) && b.genders.length === 1 && (b.genders[0] === 1 || b.genders[0] === 2)
      ? [b.genders[0] as number]
      : [];
  const w = (b.welcome && typeof b.welcome === 'object' ? b.welcome : null) as Record<
    string,
    unknown
  > | null;
  const text = w ? str(w.text, 200) : null;
  const autofill = w ? str(w.autofill, 100) : null;
  return {
    requestKey,
    creativeId,
    destination,
    dailyBudgetMinor: budget,
    fxRate,
    headline,
    primaryText,
    description: str(b.description, 30),
    pageId: id(b.pageId, 'страница Facebook', true)!,
    instagramUserId: id(b.instagramUserId, 'Instagram', false),
    leadFormId,
    link: destination === 'WEBSITE' ? link : null,
    countryCode,
    cities,
    ageMin,
    ageMax,
    genders,
    advantageAudience,
    welcome: destination === 'WHATSAPP' && text && autofill ? { text, autofill } : null,
    proposal:
      b.proposal && typeof b.proposal === 'object' ? (b.proposal as Record<string, unknown>) : null,
  };
}
