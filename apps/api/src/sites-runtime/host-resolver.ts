import { normalizeSiteHost, parseDevSiteHosts } from '@pms/domain';

/**
 * Хост → сайт до MKT7 (`plans/mkt4-public-site-runtime-2026-10-06.md` §4). Таблицы `SiteDomain` нет, и временная не
 * заводится. Боевое разрешение выключено: в `production` любой хост это «сайта нет». Карта dev и test действует только
 * при `SITES_RUNTIME_DEV_RESOLVER=1` вне `production`; боевых имён хостов она не хранит.
 */
export function devResolverEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.SITES_RUNTIME_DEV_RESOLVER?.trim() === '1';
}

export function resolveSiteHost(raw: unknown, env: NodeJS.ProcessEnv = process.env): string | null {
  const host = normalizeSiteHost(raw);
  if (!host || !devResolverEnabled(env)) return null;
  return parseDevSiteHosts(env.SITES_RUNTIME_DEV_HOSTS).get(host) ?? null;
}
