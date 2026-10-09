import {
  estimateNightOccupancy,
  platformNightUrl,
  type NightObservation,
} from '@pms/domain';

/**
 * ИИ-сборщик загрузки конкурентов (ADR-142, дополнение 09.10.2026; контракт `docs/market/collector.md`).
 *
 * Для каждого соседа со ссылкой на Booking.com или Trip.com открывает его страницу на каждую из ближайших ночей,
 * модель читает текст страницы (распродано, сколько номеров ещё можно забронировать), оценка загрузки уходит в WETOP
 * снимком дня с меткой «ИИ». Страница, закрытая проверкой площадки, не обходится: сборщик останавливается по этому
 * соседу и пишет причину. Здесь только порядок шагов; страница, модель и API передаются снаружи (`sources.ts`).
 */

export interface CollectorCompetitor {
  id: string;
  name: string;
  url: string | null;
  unitsTotal: number | null;
  timezone: string;
}

export interface CollectorApi {
  competitors(): Promise<CollectorCompetitor[]>;
  write(
    id: string,
    entries: Array<{ date: string; percent: number }>,
  ): Promise<{ saved: number; kept: number }>;
}

/** Текст страницы и код ответа; закрытая страница (403, 429) сразу считается проверкой площадки */
export type ReadPage = (url: string) => Promise<{ status: number; text: string }>;
export type ExtractNight = (
  text: string,
  context: { name: string; night: string },
) => Promise<NightObservation>;

export interface CompetitorReport {
  id: string;
  name: string;
  outcome: 'written' | 'dry-run' | 'skipped' | 'blocked' | 'no-data';
  reason: string | null;
  saved: number;
  kept: number;
  nights: Array<{ date: string; status: NightObservation['status']; bp: number | null }>;
}

export interface CollectOptions {
  /** сколько ночей вперёд, начиная с сегодня по поясу объекта соседа */
  nights: number;
  /** пауза между страницами: площадку не нагружаем */
  delayMs: number;
  dryRun: boolean;
  now?: Date;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}

/**
 * Коды, которыми площадка закрывает страницу от автомата. 202 так отвечает Booking.com: проба 09.10.2026 обычным
 * безголовым браузером дала 202 и пустую оболочку страницы без предложений (даты сброшены на сегодня).
 */
const BLOCKED_HTTP = new Set([202, 401, 403, 429]);

export function localDate(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
}

export function nightsFrom(first: string, count: number): string[] {
  const start = Date.parse(`${first}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  );
}

export async function collect(
  deps: { api: CollectorApi; readPage: ReadPage; extract: ExtractNight },
  options: CollectOptions,
): Promise<CompetitorReport[]> {
  const sleep = options.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = options.log ?? (() => undefined);
  const now = options.now ?? new Date();
  const reports: CompetitorReport[] = [];
  let first = true;

  for (const c of await deps.api.competitors()) {
    const report: CompetitorReport = {
      id: c.id,
      name: c.name,
      outcome: 'skipped',
      reason: null,
      saved: 0,
      kept: 0,
      nights: [],
    };
    reports.push(report);
    if (!c.url || !platformNightUrl(c.url, localDate(now, c.timezone))) {
      report.reason = 'нет ссылки на страницу соседа на Booking.com или Trip.com';
      log(`${c.name}: пропущен, ${report.reason}`);
      continue;
    }
    if (!c.unitsTotal) {
      report.reason = 'не указано число номеров у соседа: процент загрузки не посчитать';
      log(`${c.name}: пропущен, ${report.reason}`);
      continue;
    }

    const entries: Array<{ date: string; percent: number }> = [];
    for (const night of nightsFrom(localDate(now, c.timezone), options.nights)) {
      if (!first) await sleep(options.delayMs);
      first = false;
      const page = await deps.readPage(platformNightUrl(c.url, night)!);
      const observation: NightObservation = BLOCKED_HTTP.has(page.status)
        ? { status: 'blocked', roomsLeft: null }
        : await deps.extract(page.text, { name: c.name, night });
      if (observation.status === 'blocked') {
        report.outcome = 'blocked';
        report.reason = `площадка закрыла страницу проверкой (ночь ${night}): не обходим, повтор в следующий запуск`;
        report.nights.push({ date: night, status: 'blocked', bp: null });
        log(`${c.name}: ${report.reason}`);
        break;
      }
      const bp = estimateNightOccupancy(observation, c.unitsTotal);
      report.nights.push({ date: night, status: observation.status, bp });
      // API принимает процент до десятых; ночь без оценки не пишем, а не выдумываем
      if (bp !== null) entries.push({ date: night, percent: Math.round(bp / 10) / 10 });
    }

    if (entries.length === 0) {
      if (report.outcome !== 'blocked') {
        report.outcome = 'no-data';
        report.reason = 'на страницах не видно, сколько номеров осталось: оценки нет';
      }
      log(`${c.name}: записей нет${report.reason ? `, ${report.reason}` : ''}`);
      continue;
    }
    if (options.dryRun) {
      if (report.outcome !== 'blocked') report.outcome = 'dry-run';
      log(`${c.name}: проверка без записи, ночей с оценкой ${entries.length}`);
      continue;
    }
    const result = await deps.api.write(c.id, entries);
    report.saved = result.saved;
    report.kept = result.kept;
    if (report.outcome !== 'blocked') report.outcome = 'written';
    log(`${c.name}: записано ${result.saved}, ручной ввод сильнее: ${result.kept}`);
  }
  return reports;
}
