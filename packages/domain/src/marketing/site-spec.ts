import { canonicalByteLength } from './canonical';

/**
 * Проверка `SiteSpec` v0 (MKT3) по `docs/marketing/sitespec-v0.md`. Схема строгая: неизвестное поле на любом уровне
 * это отказ, поэтому в документ не пройдут код, HTML, CSS, обработчики событий и идентификаторы владельца. Ошибки
 * собираются все сразу, с путём к месту, чтобы редактор показал их у полей. Проверки, которым нужна база, здесь не
 * делаются: наличие ассета (MKT8) и кода категории объекта (при публикации, MKT7).
 */
export const SITE_SPEC_SCHEMA_VERSION = 'site-spec/0';
export const SITE_SPEC_MAX_BYTES = 262_144;

export interface SiteSpecError {
  /** Путь к месту в документе: `pages[0].sections[2].heading.ru`; пустой у документа целиком */
  path: string;
  code: string;
  message: string;
}

export type SiteSpecResult =
  | { ok: true; spec: Record<string, unknown>; schemaVersion: typeof SITE_SPEC_SCHEMA_VERSION }
  | { ok: false; errors: SiteSpecError[] };

const LOCALES = ['ru', 'kk', 'en'] as const;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const PAGE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_PAGE_SLUGS = [
  'api', 'w', 'a', '_next', '_preview', 'preview', 'assets', 'static',
  'robots.txt', 'sitemap.xml', 'favicon.ico', '.well-known', ...LOCALES,
];
const ASSET_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^\+[1-9][0-9]{9,14}$/;
const CATEGORY_CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;
// управляющие символы, включая перевод строки: абзацы это отдельные элементы массива
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const MARKUP_RE = /<[A-Za-z/!?]/;
const TEMPLATE_RE = /\{\{|\$\{/;

/**
 * Правило обычного текста SiteSpec наружу (MKT8: подсказка ALT у ассета): управляющие символы, разметка HTML и шаблоны
 * недопустимы. Возвращает текст ошибки или null; пустоту и длину проверяет вызывающий
 */
export function plainTextProblem(raw: string): string | null {
  if (CONTROL_RE.test(raw)) return 'Управляющие символы недопустимы';
  if (MARKUP_RE.test(raw)) return 'Разметка HTML недопустима, только обычный текст';
  if (TEMPLATE_RE.test(raw)) return 'Шаблоны вида {{…}} и ${…} недопустимы';
  return null;
}
const ICONS = [
  'CLOCK', 'PARKING', 'WIFI', 'BREAKFAST', 'LAUNDRY', 'LUGGAGE', 'KITCHEN', 'AIRCON',
  'TRANSFER', 'PETS', 'ACCESSIBLE', 'FAMILY', 'QUIET', 'CENTER', 'STATION', 'STAR',
];
const SOCIAL_HOSTS: Record<string, string[]> = {
  INSTAGRAM: ['instagram.com'],
  FACEBOOK: ['facebook.com'],
  TELEGRAM: ['t.me', 'telegram.me'],
  TIKTOK: ['tiktok.com'],
  YOUTUBE: ['youtube.com', 'youtu.be'],
  VK: ['vk.com'],
};

type Rec = Record<string, unknown>;
type Field = (value: unknown, path: string) => void;
interface Ref {
  path: string;
  pageId: string;
  sectionId?: string;
}

class Checker {
  readonly errors: SiteSpecError[] = [];
  locales: string[] = [];
  defaultLocale = '';
  readonly refs: Ref[] = [];
  readonly contactNeeds: Array<{ path: string; contact: 'phone' | 'whatsapp' | 'email' }> = [];
  readonly ids = new Set<string>();
  /** Секции с картой: карте нужны координаты в контактах сайта */
  readonly mapNeeds: string[] = [];
  /** Коды категорий из карточек размещения всего документа: строка цены берёт название оттуда */
  readonly cardCodes = new Set<string>();
  /** Коды категорий секций цен: каждый ищется среди карточек после разбора всех страниц */
  readonly pricingCodes: Array<{ path: string; code: string }> = [];

  fail(path: string, code: string, message: string): void {
    this.errors.push({ path, code, message });
  }

  /** Объект строго с известными полями; обязательные проверяются на наличие */
  obj(value: unknown, path: string, fields: Record<string, Field>, required: string[] = []): Rec | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      this.fail(path, 'type', 'Ожидается объект');
      return null;
    }
    const record = value as Rec;
    for (const key of Object.keys(record))
      if (!(key in fields)) this.fail(join(path, key), 'unknown_field', `Поле «${key}» не входит в SiteSpec v0`);
    for (const key of Object.keys(fields)) {
      const fieldPath = join(path, key);
      if (record[key] === undefined) {
        if (required.includes(key)) this.fail(fieldPath, 'required', 'Обязательное поле');
        continue;
      }
      fields[key]!(record[key], fieldPath);
    }
    return record;
  }

  arr(value: unknown, path: string, min: number, max: number, item: Field): unknown[] | null {
    if (!Array.isArray(value)) {
      this.fail(path, 'type', 'Ожидается список');
      return null;
    }
    if (value.length < min || value.length > max)
      this.fail(path, 'count', `Ожидается от ${min} до ${max} элементов`);
    value.forEach((v, i) => item(v, `${path}[${i}]`));
    return value;
  }

  oneOf(values: readonly string[]): Field {
    return (value, path) => {
      if (typeof value !== 'string' || !values.includes(value))
        this.fail(path, 'enum', `Допустимо: ${values.join(', ')}`);
    };
  }

  bool: Field = (value, path) => {
    if (typeof value !== 'boolean') this.fail(path, 'type', 'Ожидается да или нет');
  };

  text(max: number): Field {
    return (value, path) => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        this.fail(path, 'type', 'Ожидается текст на языках сайта');
        return;
      }
      const record = value as Rec;
      if (record[this.defaultLocale] === undefined)
        this.fail(path, 'missing_default_locale', `Нужен текст на языке по умолчанию (${this.defaultLocale})`);
      for (const [locale, raw] of Object.entries(record)) {
        const at = join(path, locale);
        if (!this.locales.includes(locale)) {
          this.fail(at, 'locale_not_enabled', `Язык «${locale}» не включён у сайта`);
          continue;
        }
        if (typeof raw !== 'string') {
          this.fail(at, 'type', 'Ожидается строка');
          continue;
        }
        const trimmed = raw.trim();
        if (!trimmed) this.fail(at, 'empty', 'Пустой текст');
        else if ([...trimmed].length > max) this.fail(at, 'too_long', `Не длиннее ${max} знаков`);
        if (CONTROL_RE.test(raw)) this.fail(at, 'control_char', 'Управляющие символы недопустимы');
        if (MARKUP_RE.test(raw)) this.fail(at, 'markup', 'Разметка HTML недопустима, только обычный текст');
        if (TEMPLATE_RE.test(raw)) this.fail(at, 'template', 'Шаблоны вида {{…}} и ${…} недопустимы');
      }
    };
  }

  textList(max: number, min: number, maxItems: number): Field {
    return (value, path) => this.arr(value, path, min, maxItems, this.text(max));
  }

  id: Field = (value, path) => {
    if (typeof value !== 'string' || !ID_RE.test(value)) {
      this.fail(path, 'invalid_id', 'Идентификатор: латиница, цифры, дефис, до 48 знаков');
      return;
    }
    if (this.ids.has(value)) this.fail(path, 'duplicate_id', `Идентификатор «${value}» уже есть в документе`);
    this.ids.add(value);
  };

  assetId: Field = (value, path) => {
    if (typeof value !== 'string' || !ASSET_ID_RE.test(value))
      this.fail(path, 'invalid_asset_id', 'Ссылка на картинку: идентификатор ассета (UUID)');
  };

  image: Field = (value, path) => {
    this.obj(value, path, { assetId: this.assetId, alt: this.text(150) }, ['assetId', 'alt']);
  };

  images(min: number, max: number): Field {
    return (value, path) => this.arr(value, path, min, max, this.image);
  }

  phone: Field = (value, path) => {
    if (typeof value !== 'string' || !PHONE_RE.test(value))
      this.fail(path, 'invalid_phone', 'Телефон в формате +77010000000');
  };

  email: Field = (value, path) => {
    if (
      typeof value !== 'string' ||
      value.length > 254 ||
      value.split('@').length !== 2 ||
      /[\s<>]/.test(value) ||
      !value.split('@').every(Boolean)
    )
      this.fail(path, 'invalid_email', 'Неверный адрес почты');
  };

  url: Field = (value, path) => {
    if (!httpsUrl(value)) this.fail(path, 'invalid_url', 'Только адрес https:// без логина, порта, IP-адреса и localhost');
  };

  icon: Field = (value, path) => this.oneOf(ICONS)(value, path);

  categoryCode: Field = (value, path) => {
    if (typeof value !== 'string' || !CATEGORY_CODE_RE.test(value))
      this.fail(path, 'invalid_category', 'Код категории: латиница, цифры, дефис и подчёркивание');
  };

  target: Field = (value, path) => this.link(value, path, ['PAGE', 'SECTION', 'EXTERNAL']);

  /** `Target` и `Action` одной формы: вид и свои поля; ссылки проверяются после разбора страниц */
  link(value: unknown, path: string, kinds: string[]): Rec | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      this.fail(path, 'type', 'Ожидается объект');
      return null;
    }
    const kind = (value as Rec)['kind'];
    if (typeof kind !== 'string' || !kinds.includes(kind)) {
      this.fail(join(path, 'kind'), 'enum', `Допустимо: ${kinds.join(', ')}`);
      return null;
    }
    const fields: Record<string, Field> = { kind: () => undefined };
    const required: string[] = [];
    if (kind === 'PAGE' || kind === 'SECTION') {
      fields['pageId'] = (v, p) => this.ref(v, p);
      required.push('pageId');
    }
    if (kind === 'SECTION') {
      fields['sectionId'] = (v, p) => this.ref(v, p);
      required.push('sectionId');
    }
    if (kind === 'EXTERNAL') {
      fields['url'] = this.url;
      required.push('url');
    }
    const record = this.obj(value, path, fields, required);
    if (record && (kind === 'PAGE' || kind === 'SECTION') && typeof record['pageId'] === 'string')
      this.refs.push({
        path,
        pageId: record['pageId'],
        ...(kind === 'SECTION' && typeof record['sectionId'] === 'string' ? { sectionId: record['sectionId'] } : {}),
      });
    if (kind === 'PHONE') this.contactNeeds.push({ path, contact: 'phone' });
    if (kind === 'WHATSAPP') this.contactNeeds.push({ path, contact: 'whatsapp' });
    if (kind === 'EMAIL') this.contactNeeds.push({ path, contact: 'email' });
    return record;
  }

  ref: Field = (value, path) => {
    if (typeof value !== 'string' || !ID_RE.test(value)) this.fail(path, 'invalid_id', 'Неверный идентификатор');
  };

  cta: Field = (value, path) => {
    this.obj(
      value,
      path,
      {
        label: this.text(30),
        action: (v, p) => this.link(v, p, ['BOOK', 'PAGE', 'SECTION', 'PHONE', 'WHATSAPP', 'EMAIL', 'EXTERNAL']),
      },
      ['label', 'action'],
    );
  };
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function httpsUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    url.port === '' &&
    host !== 'localhost' &&
    !host.endsWith('.localhost') &&
    !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) &&
    !host.startsWith('[') &&
    host.includes('.')
  );
}

function hostOf(value: unknown): string | null {
  try {
    return new URL(String(value)).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function decimals(value: number): boolean {
  return Math.round(value * 1e6) / 1e6 === value;
}

export function validateSiteSpec(input: unknown): SiteSpecResult {
  const c = new Checker();
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    return { ok: false, errors: [{ path: '', code: 'type', message: 'SiteSpec: ожидается объект' }] };
  let bytes: number;
  try {
    bytes = canonicalByteLength(input);
  } catch {
    return { ok: false, errors: [{ path: '', code: 'type', message: 'SiteSpec: только значения JSON' }] };
  }
  if (bytes > SITE_SPEC_MAX_BYTES)
    return {
      ok: false,
      errors: [{ path: '', code: 'too_large', message: `SiteSpec больше ${SITE_SPEC_MAX_BYTES / 1024} КБ` }],
    };
  const root = input as Rec;
  if (root['schemaVersion'] !== SITE_SPEC_SCHEMA_VERSION) {
    c.fail('schemaVersion', root['schemaVersion'] === undefined ? 'required' : 'unknown_schema_version',
      `Известна только версия схемы ${SITE_SPEC_SCHEMA_VERSION}`);
    return { ok: false, errors: c.errors };
  }
  // языки нужны всем текстам: разбираются раньше остального
  const site = root['site'] as Rec | undefined;
  if (site && typeof site === 'object') {
    if (typeof site['defaultLocale'] === 'string') c.defaultLocale = site['defaultLocale'];
    if (Array.isArray(site['locales'])) c.locales = site['locales'].filter((l): l is string => typeof l === 'string');
  }
  const booking = ((root['integrations'] as Rec | undefined)?.['booking'] as Rec | undefined)?.['mode'];
  const pages: Array<{ id: string; sections: string[] }> = [];
  const pageSlugs = new Set<string>();

  c.obj(
    root,
    '',
    {
      schemaVersion: () => undefined,
      site: (v, p) => checkSite(c, v, p),
      theme: (v, p) =>
        c.obj(
          v,
          p,
          {
            preset: c.oneOf(['CALM', 'WARM', 'NIGHT', 'COAST']),
            accent: c.oneOf(['TEAL', 'INDIGO', 'TERRACOTTA', 'FOREST', 'GRAPHITE', 'GOLD']),
            typography: c.oneOf(['MODERN', 'CLASSIC', 'ROUNDED']),
            radius: c.oneOf(['SHARP', 'SOFT', 'ROUND']),
            density: c.oneOf(['COMPACT', 'COMFORTABLE']),
            colorScheme: c.oneOf(['LIGHT']),
          },
          ['preset', 'accent', 'typography', 'radius', 'density', 'colorScheme'],
        ),
      navigation: (v, p) => checkNavigation(c, v, p),
      pages: (v, p) =>
        c.arr(v, p, 1, 20, (page, pp) => {
          const parsed = checkPage(c, page, pp, booking, pageSlugs);
          if (parsed) pages.push(parsed);
        }),
      integrations: (v, p) =>
        c.obj(
          v,
          p,
          {
            booking: (b, bp) => c.obj(b, bp, { mode: c.oneOf(['WETOP_WIDGET', 'NONE']) }, ['mode']),
            analytics: (a, ap) =>
              c.obj(
                a,
                ap,
                {
                  mode: c.oneOf(['WETOP_TRACKER', 'NONE']),
                  consent: c.oneOf(['NOT_REQUIRED', 'WAIT_FOR_CONSENT']),
                },
                ['mode', 'consent'],
              ),
          },
          ['booking', 'analytics'],
        ),
    },
    ['schemaVersion', 'site', 'theme', 'navigation', 'pages', 'integrations'],
  );

  if (Array.isArray(root['pages'])) {
    const homes = (root['pages'] as unknown[]).filter((p) => (p as Rec | null)?.['isHome'] === true).length;
    if (homes !== 1) c.fail('pages', 'home_page', 'Нужна ровно одна главная страница');
  }
  for (const ref of c.refs) {
    const page = pages.find((p) => p.id === ref.pageId);
    if (!page) c.fail(join(ref.path, 'pageId'), 'unknown_reference', `Страницы «${ref.pageId}» нет в документе`);
    else if (ref.sectionId !== undefined && !page.sections.includes(ref.sectionId))
      c.fail(join(ref.path, 'sectionId'), 'unknown_reference', `Секции «${ref.sectionId}» нет на странице «${ref.pageId}»`);
  }
  const contacts = ((site?.['contacts'] as Rec | undefined) ?? {}) as Rec;
  for (const need of c.contactNeeds)
    if (contacts[need.contact] === undefined)
      c.fail(need.path, 'missing_contact', 'Действию нужен контакт сайта: укажите его в контактах');
  for (const mapPath of c.mapNeeds)
    if (contacts['geo'] === undefined)
      c.fail(mapPath, 'missing_contact', 'Карте нужны координаты в контактах сайта');
  // название строки цены берётся из снимка карточки размещения, служебное имя категории наружу не идёт
  for (const ref of c.pricingCodes)
    if (!c.cardCodes.has(ref.code))
      c.fail(ref.path, 'pricing_category_without_card',
        'Для категории секции цен нужна карточка размещения с тем же categoryCode');
  const privacy = (site?.['legal'] as Rec | undefined)?.['privacyPageId'];
  if (typeof privacy === 'string' && !pages.some((p) => p.id === privacy))
    c.fail('site.legal.privacyPageId', 'unknown_reference', `Страницы «${privacy}» нет в документе`);

  return c.errors.length
    ? { ok: false, errors: c.errors }
    : { ok: true, spec: root, schemaVersion: SITE_SPEC_SCHEMA_VERSION };
}

function checkSite(c: Checker, value: unknown, path: string): void {
  c.obj(
    value,
    path,
    {
      vertical: c.oneOf(['HOSPITALITY']),
      displayName: c.text(80),
      defaultLocale: c.oneOf(LOCALES),
      locales: (v, p) => {
        c.arr(v, p, 1, LOCALES.length, c.oneOf(LOCALES));
        if (Array.isArray(v)) {
          if (new Set(v).size !== v.length) c.fail(p, 'duplicate', 'Языки не повторяются');
          if (!v.includes(c.defaultLocale)) c.fail(p, 'missing_default_locale', 'Список языков содержит язык по умолчанию');
        }
      },
      brand: (v, p) =>
        c.obj(v, p, { tagline: c.text(120), logo: c.image, faviconAssetId: c.assetId }),
      contacts: (v, p) =>
        c.obj(v, p, {
          phone: c.phone,
          whatsapp: c.phone,
          email: c.email,
          address: c.text(200),
          geo: (g, gp) =>
            c.obj(
              g,
              gp,
              {
                lat: (n, np) => {
                  if (typeof n !== 'number' || n < -90 || n > 90 || !decimals(n))
                    c.fail(np, 'invalid_geo', 'Широта от -90 до 90, до 6 знаков после точки');
                },
                lng: (n, np) => {
                  if (typeof n !== 'number' || n < -180 || n > 180 || !decimals(n))
                    c.fail(np, 'invalid_geo', 'Долгота от -180 до 180, до 6 знаков после точки');
                },
              },
              ['lat', 'lng'],
            ),
          social: (s, sp) =>
            c.arr(s, sp, 0, 6, (item, ip) => {
              const record = c.obj(item, ip, { network: c.oneOf(Object.keys(SOCIAL_HOSTS)), url: c.url }, ['network', 'url']);
              const hosts = SOCIAL_HOSTS[String(record?.['network'])];
              const host = hostOf(record?.['url']);
              if (hosts && host && !hosts.some((h) => host === h || host === `www.${h}`))
                c.fail(join(ip, 'url'), 'social_host', `Адрес не похож на ${hosts.join(' или ')}`);
            }),
        }),
      legal: (v, p) => c.obj(v, p, { operatorName: c.text(200), privacyPageId: c.ref }),
      seo: (v, p) =>
        c.obj(
          v,
          p,
          {
            robots: c.oneOf(['INDEX', 'NOINDEX']),
            titleTemplate: (t, tp) => {
              c.text(80)(t, tp);
              if (t && typeof t === 'object')
                for (const [locale, raw] of Object.entries(t as Rec))
                  if (typeof raw === 'string' && raw.split('%s').length !== 2)
                    c.fail(join(tp, locale), 'title_template', 'Шаблон заголовка содержит ровно одно %s');
            },
            structuredData: (sd, sdp) =>
              c.obj(
                sd,
                sdp,
                {
                  type: c.oneOf(['HOTEL', 'HOSTEL', 'APARTMENT', 'LODGING']),
                  includeAddress: c.bool,
                  includeGeo: c.bool,
                },
                ['type', 'includeAddress', 'includeGeo'],
              ),
          },
          ['robots', 'structuredData'],
        ),
    },
    ['vertical', 'displayName', 'defaultLocale', 'locales', 'seo'],
  );
}

function checkNavigation(c: Checker, value: unknown, path: string): void {
  const record = c.obj(
    value,
    path,
    {
      header: (v, p) =>
        c.arr(v, p, 0, 7, (item, ip) => c.obj(item, ip, { label: c.text(30), target: c.target }, ['label', 'target'])),
      headerCta: c.cta,
      footer: (v, p) =>
        c.arr(v, p, 0, 12, (item, ip) => c.obj(item, ip, { label: c.text(40), target: c.target }, ['label', 'target'])),
    },
    ['header', 'footer'],
  );
  const header = record?.['header'];
  if (Array.isArray(header) && header.filter((h) => (h as Rec | null)?.['target'] && ((h as Rec)['target'] as Rec)?.['kind'] === 'EXTERNAL').length > 1)
    c.fail(join(path, 'header'), 'external_links', 'В шапке не больше одной внешней ссылки');
}

function checkPage(
  c: Checker,
  value: unknown,
  path: string,
  booking: unknown,
  slugs: Set<string>,
): { id: string; sections: string[] } | null {
  const sections: string[] = [];
  const record = c.obj(
    value,
    path,
    {
      id: c.id,
      slug: () => undefined,
      isHome: c.bool,
      title: c.text(70),
      seo: (v, p) => checkPageSeo(c, v, p),
      sections: (v, p) => {
        const list = c.arr(v, p, 1, 30, (s, sp) => {
          const id = checkSection(c, s, sp, booking);
          if (id) sections.push(id);
        });
        if (!list) return;
        const types = list.map((s) => (s as Rec | null)?.['type']);
        types.forEach((type, i) => {
          if (type === 'hero' && (i !== 0 || types.indexOf('hero') !== i))
            c.fail(`${p}[${i}]`, 'hero_position', 'Секция героя одна на странице и стоит первой');
          if (type === 'booking' && types.indexOf('booking') !== i)
            c.fail(`${p}[${i}]`, 'duplicate_booking', 'Секция брони одна на странице');
        });
      },
    },
    ['id', 'slug', 'isHome', 'title', 'seo', 'sections'],
  );
  if (!record) return null;
  const slug = record['slug'];
  const slugPath = join(path, 'slug');
  if (typeof slug !== 'string') c.fail(slugPath, 'required', 'Адрес страницы: строка');
  else if (record['isHome'] === true) {
    if (slug !== '') c.fail(slugPath, 'home_slug', 'У главной страницы адрес пустой');
  } else if (slug.length > 60 || !PAGE_SLUG_RE.test(slug))
    c.fail(slugPath, 'invalid_slug', 'Адрес страницы: латиница, цифры, дефис, до 60 знаков');
  else if (RESERVED_PAGE_SLUGS.includes(slug)) c.fail(slugPath, 'reserved_slug', `Адрес «${slug}» занят`);
  else if (slugs.has(slug)) c.fail(slugPath, 'duplicate_slug', `Адрес «${slug}» уже есть у другой страницы`);
  else slugs.add(slug);
  return typeof record['id'] === 'string' ? { id: record['id'], sections } : null;
}

function checkPageSeo(c: Checker, value: unknown, path: string): void {
  const record = c.obj(
    value,
    path,
    {
      title: c.text(60),
      description: c.text(160),
      index: c.bool,
      includeInSitemap: c.bool,
      canonical: c.oneOf(['SELF']),
      og: (v, p) => c.obj(v, p, { title: c.text(70), description: c.text(200), imageAssetId: c.assetId }),
    },
    ['index', 'includeInSitemap', 'canonical'],
  );
  if (record?.['index'] === false && record['includeInSitemap'] === true)
    c.fail(join(path, 'includeInSitemap'), 'sitemap_noindex', 'Страница без индекса не попадает в карту сайта');
}

type SectionShape = {
  variants: string[];
  fields: (c: Checker) => Record<string, Field>;
  required: string[];
};

const SECTIONS: Record<string, SectionShape> = {
  hero: {
    variants: ['IMAGE_FULL', 'IMAGE_SIDE', 'TEXT_ONLY'],
    fields: (c) => ({ subheading: c.text(200), image: c.image, primaryAction: c.cta, secondaryAction: c.cta }),
    required: ['primaryAction'],
  },
  about: {
    variants: ['TEXT_ONLY', 'TEXT_IMAGE'],
    fields: (c) => ({ paragraphs: c.textList(600, 1, 6), image: c.image }),
    required: ['paragraphs'],
  },
  features: {
    variants: ['GRID', 'LIST'],
    fields: (c) => ({
      items: (v, p) =>
        c.arr(v, p, 2, 8, (i, ip) =>
          c.obj(i, ip, { icon: c.icon, title: c.text(60), text: c.text(200) }, ['icon', 'title', 'text'])),
    }),
    required: ['items'],
  },
  accommodations: {
    variants: ['CARDS', 'ROWS'],
    fields: (c) => ({
      items: (v, p) => {
        const items = c.arr(v, p, 1, 20, (i, ip) =>
          c.obj(
            i,
            ip,
            {
              categoryCode: c.categoryCode,
              title: c.text(60),
              description: c.text(400),
              images: c.images(0, 6),
              highlights: c.textList(40, 0, 6),
            },
            ['categoryCode', 'title', 'description'],
          ));
        const codes = (items ?? []).map((i) => (i as Rec | null)?.['categoryCode']);
        codes.forEach((code, i) => {
          if (typeof code === 'string') c.cardCodes.add(code);
          if (typeof code === 'string' && codes.indexOf(code) !== i)
            c.fail(`${p}[${i}].categoryCode`, 'duplicate_category', 'Категория уже есть в секции');
        });
      },
      showLiveCapacity: c.bool,
      showFromPrice: c.bool,
      itemAction: c.cta,
    }),
    required: ['items'],
  },
  amenities: {
    variants: ['LIST', 'ICONS'],
    fields: (c) => ({
      items: (v, p) =>
        c.arr(v, p, 1, 24, (i, ip) =>
          c.obj(i, ip, { icon: c.icon, label: c.text(60), note: c.text(120) }, ['icon', 'label'])),
    }),
    required: ['items'],
  },
  pricing: {
    variants: ['FROM_PRICES'],
    fields: (c) => ({
      categoryCodes: (v, p) => {
        c.arr(v, p, 1, 20, c.categoryCode);
        if (Array.isArray(v) && new Set(v).size !== v.length) c.fail(p, 'duplicate_category', 'Категории не повторяются');
        if (Array.isArray(v))
          v.forEach((code, i) => {
            if (typeof code === 'string') c.pricingCodes.push({ path: `${p}[${i}]`, code });
          });
      },
      note: c.text(300),
    }),
    required: ['categoryCodes'],
  },
  gallery: {
    variants: ['GRID', 'CAROUSEL'],
    fields: (c) => ({ images: c.images(3, 24) }),
    required: ['images'],
  },
  booking: {
    variants: ['INLINE'],
    fields: (c) => ({ note: c.text(300), showCheckInOut: c.bool }),
    required: [],
  },
  contacts: {
    variants: ['PLAIN', 'WITH_MAP'],
    fields: (c) => ({
      showPhone: c.bool,
      showWhatsapp: c.bool,
      showEmail: c.bool,
      showAddress: c.bool,
      map: (v, p) => c.obj(v, p, { provider: c.oneOf(['OPENSTREETMAP_LINK']) }, ['provider']),
      directions: c.text(400),
    }),
    required: [],
  },
  faq: {
    variants: ['ACCORDION', 'LIST'],
    fields: (c) => ({
      items: (v, p) =>
        c.arr(v, p, 1, 30, (i, ip) =>
          c.obj(i, ip, { question: c.text(200), answer: c.text(1000) }, ['question', 'answer'])),
      emitStructuredData: c.bool,
    }),
    required: ['items'],
  },
  cta: {
    variants: ['BANNER', 'SPLIT'],
    fields: (c) => ({ action: c.cta, text: c.text(300), image: c.image }),
    required: ['action'],
  },
};

/**
 * Реестр секций v0 наружу: тип и его варианты (MKT4). Рантайм `apps/sites` держит свой явный реестр рендереров, и тест
 * сверяет оба: у каждой секции и варианта валидатора есть рендерер, лишних нет.
 */
export const SITE_SPEC_SECTIONS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(Object.entries(SECTIONS).map(([type, shape]) => [type, Object.freeze([...shape.variants])])),
);

/** Секция по реестру §8; возвращает её идентификатор для проверки ссылок */
function checkSection(c: Checker, value: unknown, path: string, booking: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    c.fail(path, 'type', 'Ожидается секция');
    return null;
  }
  const record = value as Rec;
  const type = record['type'];
  const shape = typeof type === 'string' ? SECTIONS[type] : undefined;
  if (!shape) {
    c.fail(join(path, 'type'), 'unknown_section', `Секции «${String(type)}» нет в реестре SiteSpec v0`);
    return null;
  }
  c.obj(
    record,
    path,
    { id: c.id, type: () => undefined, variant: c.oneOf(shape.variants), heading: c.text(80), ...shape.fields(c) },
    ['id', 'type', 'variant', 'heading', ...shape.required],
  );
  const variant = record['variant'];
  if ((type === 'hero' && variant !== 'TEXT_ONLY') || (type === 'about' && variant === 'TEXT_IMAGE'))
    if (record['image'] === undefined) c.fail(join(path, 'image'), 'required', 'Этому варианту нужна картинка');
  if ((type === 'cta' && variant !== 'SPLIT') || (type === 'hero' && variant === 'TEXT_ONLY'))
    if (record['image'] !== undefined) c.fail(join(path, 'image'), 'not_allowed', 'Этому варианту картинка не нужна');
  if (type === 'contacts' && record['map'] !== undefined) {
    if (variant !== 'WITH_MAP') c.fail(join(path, 'map'), 'not_allowed', 'Карта только у варианта с картой');
    c.mapNeeds.push(join(path, 'map'));
  }
  if (type === 'booking' && booking !== 'WETOP_WIDGET')
    c.fail(path, 'booking_disabled', 'Секции брони нужна бронь WETOP в интеграциях сайта');
  return typeof record['id'] === 'string' ? record['id'] : null;
}
