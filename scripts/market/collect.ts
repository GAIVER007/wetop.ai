import {
  availabilityLevelFromPage,
  estimateNightOccupancy,
  platformNightUrl,
  type AvailabilityLevel,
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
    entries: CollectedNight[],
  ): Promise<{ saved: number; kept: number }>;
}

/** Ночь для WETOP: процент, если он считается, и уровень наличия (DATA_MODEL §23.1); хотя бы одно из двух */
export interface CollectedNight {
  date: string;
  percent?: number;
  level?: AvailabilityLevel;
}

/** Текст страницы и код ответа; закрытая страница (403, 429) сразу считается проверкой площадки */
export type ReadPage = (url: string) => Promise<{ status: number; text: string }>;
export type ExtractNight = (
  text: string,
  context: { name: string; night: string; url: string },
) => Promise<NightObservation>;

export interface CompetitorReport {
  id: string;
  name: string;
  outcome: 'written' | 'dry-run' | 'skipped' | 'blocked' | 'no-data';
  reason: string | null;
  saved: number;
  kept: number;
  nights: Array<{
    date: string;
    status: NightObservation['status'];
    bp: number | null;
    level?: AvailabilityLevel | null;
  }>;
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
      report.reason = 'нет ссылки на страницу соседа на Booking.com, Trip.com или Ostrovok';
      log(`${c.name}: пропущен, ${report.reason}`);
      continue;
    }
    // без числа номеров процента не будет, но уровень наличия от него не зависит (DATA_MODEL §23.1)
    const entries: CollectedNight[] = [];
    for (const night of nightsFrom(localDate(now, c.timezone), options.nights)) {
      if (!first) await sleep(options.delayMs);
      first = false;
      // одна страница не открылась (таймаут, обрыв сети): эта ночь без оценки, прогон идёт дальше. Иначе падал
      // весь прогон вместе с уже собранным (проба 09.10.2026, таймаут на 16.10 у пятого соседа)
      const url = platformNightUrl(c.url, night)!;
      const page = await deps.readPage(url).catch((e: unknown) => {
        log(`${c.name}, ${night}: страница не открылась (${e instanceof Error ? e.message.split('\n')[0] : e})`);
        return null;
      });
      if (page === null) {
        report.nights.push({ date: night, status: 'unknown', bp: null });
        continue;
      }
      const observation: NightObservation = BLOCKED_HTTP.has(page.status)
        ? { status: 'blocked', roomsLeft: null }
        : await deps.extract(page.text, { name: c.name, night, url });
      if (observation.status === 'blocked') {
        report.outcome = 'blocked';
        report.reason = `площадка закрыла страницу проверкой (ночь ${night}): не обходим, повтор в следующий запуск`;
        report.nights.push({ date: night, status: 'blocked', bp: null });
        log(`${c.name}: ${report.reason}`);
        break;
      }
      const bp = estimateNightOccupancy(observation, c.unitsTotal);
      const level = availabilityLevelFromPage(observation);
      report.nights.push({ date: night, status: observation.status, bp, level });
      // API принимает процент до десятых; ночь, где не известно ни то, ни другое, не пишем, а не выдумываем
      if (bp !== null || level !== null)
        entries.push({
          date: night,
          ...(bp !== null && { percent: Math.round(bp / 10) / 10 }),
          ...(level !== null && { level }),
        });
    }

    if (entries.length === 0) {
      if (report.outcome !== 'blocked') {
        report.outcome = 'no-data';
        report.reason = 'страницы не разобраны: ни процента, ни уровня';
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
