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

/** Последний отчёт каждого вида (`<вид>-YYYY-MM-DD.md`, как у утреннего отчёта) и его строка RESULT */
export function latestReportResults(
  files: string[],
  kinds: string[],
  read: (file: string) => string,
): ReportResult[] {
  const out: ReportResult[] = [];
  for (const kind of kinds) {
    const re = new RegExp(`^${kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}-\\d{2}-\\d{2}\\.md$`);
    const file = files.filter((f) => re.test(f)).sort().at(-1);
    if (!file) continue;
    const line = read(file).split('\n').find((l) => /RESULT/.test(l))?.trim() ?? null;
    const result = line ? (/FAIL/.test(line) ? 'FAIL' : /PASS/.test(line) ? 'PASS' : null) : null;
    out.push({ kind, file, result, line });
  }
  return out;
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
  const last = new Map<string, { status: string; startedAt: string; failures: Array<{ file?: string | null; message?: string }> }>();
  for (const raw of jsonl.split('\n')) {
    let r: { suite?: string; status?: string; startedAt?: string; args?: unknown[]; failures?: Array<{ file?: string | null; message?: string }> };
    try {
      r = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!r.suite || !r.startedAt || !r.status || (r.args?.length ?? 0) > 0 || r.status === 'interrupted') continue;
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
      first: r.failures[0] ? `${r.failures[0].file ?? '?'}: ${r.failures[0].message ?? ''}`.trim() : null,
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
 * мужской дом, 37 проживаний на 36 коек, пришло из Exely).
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
        (i) => i.accommodationTypeCode === u.code && i.arrivalDate <= date && date < i.departureDate,
      ).length;
      const capacity = Math.max(0, u.active - blocked);
      if (sold > capacity) out.push({ code: u.code, date, capacity, sold });
    }
  return out;
}
