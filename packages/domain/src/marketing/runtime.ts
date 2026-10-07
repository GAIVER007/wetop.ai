/**
 * Чистые правила публичного рантайма сайта (MKT4, `docs/marketing/README.md` §4). Здесь нет базы и HTTP: нормализация
 * хоста, разбор карты хостов для dev и test и коды категорий опубликованной версии для `publicFacts`.
 */

const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Хост запроса в одном виде: нижний регистр, без порта, без точки в конце. `www.` не срезается: это другой хост, и решать
 * о переадресации будет основной домен сайта (MKT7). Хост должен быть именем из двух и более частей; всё остальное
 * (пробелы, путь, логин, пустые части) это `null`, то есть «такого сайта нет».
 */
export function normalizeSiteHost(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let host = raw.trim().toLowerCase();
  const colon = host.lastIndexOf(':');
  if (colon !== -1) {
    if (!/^\d{1,5}$/.test(host.slice(colon + 1))) return null;
    host = host.slice(0, colon);
  }
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (host.length === 0 || host.length > 253) return null;
  const labels = host.split('.');
  if (labels.length < 2) return null;
  return labels.every((label) => HOST_LABEL_RE.test(label)) ? host : null;
}

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
