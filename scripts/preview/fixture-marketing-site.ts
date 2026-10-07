import { diffSiteSpecs, findSection, siteSpecAssetRefs, siteSpecHash, validateSiteSpec } from '@pms/domain';
import { fixtureAssetKinds } from './fixture-site-assets';

/**
 * Подставной API публикации (MKT7) и редактора (MKT9) управляемого сайта для UI-тестов. Только вымышленные данные (ADR-010). Правила
 * повторяют API там, где их видит стойка: публикуется только голова черновика, откат только на ранее опубликованную
 * версию, источник брони не выбирается сам, без тарифа (если он нужен) публикация 409.
 */
type State = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
type Action = 'PUBLISH' | 'ROLLBACK' | 'PAUSE' | 'RESUME' | 'ARCHIVE';
interface Version {
  id: string;
  revision: number;
  spec: Record<string, unknown>;
  source: 'MANUAL' | 'AI';
  parentVersionId: string | null;
  createdAt: string;
}
interface Run {
  id: string;
  type: 'INITIAL' | 'PATCH' | 'SECTION';
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  baseVersionId: string | null;
  outputVersionId: string | null;
  errorCode: string | null;
  target: { pageId: string; sectionId: string } | null;
  polls: number;
}
interface Publication {
  id: string;
  action: Action;
  versionId: string | null;
  revision: number | null;
  previousVersionId: string | null;
  previousRevision: number | null;
  actorId: string | null;
  createdAt: string;
}

const SLUG = 'luxx-aparts';
const BASE = 'sites.test';
const IMG1 = '00000001-0000-4000-8000-000000000001';
const IMG2 = '00000002-0000-4000-8000-000000000002';
const LOGO = '00000003-0000-4000-8000-000000000003';
const t = (ru: string) => ({ ru });
/** Документ сайта стенда: проходит валидатор, картинки из библиотеки стенда (MKT8), категории брифа стенда */
export function fixtureSiteSpec(heading = 'Тихие номера у вокзала'): Record<string, unknown> {
  return {
    schemaVersion: 'site-spec/0',
    site: {
      vertical: 'HOSPITALITY',
      displayName: t('Luxx Aparts'),
      defaultLocale: 'ru',
      locales: ['ru'],
      brand: { tagline: t('Апартаменты в центре'), logo: { assetId: LOGO, alt: t('Логотип Luxx Aparts') } },
      contacts: { phone: '+77010000000', email: 'hello@luxx.example' },
      seo: { robots: 'INDEX', structuredData: { type: 'HOTEL', includeAddress: false, includeGeo: false } },
    },
    theme: { preset: 'CALM', accent: 'TEAL', typography: 'MODERN', radius: 'SOFT', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    navigation: {
      header: [{ label: t('Номера'), target: { kind: 'SECTION', pageId: 'page-home', sectionId: 'sec-rooms' } }],
      footer: [{ label: t('Правила'), target: { kind: 'PAGE', pageId: 'page-rules' } }],
    },
    pages: [
      {
        id: 'page-home',
        slug: '',
        isHome: true,
        title: t('Главная'),
        seo: { title: t('Luxx Aparts'), description: t('Апартаменты в центре'), index: true, includeInSitemap: true, canonical: 'SELF' },
        sections: [
          { id: 'sec-hero', type: 'hero', variant: 'IMAGE_FULL', heading: t(heading), image: { assetId: IMG1, alt: t('Фасад вечером') }, primaryAction: { label: t('Выбрать даты'), action: { kind: 'BOOK' } } },
          { id: 'sec-about', type: 'about', variant: 'TEXT_ONLY', heading: t('О нас'), paragraphs: [t('Пять минут пешком до вокзала.')] },
          { id: 'sec-rooms', type: 'accommodations', variant: 'CARDS', heading: t('Номера'), items: [{ categoryCode: 'std', title: t('Стандарт'), description: t('Номер на двоих.') }] },
          { id: 'sec-gallery', type: 'gallery', variant: 'GRID', heading: t('Фото'), images: [{ assetId: IMG1, alt: t('Фасад') }, { assetId: IMG2, alt: t('Номер') }, { assetId: IMG1, alt: t('Вход') }] },
          { id: 'sec-booking', type: 'booking', variant: 'INLINE', heading: t('Забронировать') },
        ],
      },
      {
        id: 'page-rules',
        slug: 'rules',
        isHome: false,
        title: t('Правила'),
        seo: { index: true, includeInSitemap: true, canonical: 'SELF' },
        sections: [{ id: 'sec-rules', type: 'about', variant: 'TEXT_ONLY', heading: t('Правила проживания'), paragraphs: [t('Заезд с 14:00.')] }],
      },
    ],
    integrations: { booking: { mode: 'WETOP_WIDGET' }, analytics: { mode: 'NONE', consent: 'NOT_REQUIRED' } },
  };
}
const version = (n: number, spec = fixtureSiteSpec(n === 1 ? 'Тихие номера у вокзала' : `Версия ${n}`), source: Version['source'] = 'MANUAL'): Version => ({
  id: `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`,
  revision: n,
  spec,
  source,
  parentVersionId: n > 1 ? `${String(n - 1).padStart(8, '0')}-0000-4000-8000-${String(n - 1).padStart(12, '0')}` : null,
  createdAt: new Date(Date.parse('2026-10-07T08:00:00.000Z') + n * 600_000).toISOString(),
});
const BOOKING_SEED = {
  canonicalTrackedSiteId: null as string | null,
  ratePlans: [
    { id: 'rp000001-0000-4000-8000-000000000001', code: 'BASE', name: 'Базовый' },
    { id: 'rp000002-0000-4000-8000-000000000002', code: 'SITE', name: 'Сайт' },
  ],
  options: [
    {
      id: 'ts000001-0000-4000-8000-000000000001',
      name: 'Старый сайт',
      status: 'ACTIVE',
      bookingEnabled: true,
      bookingRatePlan: { id: 'rp000001-0000-4000-8000-000000000001', code: 'BASE', name: 'Базовый' },
      managed: false,
    },
    {
      id: 'ts000002-0000-4000-8000-000000000002',
      name: 'Лендинг акции',
      status: 'ACTIVE',
      bookingEnabled: true,
      bookingRatePlan: { id: 'rp000002-0000-4000-8000-000000000002', code: 'SITE', name: 'Сайт' },
      managed: false,
    },
  ],
};

let exists = true;
let state: State = 'DRAFT';
let versions: Version[] = [version(1), version(2)];
let published: Version | null = null;
let publications: Publication[] = [];
let booking = structuredClone(BOOKING_SEED);
let rateRequired = false;
let runs: Run[] = [];
let aiFail: string | null = null;
let noVersions = false;
let clock = Date.parse('2026-10-07T09:00:00.000Z');

export function resetMarketingSiteFixture() {
  exists = true;
  state = 'DRAFT';
  versions = [version(1), version(2)];
  published = null;
  publications = [];
  booking = structuredClone(BOOKING_SEED);
  rateRequired = false;
  runs = [];
  aiFail = null;
  noVersions = false;
  clock = Date.parse('2026-10-07T09:00:00.000Z');
}

const latest = () => (noVersions ? null : (versions[versions.length - 1] ?? null));
const ref = (v: Version | null) => (v ? { id: v.id, revision: v.revision } : null);
const view = () => ({
  id: 'ms000001-0000-4000-8000-000000000001',
  name: 'Luxx Aparts',
  slug: SLUG,
  state,
  latest: ref(latest()),
  published: ref(published),
  url: published && state !== 'ARCHIVED' ? `https://${SLUG}.${BASE}` : null,
  proposedUrl: `https://${SLUG}.${BASE}`,
});
const conflict = (code: string, message: string) => ({ status: 409, data: { code, message, statusCode: 409 } });
function record(action: Action, v: Version | null, previous: Version | null) {
  clock += 60_000;
  publications.push({
    id: `pub-${publications.length + 1}`,
    action,
    versionId: v?.id ?? null,
    revision: v?.revision ?? null,
    previousVersionId: previous?.id ?? null,
    previousRevision: previous?.revision ?? null,
    actorId: null,
    createdAt: new Date(clock).toISOString(),
  });
}

export function marketingSiteFixture(
  path: string,
  method: string,
  body: Record<string, unknown>,
  query: URLSearchParams = new URLSearchParams(),
): { status: number; data: unknown } | null {
  if (path === '/__test/marketing-site' && method === 'POST') {
    // новая ревизия черновика без сброса (как сохранение версии в MKT3): нужна для сценария отката
    if (body['addRevision'] === true) {
      // чужая правка (другая вкладка): документ головы с другим заголовком героя
      const head = latest()!;
      const spec = structuredClone(head.spec) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      spec.pages[0].sections[0].heading = { ru: 'Правка из другой вкладки' };
      versions.push({ ...version(versions.length + 1, spec), parentVersionId: head.id });
      return { status: 200, data: { ok: true } };
    }
    resetMarketingSiteFixture();
    if (body['noSite'] === true) exists = false;
    if (body['noVersions'] === true) noVersions = true;
    if (typeof body['aiFail'] === 'string') aiFail = body['aiFail'];
    if (body['rateRequired'] === true) rateRequired = true;
    if (typeof body['revisions'] === 'number') versions = Array.from({ length: body['revisions'] }, (_, i) => version(i + 1));
    return { status: 200, data: { ok: true } };
  }
  if (!path.startsWith('/marketing/site')) return null;
  if (path === '/marketing/site' && method === 'GET') return { status: 200, data: { site: exists ? view() : null } };
  // MKT9, окно «Создать сайт»: сайт без версий; занятый адрес отказом у поля, молча не меняется
  if (path === '/marketing/site' && method === 'POST') {
    if (exists) return conflict('SITE_EXISTS', 'У филиала уже есть сайт');
    const slug = String(body['slug'] ?? '');
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug))
      return { status: 400, data: { message: 'Адрес сайта: от 3 до 40 знаков, латинские буквы, цифры и дефис, без дефиса в начале и в конце' } };
    if (slug === 'busy-hotel') return conflict('SLUG_TAKEN', `Адрес «${slug}» уже занят: выберите другой`);
    exists = true;
    noVersions = true;
    return { status: 201, data: { site: view() } };
  }
  if (path === '/marketing/site/brief' && method === 'GET')
    return {
      status: 200,
      data: {
        briefHash: 'b'.repeat(64),
        input: {
          identity: { displayNameCandidate: 'Luxx Aparts' },
          accommodations: [{ categoryCode: 'std', name: 'Стандарт' }, { categoryCode: 'bed', name: 'Койка в общем номере' }],
        },
      },
    };
  if (!exists) return { status: 404, data: { message: 'Сайт филиала ещё не создан' } };
  if (path === '/marketing/site/publications' && method === 'GET')
    return { status: 200, data: { publications: [...publications].reverse() } };
  const editor = editorRoute(path, method, body, query);
  if (editor) return editor;
  if (path === '/marketing/site/booking-source') {
    if (method === 'PUT') {
      const id = body['trackedSiteId'];
      if (id !== null && !booking.options.some((o) => o.id === id)) return { status: 404, data: { message: 'Сайт не найден' } };
      booking.canonicalTrackedSiteId = (id as string | null) ?? null;
    }
    return { status: 200, data: booking };
  }
  if (method !== 'POST') return null;
  if (path === '/marketing/site/preview')
    return {
      status: 200,
      data: { url: `https://preview.${BASE}/?token=ui-preview-token`, expiresAt: new Date(clock + 3_600_000).toISOString() },
    };
  if (path === '/marketing/site/publish') {
    const head = latest();
    if (!head || body['expectedVersionId'] !== head.id)
      return conflict('VERSION_CHANGED', 'Опубликовать можно только последнюю версию: обновите страницу');
    if (published?.id === head.id && state !== 'DRAFT') return { status: 200, data: { site: view(), changed: false } };
    if (rateRequired && !body['bookingRatePlanId'])
      return conflict('BOOKING_RATE_PLAN_REQUIRED', 'Выберите тариф, по которому сайт будет принимать брони');
    const previous = published;
    published = head;
    if (state === 'DRAFT') state = 'PUBLISHED';
    record('PUBLISH', head, previous);
    return { status: 200, data: { site: view(), changed: true } };
  }
  if (path === '/marketing/site/pause') {
    if (state !== 'PUBLISHED') return conflict('NOT_PUBLISHED', 'Приостановить можно только опубликованный сайт');
    state = 'PAUSED';
    record('PAUSE', null, published);
    return { status: 200, data: { site: view() } };
  }
  if (path === '/marketing/site/resume') {
    if (state !== 'PAUSED') return conflict('NOT_PAUSED', 'Возобновить можно только приостановленный сайт');
    state = 'PUBLISHED';
    record('RESUME', published, published);
    return { status: 200, data: { site: view() } };
  }
  if (path === '/marketing/site/rollback') {
    const target = versions.find((v) => v.id === body['versionId']);
    if (!target) return { status: 404, data: { message: 'Версия не найдена' } };
    if (!publications.some((p) => p.versionId === target.id && p.action !== 'PAUSE'))
      return conflict('NEVER_PUBLISHED', 'Откатить можно только на версию, которая уже была опубликована');
    if (published?.id === target.id) return conflict('ALREADY_PUBLISHED', 'Эта версия уже опубликована');
    const previous = published;
    published = target;
    record('ROLLBACK', target, previous);
    return { status: 200, data: { site: view() } };
  }
  if (path === '/marketing/site/archive') {
    record('ARCHIVE', null, published);
    state = 'ARCHIVED';
    exists = false;
    return { status: 200, data: { site: { id: view().id, state: 'ARCHIVED' } } };
  }
  return null;
}

// ---------- MKT9: редактор ----------

const meta = (v: Version) => ({
  id: v.id,
  revision: v.revision,
  parentVersionId: v.parentVersionId,
  source: v.source,
  generationRunId: null,
  createdById: null,
  createdAt: v.createdAt,
  specHash: siteSpecHash(v.spec),
  isLatest: v.id === latest()?.id,
  isPublished: v.id === published?.id,
});
const conflictVersion = () => conflict('VERSION_CONFLICT', 'Сайт уже изменён в другой вкладке или ИИ: обновите черновик и повторите');

/** Картинки документа: готовые ассеты библиотеки стенда нужного вида, как `checkSpecAssets` API */
function assetProblems(spec: unknown) {
  const kinds = fixtureAssetKinds();
  return siteSpecAssetRefs(spec)
    .filter((r) => kinds.get(r.assetId) !== r.expectedKind)
    .map((r) => ({ path: r.path, code: kinds.has(r.assetId) ? 'wrong_kind' : 'unavailable' }));
}

function append(spec: Record<string, unknown>, source: Version['source']): Version {
  const head = latest();
  clock += 60_000;
  const next: Version = { ...version(versions.length + 1, structuredClone(spec), source), parentVersionId: head?.id ?? null, createdAt: new Date(clock).toISOString() };
  versions.push(next);
  noVersions = false;
  return next;
}

/** Правка ИИ стенда: детерминированная, чтобы снимки и тесты видели одно и то же */
function aiEdit(run: Run): Record<string, unknown> {
  const base = versions.find((v) => v.id === run.baseVersionId)!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spec = structuredClone(base.spec) as Record<string, any>;
  if (run.type === 'SECTION' && run.target) {
    const at = findSection(spec, run.target)!;
    spec.pages[at.pageIndex].sections[at.sectionIndex].heading = { ru: 'Секция от ИИ' };
  } else {
    spec.site.brand.tagline = { ru: 'Слоган от ИИ' };
    spec.pages[0].sections[0].heading = { ru: 'Короче и про расположение' };
  }
  return spec;
}

const runView = (run: Run) => {
  const out: Partial<Run> = { ...run };
  delete out.polls;
  return out;
};

function editorRoute(path: string, method: string, body: Record<string, unknown>, query: URLSearchParams): { status: number; data: unknown } | null {
  if (path === '/marketing/site/draft' && method === 'GET') {
    const head = latest();
    return {
      status: 200,
      data: { site: view(), version: head ? { revision: head.revision, specHash: siteSpecHash(head.spec), schemaVersion: 'site-spec/0', source: head.source, createdAt: head.createdAt, spec: head.spec } : null },
    };
  }
  if (path === '/marketing/site/versions' && method === 'GET')
    return { status: 200, data: { versions: noVersions ? [] : [...versions].reverse().map(meta) } };
  if (path === '/marketing/site/versions' && method === 'POST') {
    if ((latest()?.revision ?? 0) !== body['baseRevision']) return conflictVersion();
    const checked = validateSiteSpec(body['spec']);
    if (!checked.ok) return { status: 400, data: { message: 'Документ сайта не прошёл проверку', errors: checked.errors } };
    const problems = assetProblems(checked.spec);
    if (problems.length) return { status: 409, data: { code: 'ASSET_UNAVAILABLE', message: 'В версии есть изображения, которых нет в библиотеке филиала', paths: problems } };
    const v = append(checked.spec, 'MANUAL');
    return { status: 201, data: { version: { id: v.id, revision: v.revision } } };
  }
  const one = /^\/marketing\/site\/versions\/([^/]+)(\/diff|\/restore)?$/.exec(path);
  if (one) {
    const v = versions.find((x) => x.id === one[1]);
    if (!v) return { status: 404, data: { message: 'Версия не найдена' } };
    if (!one[2] && method === 'GET') return { status: 200, data: { version: { ...meta(v), spec: v.spec } } };
    if (one[2] === '/diff' && method === 'GET') {
      const from = versions.find((x) => x.id === query.get('against'));
      if (!from) return { status: 404, data: { message: 'Версия не найдена' } };
      return { status: 200, data: { from: meta(from), to: meta(v), changes: diffSiteSpecs(from.spec, v.spec) } };
    }
    if (one[2] === '/restore' && method === 'POST') {
      if ((latest()?.revision ?? 0) !== body['baseRevision']) return conflictVersion();
      const problems = assetProblems(v.spec);
      if (problems.length) return { status: 409, data: { code: 'ASSET_UNAVAILABLE', message: 'В версии есть изображения, которых нет в библиотеке филиала', paths: problems } };
      const next = append(v.spec, 'MANUAL');
      return { status: 201, data: { version: { id: next.id, revision: next.revision }, restoredFrom: { id: v.id, revision: v.revision } } };
    }
  }
  if (path === '/marketing/site/generations' && method === 'POST') {
    const type = (body['type'] ?? 'INITIAL') as Run['type'];
    if (type !== 'INITIAL' && body['baseVersionId'] !== latest()?.id)
      return conflict('BASE_VERSION_CHANGED', 'Сайт уже изменили: обновите черновик и повторите');
    if (runs.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING')) return conflict('RUN_ACTIVE', 'Генерация этого сайта уже идёт');
    const target = type === 'SECTION' ? { pageId: String(body['pageId']), sectionId: String(body['sectionId']) } : null;
    const run: Run = { id: `run-${runs.length + 1}`, type, status: 'QUEUED', baseVersionId: type === 'INITIAL' ? null : String(body['baseVersionId']), outputVersionId: null, errorCode: null, target, polls: 0 };
    runs.push(run);
    return { status: 202, data: { run: runView(run) } };
  }
  const status = /^\/marketing\/site\/generations\/([^/]+)$/.exec(path);
  if (status && method === 'GET') {
    const run = runs.find((r) => r.id === status[1]);
    if (!run) return { status: 404, data: { message: 'Генерация не найдена' } };
    run.polls += 1;
    if (run.status === 'QUEUED') run.status = 'RUNNING';
    else if (run.status === 'RUNNING') {
      if (aiFail) {
        run.status = 'FAILED';
        run.errorCode = aiFail;
      } else if (run.type !== 'INITIAL' && latest()?.id !== run.baseVersionId) {
        run.status = 'FAILED';
        run.errorCode = 'BASE_VERSION_CHANGED';
      } else {
        const out = append(run.type === 'INITIAL' ? fixtureSiteSpec('Первая версия от ИИ') : aiEdit(run), 'AI');
        run.status = 'SUCCEEDED';
        run.outputVersionId = out.id;
      }
    }
    return { status: 200, data: { run: runView(run) } };
  }
  return null;
}
