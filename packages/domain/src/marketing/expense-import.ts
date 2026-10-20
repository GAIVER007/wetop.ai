/**
 * Импорт расходов маркетинга из CSV (МКТ-В2, ТЗ «Модуль Маркетинг» 1.0 «импорт данных»).
 * Формат тот же, что у выгрузки «Бюджета»: выгрузил, поправил в Excel, загрузил обратно.
 * Колонки ищутся по заголовку, порядок не важен; «Сумма, KZT» из файла не берётся, пересчёт по курсу
 * делает тот же разбор, что у ручного ввода. Файл принимается целиком или не принимается вовсе.
 */
import {
  MARKETING_PLATFORMS,
  MarketingBudgetError,
  parseMarketingExpenseInput,
  type MarketingExpenseInput,
  type MarketingPlatform,
} from './budget';

/** Подписи платформ: в выгрузке, на экранах и при разборе импорта */
export const MARKETING_PLATFORM_LABELS: Record<MarketingPlatform, string> = {
  META: 'Meta Ads',
  GOOGLE: 'Google Ads',
  TIKTOK: 'TikTok Ads',
  INSTAGRAM: 'Instagram',
  YOUTUBE: 'YouTube',
  WHATSAPP: 'WhatsApp',
  SITE: 'Сайт',
  PHONE: 'Телефон',
  OTHER: 'Прочие',
};

export const MARKETING_IMPORT_MAX_ROWS = 1000;

/** Строка импорта: разобранный расход и номер строки файла (для журнала аудита) */
export type ImportedExpense = MarketingExpenseInput & { line: number };

const COLUMNS = {
  date: 'дата',
  platform: 'платформа',
  campaign: 'кампания',
  category: 'статья',
  description: 'описание',
  amount: 'сумма',
  currency: 'валюта',
  fxRate: 'курс',
  countedInBudget: 'в бюджете',
} as const;
const REQUIRED = ['date', 'platform', 'category', 'amount'] as const;
type Column = keyof typeof COLUMNS;

const fail = (msg: string): never => {
  throw new MarketingBudgetError(msg);
};

/** Разделитель по заголовку: Excel в русской раскладке пишет «;», Google Таблицы «,», копия таблицы табуляцию */
export function delimiterOf(header: string): string {
  return [';', ',', '\t'].reduce((best, c) => (header.split(c).length > header.split(best).length ? c : best));
}

/** Записи CSV по RFC 4180: поле в кавычках может содержать разделитель и перевод строки */
export function splitRecords(text: string, delimiter: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      out.push([...row, field]);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) out.push([...row, field]);
  return out;
}

/** «05.10.2026» и «5.10.2026» (так дату пересохраняет Excel) → «2026-10-05»; остальное как есть */
export const excelDate = (s: string): string => {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}` : s;
};

/** Код или подпись платформы без учёта регистра; неизвестное уходит как есть, отказ даст общий разбор */
const platformOf = (s: string): string => {
  const v = s.toLowerCase();
  return (
    MARKETING_PLATFORMS.find((p) => p.toLowerCase() === v || MARKETING_PLATFORM_LABELS[p].toLowerCase() === v) ?? s
  );
};

const countedOf = (s: string, line: number): boolean => {
  const v = s.toLowerCase();
  if (v === '' || v === 'да') return true;
  if (v === 'нет') return false;
  return fail(`Строка ${line}: В бюджете: «да» или «нет»`);
};

export function parseMarketingExpensesCsv(
  text: string,
  ctx: { reportingCurrency: string },
): ImportedExpense[] {
  const body = text.replace(/^\uFEFF/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const records = splitRecords(body, delimiterOf(firstLine));
  const [header = [], ...rest] = records;
  const at = new Map<Column, number>();
  const names = header.map((h) => h.trim().toLowerCase());
  for (const [key, name] of Object.entries(COLUMNS) as Array<[Column, string]>) {
    const i = names.indexOf(name);
    if (i >= 0) at.set(key, i);
  }
  const lines = rest
    .map((cells, i) => ({ cells, line: i + 2 }))
    .filter(({ cells }) => cells.some((c) => c.trim() !== ''));
  if (lines.length === 0) fail('В файле нет ни одной строки расходов');
  const missing = REQUIRED.find((k) => !at.has(k));
  if (missing) fail(`В файле нет колонки «${COLUMNS[missing][0]!.toUpperCase()}${COLUMNS[missing].slice(1)}»`);
  if (lines.length > MARKETING_IMPORT_MAX_ROWS)
    fail(`За раз не больше ${MARKETING_IMPORT_MAX_ROWS} строк, в файле ${lines.length}`);

  const rows: ImportedExpense[] = [];
  const errors: string[] = [];
  for (const { cells, line } of lines) {
    const cell = (k: Column) => (at.has(k) ? (cells[at.get(k)!] ?? '').trim() : '');
    try {
      rows.push({
        line,
        ...parseMarketingExpenseInput(
          {
            date: excelDate(cell('date')),
            platform: platformOf(cell('platform')),
            campaign: cell('campaign'),
            category: cell('category'),
            description: cell('description'),
            amount: cell('amount').replace(/\s/g, ''),
            currency: cell('currency'),
            fxRate: cell('fxRate').replace(/\s/g, ''),
            countedInBudget: countedOf(cell('countedInBudget'), line),
          },
          ctx,
        ),
      });
    } catch (e) {
      if (!(e instanceof MarketingBudgetError)) throw e;
      errors.push(e.message.startsWith('Строка ') ? e.message : `Строка ${line}: ${e.message}`);
    }
  }
  if (errors.length > 0) {
    const shown = errors.slice(0, 10);
    if (errors.length > 10) shown.push(`и ещё ${errors.length - 10} строк с ошибками`);
    fail(`Файл не загружен, ничего не записано:\n${shown.join('\n')}`);
  }
  return rows;
}
