/**
 * Учёт бюджета и расходов маркетинга (МКТ-В1/В2, DATA_MODEL §41, ADR-MKT-B1).
 * Деньги BigInt в minor units (ADR-008). Мультивалютность по ТЗ §8.3: сумма в валюте ввода,
 * курс к валюте отчётности фиксируется на дату операции, пересчёт считается здесь целыми
 * числами (курс в миллионных долях), float в деньгах запрещён.
 */

export class MarketingBudgetError extends Error {}

export const MARKETING_PLATFORMS = [
  'META',
  'GOOGLE',
  'TIKTOK',
  'INSTAGRAM',
  'YOUTUBE',
  'WHATSAPP',
  'SITE',
  'PHONE',
  'OTHER',
] as const;
export type MarketingPlatform = (typeof MARKETING_PLATFORMS)[number];

export interface MarketingExpenseInput {
  date: string;
  platform: MarketingPlatform;
  campaign: string | null;
  category: string;
  description: string | null;
  /** Сумма в валюте ввода, minor units */
  amount: bigint;
  currency: string;
  /** Курс к валюте отчётности десятичной строкой, до 6 знаков («1», «543.27») */
  fxRate: string;
  /** Сумма в валюте отчётности, minor units, по курсу на дату операции */
  baseAmount: bigint;
  countedInBudget: boolean;
  /** Кампания расхода (§53); её филиал проверяет API */
  campaignId: string | null;
}

const fail = (msg: string): never => {
  throw new MarketingBudgetError(msg);
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const optional = (v: unknown, max: number, name: string): string | null => {
  const s = str(v);
  if (s === '') return null;
  if (s.length > max) fail(`${name}: не больше ${max} знаков`);
  return s;
};

/** Дата ГГГГ-ММ-ДД, которая существует; отказ словами с названием поля */
export const isoDate = (v: unknown, name: string): string => {
  const s = str(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(`${name}: дата в виде ГГГГ-ММ-ДД`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s)
    fail(`${name}: такой даты нет`);
  return s;
};

/** «120», «456.23», «0,5» → minor units > 0 (свой разбор: расходу нужен отказ на нуле и минусе) */
const money = (v: unknown, name: string): bigint => {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(str(v));
  if (!m) fail(`${name}: число не больше двух знаков после запятой`);
  const minor = BigInt(m![1]!) * 100n + BigInt((m![2] ?? '').padEnd(2, '0'));
  if (minor <= 0n) fail(`${name}: сумма должна быть больше нуля`);
  if (minor > 10n ** 15n) fail(`${name}: сумма неправдоподобно велика`);
  return minor;
};

const RATE_SCALE = 1_000_000n;

/** Курс десятичной строкой → миллионные доли (целое). «543.27» → 543270000n */
const rateMicros = (v: unknown): bigint => {
  const m = /^(\d{1,8})(?:[.,](\d{1,6}))?$/.exec(str(v));
  if (!m) fail('Курс: число не больше шести знаков после запятой');
  const micros = BigInt(m![1]!) * RATE_SCALE + BigInt((m![2] ?? '').padEnd(6, '0'));
  if (micros <= 0n) fail('Курс должен быть больше нуля');
  return micros;
};

const rateString = (micros: bigint): string => {
  const whole = micros / RATE_SCALE;
  const frac = (micros % RATE_SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  return frac === '' ? whole.toString() : `${whole}.${frac}`;
};

/** Пересчёт в валюту отчётности: целыми, округление к ближайшему */
const toBase = (amount: bigint, rateMicros: bigint): bigint =>
  (amount * rateMicros + RATE_SCALE / 2n) / RATE_SCALE;

/** Кампания расхода: пусто или uuid */
const campaignIdOf = (v: unknown): string | null => {
  const s = str(v);
  if (s === '') return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) fail('Кампания: выберите из списка');
  return s.toLowerCase();
};

export function parseMarketingExpenseInput(
  body: Record<string, unknown>,
  ctx: { reportingCurrency: string },
): MarketingExpenseInput {
  const date = isoDate(body.date, 'Дата');
  const platform = MARKETING_PLATFORMS.find((p) => p === str(body.platform));
  if (!platform) fail('Платформа: выберите из списка каналов');
  const category = str(body.category);
  if (category === '') fail('Статья расхода обязательна');
  if (category.length > 100) fail('Статья: не больше 100 знаков');
  const campaign = optional(body.campaign, 200, 'Кампания');
  const description = optional(body.description, 500, 'Описание');
  const amount = money(body.amount, 'Сумма');
  const currency = (str(body.currency) || ctx.reportingCurrency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) fail('Валюта: трёхбуквенный код, например KZT или USD');
  let micros: bigint;
  if (currency === ctx.reportingCurrency.toUpperCase()) {
    micros = RATE_SCALE; // курс 1: пересчёт не нужен, присланное значение не ломает сумму
  } else {
    if (str(body.fxRate) === '')
      fail(`Курс ${currency} к ${ctx.reportingCurrency} на дату расхода обязателен`);
    micros = rateMicros(body.fxRate);
  }
  return {
    date,
    platform: platform!,
    campaign,
    category,
    description,
    amount,
    currency,
    fxRate: rateString(micros),
    baseAmount: toBase(amount, micros),
    countedInBudget: body.countedInBudget === undefined ? true : body.countedInBudget === true,
    campaignId: campaignIdOf(body.campaignId),
  };
}

export interface MarketingBudgetInput {
  /** Первое число месяца, ГГГГ-ММ-01 */
  month: string;
  /** План в валюте отчётности, minor units */
  amount: bigint;
}

/** «2026-10» или полная дата → первое число месяца */
const firstOfMonth = (v: unknown): string => {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(str(v));
  if (!m) fail('Месяц: в виде ГГГГ-ММ');
  const mm = Number(m![2]);
  if (mm < 1 || mm > 12) fail('Месяц: такого месяца нет');
  return `${m![1]}-${m![2]}-01`;
};

export function parseMarketingBudgetInput(body: Record<string, unknown>): MarketingBudgetInput {
  return { month: firstOfMonth(body.month), amount: money(body.amount, 'План') };
}

export interface MarketingBudgetLinesInput {
  /** Первое число месяца, ГГГГ-ММ-01 */
  month: string;
  /** Разбивка общего плана по каналам (§52); пустой список убирает разбивку месяца */
  lines: Array<{ platform: MarketingPlatform; amount: bigint }>;
}

/**
 * Разбивка плана месяца по каналам (DATA_MODEL §52, ADR-MKT-B7): вся разбивка месяца одним вводом, пустая сумма
 * значит «канала в плане нет». Сумма каналов больше общего плана не запрещается: это предупреждение на экране.
 */
export function parseMarketingBudgetLinesInput(body: Record<string, unknown>): MarketingBudgetLinesInput {
  const month = firstOfMonth(body.month);
  if (!Array.isArray(body.lines)) fail('Каналы: нужен список');
  const seen = new Set<string>();
  const lines: MarketingBudgetLinesInput['lines'] = [];
  for (const raw of body.lines as unknown[]) {
    const line = (raw ?? {}) as Record<string, unknown>;
    const platform = MARKETING_PLATFORMS.find((p) => p === str(line.platform));
    if (!platform) fail('Канал: выберите из списка каналов');
    if (seen.has(platform!)) fail(`Канал ${platform} указан дважды`);
    seen.add(platform!);
    const amount = str(line.amount).replace(/\s/g, '');
    if (amount === '') continue;
    lines.push({ platform: platform!, amount: money(amount, `План канала ${platform}`) });
  }
  return { month, lines };
}
