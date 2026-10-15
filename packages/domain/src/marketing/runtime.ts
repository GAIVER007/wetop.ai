/**
 * Чистые правила публичного рантайма сайта (MKT4, `docs/marketing/README.md` §4). Здесь нет базы и HTTP: разбор карты
 * хостов для dev и test и коды категорий опубликованной версии для `publicFacts`. Нормализатор хоста в `host.ts` (MKT7).
 */

import { normalizeSiteHost } from './host';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Карта хостов только для dev и test (до MKT7 и `SiteDomain`): `"host=siteId,host2=siteId2"`. Неверная пара
 * пропускается молча: такой хост просто не разрешится. Боевых хостов эта карта не хранит.
 */
export function parseDevSiteHosts(raw: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of (raw ?? '').split(',')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const host = normalizeSiteHost(pair.slice(0, eq));
    const siteId = pair.slice(eq + 1).trim().toLowerCase();
    if (host && UUID_RE.test(siteId)) map.set(host, siteId);
  }
  return map;
}

/** Коды категорий из секций `accommodations` и `pricing` всех страниц версии, в порядке появления, без повторов */
export function siteSpecCategoryCodes(spec: Record<string, unknown>): string[] {
  const codes: string[] = [];
  const add = (code: unknown) => {
    if (typeof code === 'string' && !codes.includes(code)) codes.push(code);
  };
  const pages = Array.isArray(spec['pages']) ? spec['pages'] : [];
  for (const page of pages) {
    const sections = Array.isArray((page as Record<string, unknown>)?.['sections'])
      ? ((page as Record<string, unknown>)['sections'] as unknown[])
      : [];
    for (const raw of sections) {
      const section = (raw ?? {}) as Record<string, unknown>;
      if (section['type'] === 'accommodations' && Array.isArray(section['items']))
        for (const item of section['items']) add((item as Record<string, unknown>)?.['categoryCode']);
      if (section['type'] === 'pricing' && Array.isArray(section['categoryCodes']))
        for (const code of section['categoryCodes']) add(code);
    }
  }
  return codes;
}
