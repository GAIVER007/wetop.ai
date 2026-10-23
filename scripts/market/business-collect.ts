import { dikidiCompanyId, dikidiDaySlots, restoplaceAddress, restoplaceFreeTables } from '@pms/domain';

/**
 * Сборщик загрузки соседей салона и ресторана (DATA_MODEL §60, план `plans/2026-10-23-competitors-business-manual.md`
 * срез 3, проба `reports/2026-10-23-competitor-platform-probe.md`). Читает публичные виджеты без входа и без
 * отправки записи: Dikidi (окна салона) и Restoplace (свободные столы ресторана). YCLIENTS отдаёт окна только с
 * токеном виджета, его не подставляем: такие соседи пропускаются с причиной. Ответ 401/403/429 или страница проверки — сосед закрыт, обходить не пробуем. Имена мастеров, телефоны и
 * отзывы не сохраняются и не печатаются: из ответа берутся только даты и время свободных окон.
 */
export interface BusinessTarget {
  id: string;
  name: string;
  url: string;
  platform: string;
  timezone: string;
}

export interface BusinessCollectorApi {
  competitors(): Promise<BusinessTarget[]>;
  write(id: string, entries: Array<{ day: string; freeSlots: number }>): Promise<{ saved: number; kept: number }>;
}

/** GET JSON или HTML с куки сессии площадки; status и тело как есть */
export type Fetcher = (url: string, kind: 'page' | 'json') => Promise<{ status: number; body: string }>;
/** POST формы (виджет Restoplace спрашивает день так же) */
export type Poster = (url: string, form: Record<string, string>) => Promise<{ status: number; body: string }>;

export interface BusinessReport {
  id: string;
  name: string;
  outcome: 'written' | 'dry-run' | 'skipped' | 'blocked' | 'no-data';
  reason: string | null;
  days: Array<{ day: string; freeSlots: number | null }>;
  saved: number;
  kept: number;
}

const BLOCKED = new Set([401, 403, 429]);
const DIKIDI = 'https://dikidi.net';

export function localDay(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
}

export function daysFrom(first: string, count: number): string[] {
  const start = Date.parse(`${first}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
}

class Blocked extends Error {}

function json(res: { status: number; body: string }): unknown {
  if (BLOCKED.has(res.status) || /captcha/i.test(res.body.slice(0, 2000))) throw new Blocked(`HTTP ${res.status}`);
  if (res.status !== 200) return null;
  try {
    return JSON.parse(res.body) as unknown;
  } catch {
    return null;
  }
}

/** Первая услуга салона в виджете: по ней виджет показывает свободные окна (так видит гость, который пришёл записаться) */
export function firstDikidiService(data: unknown): string | null {
  let found: string | null = null;
  const walk = (x: unknown): void => {
    if (found || !x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    const o = x as Record<string, unknown>;
    if ((typeof o.id === 'number' || typeof o.id === 'string') && typeof o.name === 'string' && ('time' in o || 'cost' in o)) {
      found = String(o.id);
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk((data as { data?: unknown } | null)?.data);
  return found && /^\d{1,12}$/.test(found) ? found : null;
}

/**
 * Свободные столы по дням у соседа Restoplace: страница виджета (адрес брони, если его нет в ссылке), затем на каждый
 * день тот же запрос, что делает виджет при выборе даты. Брони гостей не читаются: только занят стол в этот день или нет.
 */
export async function restoplaceDays(
  url: string,
  days: string[],
  get: Fetcher,
  post: Poster,
  pause: () => Promise<void>,
): Promise<Array<{ day: string; freeSlots: number | null }> | 'no-address'> {
  await pause();
  const page = await get(url, 'page');
  if (BLOCKED.has(page.status) || /captcha/i.test(page.body.slice(0, 5000))) throw new Blocked(`HTTP ${page.status}`);
  const address = restoplaceAddress(url, page.body);
  if (!address) return 'no-address';
  const api = `${new URL(url).origin}/api/widget.inc.php`;
  const out: Array<{ day: string; freeSlots: number | null }> = [];
  for (const day of days) {
    await pause();
    const res = json(await post(api, { action: `getJsonParams:${day}:first:0`, address, langApi: 'ru' }));
    out.push({ day, freeSlots: res === null ? null : restoplaceFreeTables(res, day) });
  }
  return out;
}

/** Окна по дням у соседа Dikidi; null у дня — ответ не поняли, такой день не пишется */
export async function dikidiDays(
  companyId: string,
  days: string[],
  get: Fetcher,
  pause: () => Promise<void>,
): Promise<Array<{ day: string; freeSlots: number | null }>> {
  await pause();
  const page = await get(`${DIKIDI}/ru/record/${companyId}`, 'page');
  if (BLOCKED.has(page.status) || /captcha/i.test(page.body.slice(0, 5000))) throw new Blocked(`HTTP ${page.status}`);
  await pause();
  const services = json(await get(`${DIKIDI}/mobile/ajax/newrecord/company_services/?lang=ru&company=${companyId}`, 'json'));
  const service = firstDikidiService(services);
  if (!service) return days.map((day) => ({ day, freeSlots: null }));
  const out: Array<{ day: string; freeSlots: number | null }> = [];
  for (const day of days) {
    await pause();
    const q = new URLSearchParams({ company_id: companyId, date: day });
    q.append('service_id[]', service);
    const res = json(await get(`${DIKIDI}/ru/mobile/ajax/newrecord/get_datetimes/?${q}`, 'json')) as
      | { error?: { code?: unknown }; data?: unknown }
      | null;
    const ok = res && (res.error === undefined || res.error?.code === 0 || res.error?.code === '0');
    out.push({ day, freeSlots: ok ? dikidiDaySlots(res!.data, day) : null });
  }
  return out;
}

export async function collectBusiness(
  deps: { api: BusinessCollectorApi; get: Fetcher; post?: Poster },
  options: { days: number; delayMs: number; dryRun: boolean; now?: Date; sleep?: (ms: number) => Promise<void>; log?: (line: string) => void },
): Promise<BusinessReport[]> {
  const sleep = options.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = options.log ?? (() => undefined);
  const now = options.now ?? new Date();
  let first = true;
  const pause = async () => {
    if (!first) await sleep(options.delayMs);
    first = false;
  };
  const reports: BusinessReport[] = [];
  for (const c of await deps.api.competitors()) {
    const report: BusinessReport = { id: c.id, name: c.name, outcome: 'skipped', reason: null, days: [], saved: 0, kept: 0 };
    reports.push(report);
    const days = daysFrom(localDay(now, c.timezone), options.days);
    const company = c.platform === 'Dikidi' ? dikidiCompanyId(c.url) : null;
    const resto = c.platform === 'Restoplace' && deps.post;
    if (!company && !resto) {
      report.reason =
        c.platform === 'Dikidi'
          ? 'в ссылке нет номера салона Dikidi'
          : c.platform === 'YCLIENTS'
            ? 'YCLIENTS отдаёт окна только с токеном виджета, ведите вручную'
            : `${c.platform}: сборщик читает Dikidi и Restoplace`;
      log(`${c.name}: пропущен, ${report.reason}`);
      continue;
    }
    try {
      if (company) report.days = await dikidiDays(company, days, deps.get, pause);
      else {
        const got = await restoplaceDays(c.url, days, deps.get, deps.post!, pause);
        if (got === 'no-address') {
          report.reason = 'на странице Restoplace не найден адрес брони';
          log(`${c.name}: пропущен, ${report.reason}`);
          continue;
        }
        report.days = got;
      }
    } catch (e) {
      if (!(e instanceof Blocked)) {
        report.outcome = 'no-data';
        report.reason = `площадка не ответила (${e instanceof Error ? e.message.split('\n')[0] : String(e)})`;
        log(`${c.name}: ${report.reason}`);
        continue;
      }
      report.outcome = 'blocked';
      report.reason = `площадка закрыла страницу проверкой (${e.message}); обходить не пробуем`;
      log(`${c.name}: ${report.reason}`);
      continue;
    }
    const entries = report.days.flatMap((d) => (d.freeSlots === null ? [] : [{ day: d.day, freeSlots: d.freeSlots }]));
    if (entries.length === 0) {
      report.outcome = 'no-data';
      report.reason = 'виджет не показал окна ни на один день';
      log(`${c.name}: ${report.reason}`);
      continue;
    }
    if (options.dryRun) {
      report.outcome = 'dry-run';
      log(`${c.name}: без записи, ${entries.map((e) => `${e.day.slice(5)}=${e.freeSlots}`).join(' ')}`);
      continue;
    }
    const res = await deps.api.write(c.id, entries);
    report.outcome = 'written';
    report.saved = res.saved;
    report.kept = res.kept;
    log(`${c.name}: записано дней ${res.saved}, оставлено за человеком ${res.kept}`);
  }
  return reports;
}
