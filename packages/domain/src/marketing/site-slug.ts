/**
 * Адрес управляемого сайта (`marketing_sites.slug`, `DATA_MODEL.md` §29.2): основа платформенного поддомена. Тот же
 * шаблон стоит CHECK в базе. Зарезервированные слова: `docs/marketing/README.md` §6; слова из 1–2 букв отсекает сам
 * шаблон (не короче трёх знаков). Конфликт адреса не исправляется молча: человек выбирает другой.
 */
export const MARKETING_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export const RESERVED_SITE_SLUGS: readonly string[] = [
  'www',
  'app',
  'api',
  'assistant',
  'seller',
  'admin',
  'mail',
  'status',
  'preview',
  'static',
  'assets',
  'cdn',
  'help',
  'support',
  'wetop',
  'docs',
  'blog',
];

export type SlugResult =
  | { ok: true; slug: string }
  | { ok: false; code: 'invalid_slug' | 'reserved_slug'; message: string };

export function parseMarketingSlug(raw: unknown): SlugResult {
  if (typeof raw !== 'string')
    return { ok: false, code: 'invalid_slug', message: 'Адрес сайта: строка' };
  const slug = raw.trim().toLowerCase();
  if (!MARKETING_SLUG_RE.test(slug))
    return {
      ok: false,
      code: 'invalid_slug',
      message:
        'Адрес сайта: от 3 до 40 знаков, латинские буквы, цифры и дефис, без дефиса в начале и в конце',
    };
  if (RESERVED_SITE_SLUGS.includes(slug))
    return { ok: false, code: 'reserved_slug', message: `Адрес «${slug}» занят системой WETOP` };
  return { ok: true, slug };
}
