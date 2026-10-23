/**
 * Запуск сборщика загрузки соседей салона и ресторана (DATA_MODEL §60, срез 3; `docs/market/collector.md`).
 *
 *   npm run market:collect-business -- [--dry-run] [--days 7]
 *
 * Окружение: MARKET_COLLECT_URL (адрес API WETOP) и MARKET_COLLECT_KEY (тот же служебный ключ, что у сборщика
 * гостиницы), из окружения или `.env` проекта; необязательно MARKET_COLLECT_DELAY_MS (пауза между запросами к площадке,
 * по умолчанию 8000). Модель не нужна: Dikidi отдаёт окна готовыми числами. Значения ключей вписывает владелец.
 */
import { existsSync } from 'node:fs';
import { collectBusiness, type BusinessCollectorApi, type BusinessTarget, type Fetcher } from './business-collect';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function api(baseUrl: string, key: string): BusinessCollectorApi {
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-wetop-service-key': key },
    });
    if (!res.ok) throw new Error(`WETOP ${path}: HTTP ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };
  return {
    competitors: async () => (await call<{ competitors: BusinessTarget[] }>('/business-market/collector/competitors')).competitors,
    write: (id, entries) =>
      call(`/business-market/collector/competitors/${encodeURIComponent(id)}/days`, { method: 'PUT', body: JSON.stringify({ entries }) }),
  };
}

/** Обычный запрос браузера к публичному виджету; куки сессии площадки держим между запросами одного прогона */
function fetcher(): Fetcher {
  const cookies = new Map<string, string>();
  return async (url, kind) => {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
        'accept-language': 'ru-RU,ru;q=0.9',
        accept: kind === 'json' ? 'application/json, text/javascript, */*' : 'text/html',
        ...(kind === 'json' ? { 'x-requested-with': 'XMLHttpRequest' } : {}),
        ...(cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
      signal: AbortSignal.timeout(30_000),
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const eq = pair!.indexOf('=');
      if (eq > 0) cookies.set(pair!.slice(0, eq).trim(), pair!.slice(eq + 1).trim());
    }
    return { status: res.status, body: await res.text() };
  };
}

async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env['MARKET_COLLECT_URL'];
  const key = process.env['MARKET_COLLECT_KEY'];
  if (!url || !key) throw new Error('Нужны MARKET_COLLECT_URL и MARKET_COLLECT_KEY');
  if (!/^[\x21-\x7e]+$/.test(key)) throw new Error('MARKET_COLLECT_KEY: подставьте настоящий ключ (латиница, цифры, знаки)');
  if (!/^https?:\/\//.test(url)) throw new Error('MARKET_COLLECT_URL: адрес API, например https://api.wetop.ai');
  const days = Math.min(Math.max(Number(arg('--days') ?? 7), 1), 14);
  const reports = await collectBusiness(
    { api: api(url, key), get: fetcher() },
    {
      days,
      delayMs: Number(process.env['MARKET_COLLECT_DELAY_MS'] ?? 8000),
      dryRun: process.argv.includes('--dry-run'),
      log: (line) => console.log(line),
    },
  );
  const count = (o: string) => reports.filter((r) => r.outcome === o).length;
  console.log(`Готово: соседей ${reports.length}, записано ${count('written')}, без данных ${count('no-data')}, закрыто проверкой ${count('blocked')}, пропущено ${count('skipped')}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
