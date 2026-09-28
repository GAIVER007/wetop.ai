/**
 * Сигналы, из которых сторож собирает неисправности: текст ошибки (временная или постоянная), отчёты сверок,
 * журнал прогонов тестов, овербукинг по ночам. Всё — чистые функции над уже прочитанными данными.
 */
import { dateRange } from '../chessboard/build';
import type { CategoryBlock, CategoryUnits, SoldItem } from '../availability/category';

/**
 * Временная ошибка — сеть, таймаут, 5xx и 429 Channex, обрыв соединения с базой: повтор имеет смысл.
 * Всё остальное (правило ADR-024, валидация, 4xx, неизвестный текст) — постоянная: повторять бессмысленно,
 * нужен человек. Сомнение решается в сторону «постоянная» — лучше разбудить, чем крутить повтор.
 * Формы текста — из `packages/integrations/src/channex/client.ts`: «сеть — …» и «HTTP <код>».
 */
const TRANSIENT = [
  /сеть —/i,
  /\bHTTP (?:5\d\d|429)\b/,
  /fetch failed|socket hang up|network/i,
  /\bE(?:CONNRESET|CONNREFUSED|TIMEDOUT|NOTFOUND|AI_AGAIN|PIPE)\b/,
  /time(?:d)? ?out|aborted/i,
  /\bP(?:1001|1002|1017|2024)\b|Can't reach database|Connection terminated|terminating connection/i,
  /\b08006\b|\b08001\b|EAUTHTIMEOUT|Database error\. Code: `08/i,
  // Prisma P1017: код лежит в `e.code`, в тексте — только эта фраза. 20.09.2026 такой обрыв с Mac
  // разработчика записался неисправностью «ошибка программы» и ждал человека сутки.
  /Server has closed the connection|Connection reset by peer/i,
];

export function classifyError(text: string | null | undefined): 'transient' | 'permanent' {
  if (!text) return 'permanent';
  return TRANSIENT.some((re) => re.test(text)) ? 'transient' : 'permanent';
}

export interface ReportResult {
  kind: string;
  file: string;
  result: 'PASS' | 'FAIL' | null;
  line: string | null;
}

/**
 * Данные с диска стареют молча. В контейнере `/app` — слепок на момент сборки образа: файлы там
 * больше не меняются, и «сверка дала FAIL» или «падает набор» повторяли бы день сборки вечно,
 * будя дежурного по состоянию недельной давности (разбор 21.09.2026). Поэтому смотрим не на
 * выключатель в окружении, а на возраст самих данных: двое суток — это вчерашний отчёт, который
 * ещё описывает сегодняшнее положение, и уже не слепок образа, собранного позавчера.
 */
export const LOCAL_FILE_FRESH_MS = 48 * 3_600_000;

/** Отчёт за день из имени файла: `<вид>-ГГГГ-ММ-ДД.md`. Без даты в имени — судить не о чем. */
export function reportIsFresh(file: string, now: Date): boolean {
  const day = /-(\d{4}-\d{2}-\d{2})\.md$/.exec(file)?.[1];
  const at = day ? Date.parse(`${day}T00:00:00Z`) : NaN;
  return Number.isFinite(at) && now.getTime() - at <= LOCAL_FILE_FRESH_MS;
}

/** Прогон набора тестов: время начала пишет сам журнал. */
export function suiteRunIsFresh(startedAt: string, now: Date): boolean {
  const at = Date.parse(startedAt);
  return Number.isFinite(at) && now.getTime() - at <= LOCAL_FILE_FRESH_MS;
}

/** Последний отчёт каждого вида (`<вид>-YYYY-MM-DD.md`, как у утреннего отчёта) и его строка RESULT */
export function latestReportResults(
  files: string[],
  kinds: string[],
  read: (file: string) => string,
): ReportResult[] {
  const out: ReportResult[] = [];
  for (const kind of kinds) {
    const re = new RegExp(
      `^${kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}-\\d{2}-\\d{2}\\.md$`,
    );
    const file = files
      .filter((f) => re.test(f))
      .sort()
      .at(-1);
    if (!file) continue;
    const line =
      read(file)
        .split('\n')
        .find((l) => /RESULT/.test(l))
        ?.trim() ?? null;
    const result = line ? (/FAIL/.test(line) ? 'FAIL' : /PASS/.test(line) ? 'PASS' : null) : null;
    out.push({ kind, file, result, line });
  }
  return out;
}

/**
 * Аргументы, сужающие набор тестов. Прогон с ними набор не доказывает — ни в плюс, ни в минус.
 * Флаги вида «как запускать» (сколько воркеров, какой отчёт, сколько повторов) набор не сужают:
 * на машине с 8 ГБ сквозные идут только `--workers=1`, и такой прогон обязан считаться полным,
 * иначе полного прогона на ней не бывает вовсе (15.09.2026: неисправность «падает e2e» висела двое суток).
 */
const NARROWING_FLAGS = new Set([
  '-g',
  '--grep',
  '--grep-invert',
  '-t',
  '--testNamePattern',
  '--project',
  '--config',
  '-c',
  '--dir',
  '--shard',
  '--last-failed',
  '--only-changed',
  '--changed',
]);

/** Флаги «как запускать», берущие значение отдельным словом: это слово — не путь к тестам */
const VALUE_FLAGS = new Set([
  '--workers',
  '-j',
  '--reporter',
  '--retries',
  '--timeout',
  '--global-timeout',
  '--max-failures',
  '--output',
  '--outputFile',
  '--trace',
]);

export function narrowsTestSelection(args: readonly string[]): boolean {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!.trim();
    if (!arg) continue;
    // Позиционный аргумент — путь или кусок имени файла: это выбор конкретных тестов
    if (!arg.startsWith('-')) return true;
    const name = arg.split('=')[0]!;
    if (NARROWING_FLAGS.has(name)) return true;
    // Значение флага пропускаем, иначе «--workers 1» прочиталось бы как путь к тестам.
    // Незнакомый флаг со значением отдельным словом даст «сужает» — сторона безопасная:
    // такой прогон просто не засчитается как доказательство набора.
    if (VALUE_FLAGS.has(name) && !arg.includes('=')) i++;
  }
  return false;
}

export interface FailingSuite {
  suite: string;
  startedAt: string;
  failures: number;
  first: string | null;
}

/**
 * Наборы, чей последний ПОЛНЫЙ прогон красный (журнал `tests/runs/journal.jsonl`, TESTING.md).
 * Частичный (с аргументами) и прерванный прогоны набор не доказывают — ни в плюс, ни в минус.
 */
export function failingSuites(jsonl: string): FailingSuite[] {
  const last = new Map<
    string,
    {
      status: string;
      startedAt: string;
      failures: Array<{ file?: string | null; message?: string }>;
    }
  >();
  for (const raw of jsonl.split('\n')) {
    let r: {
      suite?: string;
      status?: string;
      startedAt?: string;
      args?: string[];
      failures?: Array<{ file?: string | null; message?: string }>;
    };
    try {
      r = JSON.parse(raw);
    } catch {
      continue;
    }
    if (
      !r.suite ||
      !r.startedAt ||
      !r.status ||
      narrowsTestSelection(r.args ?? []) ||
      r.status === 'interrupted'
    )
      continue;
    const prev = last.get(r.suite);
    if (!prev || r.startedAt >= prev.startedAt)
      last.set(r.suite, { status: r.status, startedAt: r.startedAt, failures: r.failures ?? [] });
  }
  return [...last.entries()]
    .filter(([, r]) => r.status === 'failed')
    .map(([suite, r]) => ({
      suite,
      startedAt: r.startedAt,
      failures: r.failures.length,
      first: r.failures[0]
        ? `${r.failures[0].file ?? '?'}: ${r.failures[0].message ?? ''}`.trim()
        : null,
    }));
}

export interface OverbookedNight {
  code: string;
  date: string;
  /** активные ячейки − заблокированные на эту ночь */
  capacity: number;
  sold: number;
}

/**
 * Ночи, где продано больше, чем ячеек категории можно занять. `categoryAvailability` в этом месте показывает 0
 * (канал больше не продаёт), но гостю уже некуда встать — это и есть неисправность класса Б (12.09.2026:
 * мужской дом, 37 проживаний на 36 коек, пришло из внешней системы).
 */
export function overbookedNights(input: {
  from: string;
  to: string;
  units: CategoryUnits[];
  blocks: CategoryBlock[];
  items: SoldItem[];
}): OverbookedNight[] {
  const out: OverbookedNight[] = [];
  for (const u of input.units)
    for (const date of dateRange(input.from, input.to)) {
      const blocked = input.blocks.filter(
        (b) => b.accommodationTypeCode === u.code && b.dateFrom <= date && date < b.dateTo,
      ).length;
      const sold = input.items.filter(
        (i) =>
          i.accommodationTypeCode === u.code && i.arrivalDate <= date && date < i.departureDate,
      ).length;
      const capacity = Math.max(0, u.active - blocked);
      if (sold > capacity) out.push({ code: u.code, date, capacity, sold });
    }
  return out;
}

export interface OversoldNight {
  code: string;
  date: string;
  pms: number;
  channel: number;
}

/**
 * Где канал видит мест больше, чем есть в PMS (T6: такой канал продаст лишнее). Меньше — недопродажа, не авария.
 * Дата, которой канал не вернул, не считается: «не видно» — это не «продаёт».
 */
export function channelOversold(input: {
  pms: Map<string, Map<string, number>>;
  channel: Map<string, Map<string, number>>;
}): OversoldNight[] {
  const out: OversoldNight[] = [];
  for (const [code, perDate] of input.pms)
    for (const [date, pms] of perDate) {
      const channel = input.channel.get(code)?.get(date);
      if (channel !== undefined && channel > pms) out.push({ code, date, pms, channel });
    }
  return out;
}

/**
 * Статус последней удачной ночной копии базы (ADR-078). Одну строку JSON пишет `scripts/ops/db-backup.sh` после
 * проверенной копии. Сторож стойки видит только её: ни самих копий, ни адреса базы.
 */
export interface BackupStatus {
  at: Date;
  file: string;
  bytes: number;
  tables: number;
}

/** Копия ночная; 26 часов — сутки плюс запас, как у полной выгрузки ARI */
export const BACKUP_STALE_MS = 26 * 3_600_000;

const positiveInteger = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

/** Разбор строгий: чего не понял — того нет. Тогда сторож скажет «статус не читается», а не «копия свежая». */
export function parseBackupStatus(text: string): BackupStatus | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { at, file, bytes, tables } = raw as Record<string, unknown>;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  // только имя файла, без пути: статус описывает копию в своей папке
  if (typeof file !== 'string' || !/^[\w.-]+$/.test(file) || file.startsWith('.')) return null;
  if (!positiveInteger(bytes) || !positiveInteger(tables)) return null;
  return { at: new Date(at), file, bytes, tables };
}
