/**
 * Рекламные кампании и их статистика по дням (DATA_MODEL §53, ADR-MKT-B3, этап МКТ-В3 ручная часть). Показы, клики и
 * лиды площадки вводятся вручную или CSV; деньги кампании это её расходы из журнала (§41.1), отдельной суммы нет.
 * Показатели считаются целыми: CTR в сотых долях процента, CPC, CPM и CPL в minor units (ADR-008).
 */
import { MARKETING_PLATFORMS, MarketingBudgetError, isoDate, type MarketingPlatform } from './budget';
import { delimiterOf, excelDate, splitRecords } from './expense-import';

export const MARKETING_CAMPAIGN_STATUSES = ['ACTIVE', 'PAUSED', 'FINISHED'] as const;
export type MarketingCampaignStatus = (typeof MARKETING_CAMPAIGN_STATUSES)[number];

export interface MarketingCampaignInput {
  platform: MarketingPlatform;
  name: string;
  status: MarketingCampaignStatus;
  startsOn: string | null;
  endsOn: string | null;
}

export interface MarketingCampaignStatsInput {
  date: string;
  impressions: number;
  clicks: number;
  leads: number;
}

const fail = (msg: string): never => {
  throw new MarketingBudgetError(msg);
};
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const optionalDate = (v: unknown, name: string): string | null => (str(v) === '' ? null : isoDate(v, name));

export function parseCampaignInput(body: Record<string, unknown>): MarketingCampaignInput {
  const platform = MARKETING_PLATFORMS.find((p) => p === str(body.platform));
  if (!platform) fail('Платформа: выберите из списка каналов');
  const name = str(body.name).replace(/\s+/g, ' ');
  if (name === '') fail('Название кампании обязательно');
  if (name.length > 200) fail('Название: не больше 200 знаков');
  const status = str(body.status) === '' ? 'ACTIVE' : MARKETING_CAMPAIGN_STATUSES.find((s) => s === str(body.status));
  if (!status) fail('Статус: идёт, на паузе или завершена');
  const startsOn = optionalDate(body.startsOn, 'Начало');
  const endsOn = optionalDate(body.endsOn, 'Окончание');
  if (startsOn && endsOn && endsOn < startsOn) fail('Окончание не может быть раньше начала');
  return { platform: platform!, name, status: status!, startsOn, endsOn };
}

/** Неотрицательное целое; пустое это ноль; пробелы в тысячах допустимы */
const count = (v: unknown, name: string): number => {
  const s = (typeof v === 'number' ? String(v) : str(v)).replace(/\s/g, '');
  if (s === '') return 0;
  if (!/^\d{1,10}$/.test(s)) fail(`${name}: целое число не меньше нуля`);
  const n = Number(s);
  if (n > 2_000_000_000) fail(`${name}: число неправдоподобно велико`);
  return n;
};

export function parseCampaignStatsInput(body: Record<string, unknown>): MarketingCampaignStatsInput {
  const date = isoDate(body.date, 'Дата');
  const impressions = count(body.impressions, 'Показы');
  const clicks = count(body.clicks, 'Клики');
  const leads = count(body.leads, 'Лиды');
  if (clicks > impressions) fail('Кликов не может быть больше показов');
  return { date, impressions, clicks, leads };
}

const COLUMNS = { date: 'дата', impressions: 'показы', clicks: 'клики', leads: 'лиды' } as const;
export const CAMPAIGN_STATS_MAX_ROWS = 400;

/**
 * CSV статистики одной кампании: «Дата;Показы;Клики;Лиды», колонки по заголовку, те же правила файла, что у импорта
 * расходов (разделитель, BOM, дата из Excel). Ошибка в любой строке отклоняет файл целиком; день дважды это ошибка.
 */
export function parseCampaignStatsCsv(text: string): Array<MarketingCampaignStatsInput & { line: number }> {
  const body = text.replace(/^\uFEFF/, '');
  const [header = [], ...rest] = splitRecords(body, delimiterOf(body.split(/\r?\n/, 1)[0] ?? ''));
  const names = header.map((h) => h.trim().toLowerCase());
  const at = (k: keyof typeof COLUMNS) => names.indexOf(COLUMNS[k]);
  if (at('date') < 0) fail('В файле нет колонки «Дата»');
  const lines = rest
    .map((cells, i) => ({ cells, line: i + 2 }))
    .filter(({ cells }) => cells.some((c) => c.trim() !== ''));
  if (lines.length === 0) fail('В файле нет ни одной строки статистики');
  if (lines.length > CAMPAIGN_STATS_MAX_ROWS) fail(`За раз не больше ${CAMPAIGN_STATS_MAX_ROWS} дней, в файле ${lines.length}`);
  const rows: Array<MarketingCampaignStatsInput & { line: number }> = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const { cells, line } of lines) {
    const cell = (k: keyof typeof COLUMNS) => (at(k) < 0 ? '' : (cells[at(k)] ?? '').trim());
    try {
      const row = parseCampaignStatsInput({
        date: excelDate(cell('date')),
        impressions: cell('impressions'),
        clicks: cell('clicks'),
        leads: cell('leads'),
      });
      if (seen.has(row.date)) fail(`день ${row.date} указан дважды`);
      seen.add(row.date);
      rows.push({ line, ...row });
    } catch (e) {
      if (!(e instanceof MarketingBudgetError)) throw e;
      errors.push(`Строка ${line}: ${e.message}`);
    }
  }
  if (errors.length > 0) {
    const shown = errors.slice(0, 10);
    if (errors.length > 10) shown.push(`и ещё ${errors.length - 10} строк с ошибками`);
    fail(`Файл не загружен, ничего не записано:\n${shown.join('\n')}`);
  }
  return rows;
}

const divRound = (a: bigint, b: bigint): bigint => (a * 2n + b) / (b * 2n);

export interface CampaignMetrics {
  /** CTR в сотых долях процента: 120 это 1,20 % */
  ctrBp: number | null;
  cpcMinor: bigint | null;
  /** Стоимость тысячи показов */
  cpmMinor: bigint | null;
  /** Стоимость лида площадки */
  cplMinor: bigint | null;
}

/** Показатели кампании из расхода и статистики; делить не на что: null, а не ноль */
export function campaignMetrics(m: { spendMinor: bigint; impressions: number; clicks: number; leads: number }): CampaignMetrics {
  const per = (count: number, scale = 1n) =>
    m.spendMinor > 0n && count > 0 ? divRound(m.spendMinor * scale, BigInt(count)) : null;
  return {
    ctrBp: m.impressions > 0 ? Number(divRound(BigInt(m.clicks) * 10000n, BigInt(m.impressions))) : null,
    cpcMinor: per(m.clicks),
    cpmMinor: per(m.impressions, 1000n),
    cplMinor: per(m.leads),
  };
}
