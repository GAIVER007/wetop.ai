/**
 * Хосты управляемых сайтов (MKT4, MKT7; Q-271 RESOLVED OWNER 07.10.2026). Один нормализатор на управление, служебный
 * рантайм API и Worker `apps/sites` (Worker импортирует этот файл напрямую, поэтому здесь нет импортов и нет Node API:
 * только WHATWG `URL`, он есть и в Node, и в Workers).
 */

const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const NOT_A_HOST_RE = /[\s/\\?#@[\]%]/;

/**
 * Хост запроса в одном виде: нижний регистр, без порта, без точки в конце, IDN в punycode, не длиннее 253 знаков.
 * `www.` не срезается: это другой хост, о переадресации решает основной домен сайта. Имя из двух и более частей;
 * схема, путь, логин, IP-адрес и пустые части дают `null`, то есть «такого сайта нет».
 */
export function normalizeSiteHost(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let host = raw.trim();
  if (!host || NOT_A_HOST_RE.test(host)) return null;
  const colon = host.lastIndexOf(':');
  if (colon !== -1) {
    const port = host.slice(colon + 1);
    if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) return null;
    host = host.slice(0, colon);
  }
  if (host.includes(':')) return null;
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (!host) return null;
  let ascii: string;
  try {
    ascii = new URL(`http://${host}`).hostname;
  } catch {
    return null;
  }
  if (ascii.endsWith('.')) ascii = ascii.slice(0, -1);
  if (ascii.length === 0 || ascii.length > 253) return null;
  const labels = ascii.split('.');
  if (labels.length < 2 || /^\d+$/.test(labels[labels.length - 1]!)) return null;
  return labels.every((label) => HOST_LABEL_RE.test(label)) ? ascii : null;
}

export type BaseDomainResult = { ok: true; domain: string } | { ok: false; message: string };

/**
 * `SITES_BASE_DOMAIN` (Q-271): отдельный регистрируемый домен сайтов клиентов. Только имя хоста (без схемы, пути и
 * порта), не `wetop.ai` и не его поддомен: куки, граница безопасности и репутация сайтов клиентов отделены от WETOP.
 * Боевое значение задаёт инфраструктура, в исходниках его нет.
 */
export function parseSitesBaseDomain(raw: unknown): BaseDomainResult {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, message: 'SITES_BASE_DOMAIN не задан' };
  const value = raw.trim();
  const domain = /[:/]/.test(value) ? null : normalizeSiteHost(value);
  if (!domain) return { ok: false, message: 'SITES_BASE_DOMAIN: только имя хоста, без схемы, пути и порта' };
  if (domain === 'wetop.ai' || domain.endsWith('.wetop.ai'))
    return { ok: false, message: 'SITES_BASE_DOMAIN: не wetop.ai и не его поддомен (Q-271)' };
  return { ok: true, domain };
}

/** Платформенный адрес сайта: только из slug и базы на сервере, браузер хост не передаёт */
export function platformHost(slug: string, baseDomain: string): string {
  return `${slug}.${baseDomain}`;
}

/** Хост превью: инфраструктура, а не домен сайта; адрес `preview` зарезервирован среди slug */
export function previewHost(baseDomain: string): string {
  return `preview.${baseDomain}`;
}
