import {
  applyDesignDirection,
  diffSiteSpecs,
  findSection,
  parseExtensionChange,
  parsePlanAnswers,
  planFollowUpText,
  siteBuilderAccess,
  siteSpecAssetRefs,
  siteSpecHash,
  validateSiteSpec,
  type AssistantPayload,
  type DesignDirection,
  type ExtensionChange,
} from '@pms/domain';
import { fixtureAssetKinds } from './fixture-site-assets';

/**
 * Подставной API публикации (MKT7), редактора (MKT9) и лицензированного конструктора (MKT9.2) управляемого сайта для
 * UI-тестов. Только вымышленные данные (ADR-010). Правила
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
  /** MKT9.2: текст человека для разговора и ключ плана, по которому сборка поставлена */
  userText: string | null;
  requestKey: string | null;
  design: DesignDirection | null;
  createdAt: string;
  finishedAt: string | null;
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

/** MKT9.2: разговорная задача ИИ сайта (Чат, План, Оформление); версий не создаёт */
interface AiRun {
  id: string;
  mode: 'CHAT' | 'PLAN' | 'DESIGN';
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  requestKey: string;
  userText: string;
  answered: boolean;
  baseVersionId: string | null;
  assistantText: string | null;
  payload: Record<string, unknown> | null;
  errorCode: string | null;
  createdAt: string;
  finishedAt: string | null;
}

const SLUG = 'luxx-aparts';
/** MKT9.2: филиалы организации стенда для «Платформа → Организации → Конструктор сайта» */
export const FIXTURE_LOCATION_ID = 'lc000001-0000-4000-8000-000000000001';
const SECOND_LOCATION_ID = 'lc000002-0000-4000-8000-000000000002';
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
let archived = false;
let instructions: string | null = null;
let aiRuns: AiRun[] = [];
let bookmarks = new Map<string, string>();
type License = ExtensionChange & { updatedAt: string };
const ACTIVE_LICENSE = (): License => ({ status: 'ACTIVE', activeUntil: null, note: null, updatedAt: '2026-10-08T06:00:00.000Z' });
let licenses = new Map<string, License>([[FIXTURE_LOCATION_ID, ACTIVE_LICENSE()]]);

export function resetMarketingSiteFixture() {
  archived = false;
  instructions = null;
  aiRuns = [];
  bookmarks = new Map();
  licenses = new Map([[FIXTURE_LOCATION_ID, ACTIVE_LICENSE()]]);
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
const builder = () => {
  const row = licenses.get(FIXTURE_LOCATION_ID) ?? null;
  return { access: siteBuilderAccess(row, new Date()), status: row?.status ?? null, activeUntil: row?.activeUntil?.toISOString() ?? null };
};
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
    if (body['archived'] === true) {
      exists = false;
      archived = true;
    }
    if (body['license'] === 'OFF') licenses.set(FIXTURE_LOCATION_ID, { status: 'OFF', activeUntil: null, note: null, updatedAt: new Date(clock).toISOString() });
    if (body['license'] === 'NONE') licenses.delete(FIXTURE_LOCATION_ID);
    if (body['license'] === 'EXPIRED')
      licenses.set(FIXTURE_LOCATION_ID, { status: 'ACTIVE', activeUntil: new Date(Date.now() - 86_400_000), note: null, updatedAt: new Date(clock).toISOString() });
    if (body['noVersions'] === true) noVersions = true;
    if (typeof body['aiFail'] === 'string') aiFail = body['aiFail'];
    if (body['rateRequired'] === true) rateRequired = true;
    if (typeof body['revisions'] === 'number') versions = Array.from({ length: body['revisions'] }, (_, i) => version(i + 1));
    return { status: 200, data: { ok: true } };
  }
  if (!path.startsWith('/marketing/site')) return null;
  if (path === '/marketing/site' && method === 'GET')
    return {
      status: 200,
      data: { site: exists ? view() : null, archived, locationName: 'Luxx Aparts', builder: builder(), instructions: exists ? instructions : null },
    };
  // MKT9.2: запись и ИИ сайта только при действующей лицензии; пауза, архив, сайт брони и превью не закрыты
  const free = ['/marketing/site/pause', '/marketing/site/archive', '/marketing/site/booking-source', '/marketing/site/preview'];
  if (method !== 'GET' && !free.includes(path) && builder().access !== 'active') {
    const expired = builder().access === 'expired';
    return {
      status: 403,
      data: expired
        ? { code: 'SITE_BUILDER_EXPIRED', message: 'Срок лицензии конструктора сайта вышел: сайт доступен только для чтения', statusCode: 403 }
        : { code: 'SITE_BUILDER_NOT_ENABLED', message: 'Конструктор сайта не подключён для этого филиала', statusCode: 403 },
    };
  }
  // MKT9.2: заведение сайта пустым телом; имя и адрес из филиала; архив не заводится заново
  if (path === '/marketing/site/bootstrap' && method === 'POST') {
    if (archived) return conflict('SITE_ARCHIVED', 'Сайт филиала в архиве: новый сайт для этого филиала не заводится');
    if (exists) return { status: 200, data: { created: false, site: view() } };
    exists = true;
    noVersions = true;
    return { status: 201, data: { created: true, site: view() } };
  }
  if (path === '/marketing/site/brief' && method === 'GET')
    return {
      status: 200,
      data: {
        briefHash: 'b'.repeat(64),
        input: {
          identity: { displayNameCandidate: 'Luxx Aparts', address: 'ул. Вымышленная, 1', phone: '+77010000000', email: 'hello@luxx.example' },
          stay: { checkInTime: '14:00', checkOutTime: '12:00' },
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
    archived = true;
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
  bookmark: bookmarks.get(v.id) ?? null,
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
  if (path === '/marketing/site/versions' && method === 'GET') {
    const list = noVersions ? [] : [...versions].reverse().map(meta);
    return { status: 200, data: { versions: list, bookmarks: list.filter((v) => v.bookmark !== null) } };
  }
  if (path === '/marketing/site/versions' && method === 'POST') {
    if ((latest()?.revision ?? 0) !== body['baseRevision']) return conflictVersion();
    const checked = validateSiteSpec(body['spec']);
    if (!checked.ok) return { status: 400, data: { message: 'Документ сайта не прошёл проверку', errors: checked.errors } };
    const problems = assetProblems(checked.spec);
    if (problems.length) return { status: 409, data: { code: 'ASSET_UNAVAILABLE', message: 'В версии есть изображения, которых нет в библиотеке филиала', paths: problems } };
    const v = append(checked.spec, 'MANUAL');
    return { status: 201, data: { version: { id: v.id, revision: v.revision } } };
  }
  const mark = /^\/marketing\/site\/versions\/([^/]+)\/bookmark$/.exec(path);
  if (mark) {
    const v = versions.find((x) => x.id === mark[1]);
    if (!v) return { status: 404, data: { message: 'Версия не найдена' } };
    if (method === 'DELETE') {
      if (!bookmarks.delete(v.id)) return { status: 404, data: { message: 'Закладки нет' } };
      return { status: 200, data: { removed: true } };
    }
    const label = typeof body['label'] === 'string' ? body['label'].trim() : '';
    if (!label || [...label].length > 120) return { status: 400, data: { message: 'Подпись закладки: от 1 до 120 знаков' } };
    if (!bookmarks.has(v.id) && bookmarks.size >= 20) return conflict('BOOKMARK_LIMIT', 'Не больше 20 закладок: снимите ненужную');
    bookmarks.set(v.id, label);
    return { status: 200, data: { bookmark: { versionId: v.id, revision: v.revision, label } } };
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
    if (aiBusy()) return conflict('AI_BUSY', 'ИИ уже работает над этим сайтом: дождитесь результата');
    let design: DesignDirection | null = null;
    if (body['designRunId']) {
      const from = aiRuns.find((r) => r.id === body['designRunId'] && r.mode === 'DESIGN' && r.status === 'SUCCEEDED');
      design = ((from?.payload?.['directions'] as DesignDirection[] | undefined) ?? []).find((d) => d.id === body['designId']) ?? null;
      if (!design) return { status: 404, data: { message: 'Вариант оформления не найден' } };
    }
    const target = type === 'SECTION' ? { pageId: String(body['pageId']), sectionId: String(body['sectionId']) } : null;
    return { status: 202, data: { run: runView(newRun(type, type === 'INITIAL' ? null : String(body['baseVersionId']), target, typeof body['instruction'] === 'string' ? body['instruction'] : null, null, design)) } };
  }
  const assistant = assistantRoute(path, method, body);
  if (assistant) return assistant;
  if (path === '/marketing/site/context') {
    if (method === 'PATCH') {
      const value = typeof body['instructions'] === 'string' ? body['instructions'].trim() : '';
      if ([...value].length > 5000) return { status: 400, data: { message: 'Знания проекта: не длиннее 5000 знаков' } };
      instructions = value || null;
    }
    return { status: 200, data: { instructions } };
  }
  if (path === '/marketing/site/conversation' && method === 'GET') return { status: 200, data: { items: conversation() } };
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
        run.finishedAt = new Date(clock).toISOString();
      } else if (run.type !== 'INITIAL' && latest()?.id !== run.baseVersionId) {
        run.status = 'FAILED';
        run.errorCode = 'BASE_VERSION_CHANGED';
      } else {
        const first = run.design ? applyDesignDirection(fixtureSiteSpec('Первая версия от ИИ'), run.design) : fixtureSiteSpec('Первая версия от ИИ');
        const out = append(run.type === 'INITIAL' ? first : aiEdit(run), 'AI');
        run.status = 'SUCCEEDED';
        run.outputVersionId = out.id;
        run.finishedAt = new Date(clock).toISOString();
      }
    }
    return { status: 200, data: { run: runView(run) } };
  }
  return null;
}

// ---------- MKT9.2: разговор с ИИ сайта ----------

const aiBusy = () => runs.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING') || aiRuns.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING');

function newRun(type: Run['type'], baseVersionId: string | null, target: Run['target'], userText: string | null, requestKey: string | null, design: DesignDirection | null): Run {
  clock += 1000;
  const run: Run = {
    id: `run-${runs.length + 1}`,
    type,
    status: 'QUEUED',
    baseVersionId,
    outputVersionId: null,
    errorCode: null,
    target,
    polls: 0,
    userText,
    requestKey,
    design,
    createdAt: new Date(clock).toISOString(),
    finishedAt: null,
  };
  runs.push(run);
  return run;
}

/** Ответы ИИ стенда детерминированные: тесты и снимки видят одно и то же */
const DIRECTIONS: DesignDirection[] = [
  { id: 'warm', name: 'Тёплый дом', shortDescription: 'Мягкие цвета, крупные заголовки, номера сразу под первым экраном', theme: { preset: 'WARM', accent: 'TERRACOTTA', typography: 'CLASSIC', radius: 'ROUND', density: 'COMFORTABLE', colorScheme: 'LIGHT' }, heroVariant: 'IMAGE_FULL', sectionOrder: ['hero', 'accommodations', 'about', 'booking'] },
  { id: 'night', name: 'Ночной город', shortDescription: 'Строгая типографика, тёмный акцент, бронь выше', theme: { preset: 'NIGHT', accent: 'INDIGO', typography: 'MODERN', radius: 'SHARP', density: 'COMPACT', colorScheme: 'LIGHT' }, heroVariant: 'IMAGE_SIDE', sectionOrder: ['hero', 'booking', 'accommodations', 'about'] },
  { id: 'coast', name: 'Лёгкий бриз', shortDescription: 'Светлый и спокойный, больше воздуха, текстовый первый экран', theme: { preset: 'COAST', accent: 'FOREST', typography: 'ROUNDED', radius: 'SOFT', density: 'COMFORTABLE', colorScheme: 'LIGHT' }, heroVariant: 'TEXT_ONLY', sectionOrder: ['hero', 'about', 'accommodations', 'booking'] },
];

function finishAi(run: AiRun) {
  clock += 1000;
  run.status = 'SUCCEEDED';
  run.finishedAt = new Date(clock).toISOString();
  if (run.mode === 'CHAT') {
    run.assistantText = 'Первый экран можно сократить до одной строки, а номера поднять сразу под него.';
    run.payload = { kind: 'CHAT', suggestBuild: true, suggestPublish: /опублик/i.test(run.userText) };
  } else if (run.mode === 'PLAN' && !run.answered) {
    run.assistantText = 'Чтобы составить план, ответьте на вопрос.';
    run.payload = { kind: 'QUESTIONS', questions: [{ id: 'tone', question: 'Какой тон сайта?', options: ['Строгий', 'Тёплый', 'Дружеский'], allowCustom: true }] };
  } else if (run.mode === 'PLAN') {
    run.assistantText = 'Короче первый экран и номера выше';
    run.payload = {
      kind: 'PLAN',
      summary: 'Короче первый экран и номера выше',
      affectedPages: ['page-home'],
      affectedSections: ['sec-hero', 'sec-rooms'],
      steps: ['Сократить заголовок первого экрана', 'Поставить номера сразу после него'],
      tradeoffs: ['Раздел «О нас» опустится ниже'],
      buildInstruction: 'Сократи заголовок первого экрана и поставь номера сразу после него.',
    };
  } else {
    run.assistantText = 'Три варианта оформления: выберите один.';
    run.payload = { kind: 'DESIGN', directions: DIRECTIONS };
  }
}

const aiView = (run: AiRun) => {
  const out: Partial<AiRun> = { ...run };
  delete out.answered;
  return out;
};

function assistantRoute(path: string, method: string, body: Record<string, unknown>): { status: number; data: unknown } | null {
  if (path === '/marketing/site/assistant' && method === 'POST') {
    const key = String(body['requestKey'] ?? '');
    const again = aiRuns.find((r) => r.requestKey === key);
    if (again) return { status: 200, data: { run: aiView(again) } };
    const mode = body['mode'] as AiRun['mode'];
    if (!['CHAT', 'PLAN', 'DESIGN'].includes(mode)) return { status: 400, data: { message: 'mode: CHAT, PLAN или DESIGN' } };
    if (aiBusy()) return conflict('AI_BUSY', 'ИИ уже работает над этим сайтом: дождитесь результата');
    // как API (доводка MKT9.2): ответы только вместе с replyToRunId успешного плана с вопросами этого сайта
    const replying = body['answers'] !== undefined || body['replyToRunId'] !== undefined;
    const typed = typeof body['text'] === 'string' ? body['text'].trim() : '';
    let text = typed;
    if (replying) {
      if (mode !== 'PLAN' || body['answers'] === undefined || typeof body['replyToRunId'] !== 'string')
        return { status: 400, data: { message: 'Ответ на вопросы плана: нужны и replyToRunId, и answers' } };
      const parent = aiRuns.find((r) => r.id === body['replyToRunId']);
      if (!parent) return { status: 404, data: { message: 'Вопросы плана не найдены' } };
      const asked = parent.payload as unknown as AssistantPayload | null;
      if (parent.mode !== 'PLAN' || parent.status !== 'SUCCEEDED' || asked?.kind !== 'QUESTIONS')
        return { status: 400, data: { message: 'Отвечать можно только на вопросы плана, который ждёт ответов' } };
      const parsed = parsePlanAnswers(body['answers'], asked.questions);
      if (!parsed.ok) return { status: 400, data: { message: parsed.message } };
      text = planFollowUpText(parent.userText, asked.questions, parsed.answers, typed || null);
    }
    const answers = replying;
    clock += 1000;
    const run: AiRun = {
      id: `ai-${aiRuns.length + 1}`,
      mode,
      status: 'QUEUED',
      requestKey: key,
      userText: text || 'Предложи три варианта оформления по данным гостиницы.',
      answered: answers,
      baseVersionId: latest()?.id ?? null,
      assistantText: null,
      payload: null,
      errorCode: null,
      createdAt: new Date(clock).toISOString(),
      finishedAt: null,
    };
    aiRuns.push(run);
    return { status: 202, data: { run: aiView(run) } };
  }
  const one = /^\/marketing\/site\/assistant\/([^/]+)(\/approve)?$/.exec(path);
  if (!one) return null;
  const run = aiRuns.find((r) => r.id === one[1]);
  if (!run) return { status: 404, data: { message: 'Запрос не найден' } };
  if (!one[2] && method === 'GET') {
    if (run.status === 'QUEUED') run.status = 'RUNNING';
    else if (run.status === 'RUNNING') {
      if (aiFail) {
        run.status = 'FAILED';
        run.errorCode = aiFail;
        run.finishedAt = new Date(clock).toISOString();
      } else finishAi(run);
    }
    return { status: 200, data: { run: aiView(run) } };
  }
  if (one[2] && method === 'POST') {
    if (run.mode !== 'PLAN' || run.payload?.['kind'] !== 'PLAN') return { status: 404, data: { message: 'План не найден' } };
    const existing = runs.find((r) => r.requestKey === run.id);
    if (existing) return { status: 200, data: { run: runView(existing) } };
    if ((latest()?.id ?? null) !== run.baseVersionId) return conflict('BASE_VERSION_CHANGED', 'Сайт изменился после плана: попросите план заново');
    if (aiBusy()) return conflict('AI_BUSY', 'ИИ уже работает над этим сайтом: дождитесь результата');
    const instruction = typeof body['instruction'] === 'string' && body['instruction'].trim() ? body['instruction'].trim() : String(run.payload['buildInstruction']);
    const build = newRun(run.baseVersionId ? 'PATCH' : 'INITIAL', run.baseVersionId, null, instruction, run.id, null);
    return { status: 202, data: { run: runView(build) } };
  }
  return null;
}

function conversation() {
  const builds = runs.map((r) => ({
    id: r.id,
    kind: 'BUILD',
    mode: r.type,
    status: r.status === 'RUNNING' && r.polls === 0 ? 'QUEUED' : r.status,
    userText: r.userText,
    assistantText: null,
    payload: null,
    baseVersionId: r.baseVersionId,
    outputVersionId: r.outputVersionId,
    target: r.target,
    fromPlanId: r.requestKey && aiRuns.some((a) => a.id === r.requestKey) ? r.requestKey : null,
    createdAt: r.createdAt,
    finishedAt: r.finishedAt,
    errorCode: r.errorCode,
    errorMessage: null,
    tokenUsage: null,
  }));
  const talks = aiRuns.map((r) => ({
    id: r.id,
    kind: 'ASSISTANT',
    mode: r.mode,
    status: r.status,
    userText: r.userText,
    assistantText: r.assistantText,
    payload: r.payload,
    baseVersionId: r.baseVersionId,
    outputVersionId: null,
    target: null,
    fromPlanId: null,
    createdAt: r.createdAt,
    finishedAt: r.finishedAt,
    errorCode: r.errorCode,
    errorMessage: null,
    tokenUsage: null,
  }));
  return [...builds, ...talks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------- MKT9.2: «Платформа → Организации → Конструктор сайта» ----------

const FIXTURE_LOCATIONS = [
  { id: FIXTURE_LOCATION_ID, name: 'Luxx Aparts', businessName: 'Luxx', status: 'ACTIVE' },
  { id: SECOND_LOCATION_ID, name: 'Marina', businessName: 'Luxx', status: 'ACTIVE' },
];

function licenseView(l: (typeof FIXTURE_LOCATIONS)[number]) {
  const row = licenses.get(l.id) ?? null;
  return {
    ...l,
    site: l.id === FIXTURE_LOCATION_ID && (exists || archived) ? { state: archived ? 'ARCHIVED' : state, slug: SLUG } : null,
    license: {
      access: siteBuilderAccess(row, new Date()),
      status: row?.status ?? null,
      activeUntil: row?.activeUntil?.toISOString() ?? null,
      note: row?.note ?? null,
      updatedAt: row?.updatedAt ?? null,
    },
  };
}

/** Только для вошедшего главного администратора: проверку делает подставной API платформы до вызова */
export function platformSiteBuilderFixture(path: string, method: string, body: Record<string, unknown>): { status: number; data: unknown } | null {
  const list = /^\/platform\/organizations\/([^/]+)\/site-builder$/.exec(path);
  if (list && method === 'GET') return { status: 200, data: { items: list[1] === 'ui-org' ? FIXTURE_LOCATIONS.map(licenseView) : [] } };
  const one = /^\/platform\/organizations\/([^/]+)\/site-builder\/([^/]+)$/.exec(path);
  if (one && method === 'PUT') {
    const location = one[1] === 'ui-org' ? FIXTURE_LOCATIONS.find((l) => l.id === one[2]) : undefined;
    if (!location) return { status: 404, data: { message: 'Такого гостиничного филиала у организации нет' } };
    const parsed = parseExtensionChange(body, new Date());
    if (!parsed.ok) return { status: 400, data: { message: parsed.errors.join('; ') } };
    licenses.set(location.id, { ...parsed.value, updatedAt: new Date().toISOString() });
    return { status: 200, data: licenseView(location) };
  }
  return null;
}
