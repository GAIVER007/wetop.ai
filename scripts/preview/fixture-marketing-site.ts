/**
 * Подставной API публикации управляемого сайта (MKT7) для UI-тестов. Только вымышленные данные (ADR-010). Правила
 * повторяют API там, где их видит стойка: публикуется только голова черновика, откат только на ранее опубликованную
 * версию, источник брони не выбирается сам, без тарифа (если он нужен) публикация 409.
 */
type State = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
type Action = 'PUBLISH' | 'ROLLBACK' | 'PAUSE' | 'RESUME' | 'ARCHIVE';
interface Version {
  id: string;
  revision: number;
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
const version = (n: number): Version => ({ id: `0000000${n}-0000-4000-8000-00000000000${n}`, revision: n });
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
let clock = Date.parse('2026-10-07T09:00:00.000Z');

export function resetMarketingSiteFixture() {
  exists = true;
  state = 'DRAFT';
  versions = [version(1), version(2)];
  published = null;
  publications = [];
  booking = structuredClone(BOOKING_SEED);
  rateRequired = false;
  clock = Date.parse('2026-10-07T09:00:00.000Z');
}

const latest = () => versions[versions.length - 1] ?? null;
const view = () => ({
  id: 'ms000001-0000-4000-8000-000000000001',
  name: 'Luxx Aparts',
  slug: SLUG,
  state,
  latest: latest(),
  published,
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
): { status: number; data: unknown } | null {
  if (path === '/__test/marketing-site' && method === 'POST') {
    // новая ревизия черновика без сброса (как сохранение версии в MKT3): нужна для сценария отката
    if (body['addRevision'] === true) {
      versions.push(version(versions.length + 1));
      return { status: 200, data: { ok: true } };
    }
    resetMarketingSiteFixture();
    if (body['noSite'] === true) exists = false;
    if (body['rateRequired'] === true) rateRequired = true;
    if (typeof body['revisions'] === 'number') versions = Array.from({ length: body['revisions'] }, (_, i) => version(i + 1));
    return { status: 200, data: { ok: true } };
  }
  if (!path.startsWith('/marketing/site')) return null;
  if (path === '/marketing/site' && method === 'GET') return { status: 200, data: { site: exists ? view() : null } };
  if (!exists) return { status: 404, data: { message: 'Сайт филиала ещё не создан' } };
  if (path === '/marketing/site/publications' && method === 'GET')
    return { status: 200, data: { publications: [...publications].reverse() } };
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
