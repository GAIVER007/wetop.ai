import {
  expect,
  request as playwrightRequest,
  test,
  type BrowserContext,
  type Page,
  type Request,
  type Response,
  type TestInfo,
} from '@playwright/test';
import { createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const parent = process.env.A28_WORK_DIR ?? process.env.A25_WORK_DIR ?? '';
test.skip(!parent, 'Requires the isolated A27 HTTP runtime');

const privateData = parent
  ? (JSON.parse(readFileSync(`${parent}/a26-private.json`, 'utf8')) as {
      email: string;
      password: string;
      user: string;
      org: string;
      scopes: Record<
        string,
        { property: string; location: string; business: string; currency: string; name?: string }
      >;
    })
  : { email: '', password: '', user: '', org: '', scopes: {} };
const api = (
  process.env.A28_API_URL ??
  process.env.A27_API_URL ??
  process.env.A25_API_URL ??
  'http://127.0.0.1:4427'
).replace(/\/$/, '');
const site = (
  process.env.A28_SITE_URL ??
  process.env.A27_SITE_URL ??
  'http://127.0.0.1:3037'
).replace(/\/$/, '');
const web = (process.env.A28_WEB_URL ?? process.env.A27_WEB_URL ?? 'http://127.0.0.1:3137').replace(
  /\/$/,
  '',
);
const evidence = process.env.A25_EVIDENCE_DIR ?? `${parent}/a27-evidence`;
const databaseHost = process.env.A28_PG_HOST ?? '127.0.0.1';
const databasePort = Number(process.env.A28_PG_PORT ?? '55601');
const migratorRole = process.env.A28_PG_MIGRATOR_ROLE ?? 'a24_migrator';
const databaseName = process.env.A28_PG_DATABASE ?? process.env.A25_DATABASE ?? 'a26_auth';
const dbConfig = {
  host: databaseHost,
  port: databasePort,
  user: migratorRole,
  database: databaseName,
  options: '-c search_path=pms_test,public',
};

type StaffFixture = {
  email: string;
  password: string;
  user: string;
  org: string;
  business: string;
  location: string;
  property: string;
  newBeforeSetup: boolean;
};

let staff: StaffFixture;

function record(testInfo: TestInfo, value: Record<string, boolean | number | string>) {
  mkdirSync(evidence, { recursive: true });
  const name = testInfo.title
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  writeFileSync(
    `${evidence}/${name}.json`,
    JSON.stringify(
      { phase: process.env.A28_PHASE ?? process.env.A27_PHASE ?? 'unspecified', ...value },
      null,
      2,
    ),
  );
}

function canonicalLogin(route: string) {
  return `${site}/?next=${encodeURIComponent(route)}#login`;
}

function protectedMarkers() {
  return [
    'A26 synthetic',
    privateData.user,
    privateData.org,
    ...Object.values(privateData.scopes).flatMap((scope) => [
      scope.property,
      scope.location,
      scope.business,
      scope.name ?? '',
    ]),
  ].filter(Boolean);
}

function assertNoProtectedFixture(...bodies: string[]) {
  const leaked = protectedMarkers().some((marker) => bodies.some((body) => body.includes(marker)));
  expect(leaked).toBe(false);
}

function markerSummary(text: string) {
  let matchedMarkerCount = 0;
  let occurrenceCount = 0;
  for (const marker of protectedMarkers()) {
    let occurrences = 0;
    let from = 0;
    while (marker && (from = text.indexOf(marker, from)) !== -1) {
      occurrences += 1;
      from += marker.length;
    }
    if (occurrences > 0) matchedMarkerCount += 1;
    occurrenceCount += occurrences;
  }
  return { matchedMarkerCount, occurrenceCount };
}

async function pageMarkerClassification(page: Page) {
  return page.evaluate((markers) => {
    const summarize = (text: string) => {
      let matchedMarkerCount = 0;
      let occurrenceCount = 0;
      for (const marker of markers) {
        let occurrences = 0;
        let from = 0;
        while (marker && (from = text.indexOf(marker, from)) !== -1) {
          occurrences += 1;
          from += marker.length;
        }
        if (occurrences > 0) matchedMarkerCount += 1;
        occurrenceCount += occurrences;
      }
      return { matchedMarkerCount, occurrenceCount };
    };
    const copy = document.documentElement.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('script').forEach((script) => script.remove());
    const scripts = Array.from(document.scripts).map((script) => script.textContent ?? '');
    const bootstrap = scripts.filter(
      (script) => script.includes('__next_f.push') || script.includes('__next_f='),
    );
    const hasMarker = (text: string) => markers.some((marker) => text.includes(marker));
    return {
      visibleBody: summarize(document.body.innerText),
      nonScriptHtml: summarize(copy.outerHTML),
      allScripts: summarize(scripts.join('\n')),
      scriptNodeCount: scripts.length,
      scriptNodesWithMarkers: scripts.filter(hasMarker).length,
      bootstrapScriptNodeCount: bootstrap.length,
      bootstrapScriptNodesWithMarkers: bootstrap.filter(hasMarker).length,
      bootstrapScripts: summarize(bootstrap.join('\n')),
    };
  }, protectedMarkers());
}

type IdentityObservation = {
  pathChanged: boolean;
  beforeUnload: boolean;
  newDocument: boolean;
  visibleOldIdentityAfterPath: boolean;
  visibleOwnerOnlyUiAfterPath: boolean;
  visibleStaffIdentityAfterPath: boolean;
};

function identityObserver(input: {
  startPath: string;
  ownerName: string;
  ownerEmail: string;
  staffName: string;
  staffEmail: string;
}) {
  const publish = (event: Partial<IdentityObservation>) => {
    const binding = (
      window as unknown as {
        a27IdentityEvent?: (value: Partial<IdentityObservation>) => Promise<void>;
      }
    ).a27IdentityEvent;
    if (binding) void binding(event).catch(() => undefined);
  };
  const visible = (element: Element) => {
    if (!(element instanceof HTMLElement) || element.closest('[hidden]')) return false;
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity) !== 0 &&
      box.width > 0 &&
      box.height > 0
    );
  };
  const scan = () => {
    const pathChanged = window.location.pathname !== input.startPath;
    if (!pathChanged) return;
    const identity = Array.from(document.querySelectorAll('.profile-caption, .profile-signed-in'))
      .filter(visible)
      .map((element) => element.textContent ?? '')
      .join('\n');
    publish({
      pathChanged: true,
      visibleOldIdentityAfterPath:
        identity.includes(input.ownerName) || identity.includes(input.ownerEmail),
      visibleOwnerOnlyUiAfterPath: Array.from(
        document.querySelectorAll('[data-testid="team-link"], a[href="/journal"]'),
      ).some(visible),
      visibleStaffIdentityAfterPath:
        identity.includes(input.staffName) && identity.includes(input.staffEmail),
    });
  };
  const start = () => {
    publish({ newDocument: window.location.pathname !== input.startPath });
    const observer = new MutationObserver(scan);
    observer.observe(document.querySelector('.workspace') ?? document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style'],
    });
    const waitForPath = () => {
      if (window.location.pathname !== input.startPath) {
        scan();
        return;
      }
      requestAnimationFrame(waitForPath);
    };
    requestAnimationFrame(waitForPath);
  };
  window.addEventListener('beforeunload', () => publish({ beforeUnload: true }), { once: true });
  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start, { once: true });
}

async function query(sql: string, params: unknown[] = []) {
  const client = new pg.Client(dbConfig);
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
}

function passwordHash(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 }).toString('base64url');
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

async function loginThroughSite(page: Page, next = '/today') {
  await page.goto(canonicalLogin(next));
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Почта').fill(privateData.email);
  await dialog.getByLabel('Пароль', { exact: true }).fill(privateData.password);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/site-auth/login') && response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`^${web.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`));
  return response;
}

async function loginFixtureThroughSite(
  page: Page,
  credentials: { email: string; password: string },
  next = '/profile/access',
) {
  await page.goto(canonicalLogin(next));
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Почта').fill(credentials.email);
  await dialog.getByLabel('Пароль', { exact: true }).fill(credentials.password);
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`^${web.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`));
}

async function openAccess(page: Page) {
  await page.goto(`${web}/profile/access`);
  await expect(
    page.getByRole('heading', { name: 'Управление доступом', exact: true }),
  ).toBeVisible();
}

async function sessionCookie(context: BrowserContext) {
  const cookie = (await context.cookies()).find((item) => item.name === 'wetop_session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.value).toBeTruthy();
  return cookie!;
}

async function selectedScope(context: BrowserContext) {
  const cookie = (await context.cookies()).find((item) => item.name === 'wetop_scope');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.value).toBeTruthy();
  return decodeURIComponent(cookie!.value);
}

async function apiForSession(token: string, scope?: string) {
  return playwrightRequest.newContext({
    baseURL: api,
    extraHTTPHeaders: {
      authorization: `Bearer ${token}`,
      ...(scope ? { 'x-wetop-scope': scope } : {}),
    },
  });
}

async function webForSessionCookie(token: string) {
  return playwrightRequest.newContext({
    baseURL: web,
    extraHTTPHeaders: { cookie: `wetop_session=${token}` },
  });
}

async function selectOwnerKztBranch(page: Page, context: BrowserContext) {
  await expect(page).toHaveURL(
    new RegExp(`^${web.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/branches`),
  );
  const branch = page.locator('.panel').filter({
    hasText: `ID филиала: ${privateData.scopes.KZT!.location}`,
  });
  await expect(branch).toHaveCount(1);
  await expect(branch).toBeVisible();
  await expect(branch).toContainText('Валюта KZT');
  await branch
    .getByRole('button', { name: /Открыть филиал|Настроить номера/, exact: true })
    .click();
  await expect(page).not.toHaveURL(/\/branches(?:[?#]|$)/);
  const pointer = await selectedScope(context);
  expect(pointer).toBe(
    `business=${privateData.scopes.KZT!.business};location=${privateData.scopes.KZT!.location}`,
  );
  return pointer;
}

async function setSessionState(token: string, state: 'expired' | 'revoked') {
  const hash = createHash('sha256').update(token).digest('hex');
  await query(
    state === 'expired'
      ? "UPDATE sessions SET expires_at=clock_timestamp()-interval '60 seconds' WHERE token_hash=$1"
      : 'UPDATE sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1',
    [hash],
  );
}

async function rejectProtected(
  page: Page,
  context: BrowserContext,
  route: string,
): Promise<{ documentStatus: number; rscStatus: number }> {
  const document = await context.request.get(`${web}${route}`, { maxRedirects: 0 });
  const rsc = await context.request.get(`${web}${route}?_rsc=a27`, {
    maxRedirects: 0,
    headers: { RSC: '1' },
  });
  const documentBody = await document.text();
  const rscBody = await rsc.text();
  assertNoProtectedFixture(documentBody, rscBody);
  await page.goto(`${web}${route}`);
  await expect(page).toHaveURL(canonicalLogin(route));
  assertNoProtectedFixture(await page.content(), await page.locator('body').innerText());
  return { documentStatus: document.status(), rscStatus: rsc.status() };
}

function colorChannels(value: string) {
  const channels =
    value
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number) ?? [];
  expect(channels).toHaveLength(3);
  return channels;
}

function contrast(foreground: string, background: string) {
  const luminance = (value: string) => {
    const [red, green, blue] = colorChannels(value).map((channel) => {
      const normalized = channel! / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test.beforeAll(async () => {
  const ids = {
    user: randomUUID(),
    org: randomUUID(),
    business: randomUUID(),
    location: randomUUID(),
    property: randomUUID(),
  };
  const email = `a27-staff-${ids.user}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const existing = await query(
    'SELECT (SELECT count(*) FROM users WHERE id=$1 OR email=$2)::int users, (SELECT count(*) FROM organizations WHERE id=$3)::int organizations, (SELECT count(*) FROM properties WHERE id=$4)::int properties',
    [ids.user, email, ids.org, ids.property],
  );
  const newBeforeSetup = Object.values(existing[0] as Record<string, number>).every(
    (count) => count === 0,
  );
  const now = new Date().toISOString();
  await query("INSERT INTO organizations(id,name,status) VALUES($1,$2,'ACTIVE')", [
    ids.org,
    'A27 isolated staff organization',
  ]);
  await query(
    "INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES($1,$2,$3,'HOSPITALITY',$4)",
    [ids.business, ids.org, 'A27 isolated staff business', now],
  );
  await query(
    "INSERT INTO locations(id,business_id,name,currency,timezone,updated_at) VALUES($1,$2,$3,'KZT','Asia/Almaty',$4)",
    [ids.location, ids.business, 'A27 isolated staff location', now],
  );
  await query(
    "INSERT INTO properties(id,organization_id,location_id,name,currency,timezone,check_in_time,check_out_time,updated_at) VALUES($1,$2,$3,$4,'KZT','Asia/Almaty','14:00','12:00',$5)",
    [ids.property, ids.org, ids.location, 'A27 isolated staff property', now],
  );
  const inventory = {
    building: randomUUID(),
    floor: randomUUID(),
    room: randomUUID(),
    category: randomUUID(),
    unit: randomUUID(),
  };
  await query('INSERT INTO buildings(id,property_id,name) VALUES($1,$2,$3)', [
    inventory.building,
    ids.property,
    'A27 isolated building',
  ]);
  await query('INSERT INTO floors(id,building_id,name) VALUES($1,$2,$3)', [
    inventory.floor,
    inventory.building,
    '1',
  ]);
  await query(
    'INSERT INTO physical_rooms(id,floor_id,room_number,capacity,updated_at) VALUES($1,$2,$3,1,$4)',
    [inventory.room, inventory.floor, 'A27-1', now],
  );
  await query(
    "INSERT INTO accommodation_types(id,property_id,code,name,kind,capacity_adults,updated_at) VALUES($1,$2,'A27','A27 isolated room','PRIVATE_ROOM',1,$3)",
    [inventory.category, ids.property, now],
  );
  await query(
    "INSERT INTO inventory_units(id,property_id,physical_room_id,accommodation_type_id,kind,code,updated_at) VALUES($1,$2,$3,$4,'ROOM','A27-1',$5)",
    [inventory.unit, ids.property, inventory.room, inventory.category, now],
  );
  await query(
    'INSERT INTO users(id,email,name,password_hash,email_verified_at) VALUES($1,$2,$3,$4,$5)',
    [ids.user, email, 'A27 isolated staff user', passwordHash(password), now],
  );
  await query("INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,'STAFF')", [
    ids.user,
    ids.org,
  ]);
  staff = { ...ids, email, password, newBeforeSetup };
});

for (const route of ['/today', '/chessboard', '/reservations']) {
  test(`original anonymous ${route} redirects to canonical site login`, async ({
    page,
  }, testInfo) => {
    await page.goto(`${web}${route}`);
    await expect(page).toHaveURL(canonicalLogin(route));
    record(testInfo, {
      route,
      redirected: true,
      destination: canonicalLogin(route),
    });
  });
}

test('original logout revokes browser session and protects the next request', async ({
  page,
}, testInfo) => {
  await loginThroughSite(page, '/profile/access');
  await page.goto(`${web}/profile/access`);
  await expect(
    page.getByRole('heading', { name: 'Управление доступом', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(canonicalLogin('/today'));
  await page.goto(`${web}/today`);
  await expect(page).toHaveURL(canonicalLogin('/today'));
  record(testInfo, {
    loginViaPublicSite: true,
    logoutViaOrdinaryUi: true,
    subsequentRequestDenied: true,
    destination: canonicalLogin('/today'),
  });
});

test('anonymous document DOM and RSC responses contain no protected fixture markers', async ({
  page,
  context,
}, testInfo) => {
  const statuses: number[] = [];
  for (const route of ['/today', '/chessboard', '/reservations']) {
    const result = await rejectProtected(page, context, route);
    statuses.push(result.documentStatus, result.rscStatus);
  }
  const anonymous = await playwrightRequest.newContext({ baseURL: api });
  try {
    const response = await anonymous.get('/auth/sessions');
    expect(response.status()).toBe(401);
    assertNoProtectedFixture(await response.text());
    record(testInfo, {
      anonymousApiStatus: response.status(),
      protectedMarkersAbsent: true,
      checkedResponseCount: statuses.length + 1,
      destination: page.url(),
    });
  } finally {
    await anonymous.dispose();
  }
});

test('expired revoked unknown and damaged sessions are denied without protected data', async ({
  page,
  context,
}, testInfo) => {
  await loginThroughSite(page, '/profile/access');
  await openAccess(page);
  const expired = await sessionCookie(context);
  await setSessionState(expired.value, 'expired');
  const expiredResult = await rejectProtected(page, context, '/profile/access');

  await context.clearCookies();
  await loginThroughSite(page, '/profile/access');
  await openAccess(page);
  const revoked = await sessionCookie(context);
  await setSessionState(revoked.value, 'revoked');
  const revokedResult = await rejectProtected(page, context, '/profile/access');

  await context.clearCookies();
  await context.addCookies([
    {
      name: 'wetop_session',
      value: randomBytes(32).toString('base64url'),
      url: web,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const unknownResult = await rejectProtected(page, context, '/chessboard');

  await context.clearCookies();
  await context.addCookies([
    {
      name: 'wetop_session',
      value: 'damaged-a27-session',
      url: web,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const damagedResult = await rejectProtected(page, context, '/reservations');

  record(testInfo, {
    expiredDocumentStatus: expiredResult.documentStatus,
    revokedDocumentStatus: revokedResult.documentStatus,
    unknownDocumentStatus: unknownResult.documentStatus,
    damagedDocumentStatus: damagedResult.documentStatus,
    allRejected: true,
    protectedMarkersAbsent: true,
    destination: page.url(),
  });
});

test('revoked owner query-only request receives no fresh protected data', async ({
  page,
  context,
}, testInfo) => {
  await loginThroughSite(page, '/branches');
  await selectOwnerKztBranch(page, context);
  await page.goto(`${web}/today?period=month`);
  await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
  const period = page.getByRole('navigation', { name: 'Период финансов' });
  await expect(period.getByRole('link', { name: 'Месяц', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const baseline = await pageMarkerClassification(page);
  expect(baseline.visibleBody.occurrenceCount).toBeGreaterThan(0);

  const revoked = await sessionCookie(context);
  const ownerScope = await selectedScope(context);
  await setSessionState(revoked.value, 'revoked');

  const weekLink = period.getByRole('link', { name: '7 дней', exact: true });
  const linkHref = await weekLink.getAttribute('href');
  const linkUrl = new URL(linkHref!, web);
  expect(linkUrl.searchParams.get('period')).toBe('week');
  const queryRequests: Request[] = [];
  const queryResponses: Response[] = [];
  let queryRscCapture:
    | Promise<
        | { state: 'AVAILABLE'; body: string }
        | { state: 'NOT_AVAILABLE_AFTER_REDIRECT'; body?: never }
      >
    | undefined;
  const matchesQuery = (urlValue: string) => {
    const url = new URL(urlValue);
    return (
      url.origin === web && url.pathname === '/today' && url.searchParams.get('period') === 'week'
    );
  };
  const onRequest = (request: Request) => {
    if (matchesQuery(request.url())) queryRequests.push(request);
  };
  const onResponse = (response: Response) => {
    if (!matchesQuery(response.url())) return;
    queryResponses.push(response);
    if (response.request().headers().rsc === '1' && !queryRscCapture) {
      queryRscCapture = response
        .text()
        .then((body) => ({ state: 'AVAILABLE' as const, body }))
        .catch(() => ({ state: 'NOT_AVAILABLE_AFTER_REDIRECT' as const }));
    }
  };
  page.on('request', onRequest);
  page.on('response', onResponse);
  await weekLink.click();
  await page.waitForLoadState('networkidle');
  const revokedLogin = canonicalLogin('/today?period=week');
  const revokedNavigationRedirected = page.url() === revokedLogin;
  if (revokedNavigationRedirected) {
    await expect(page.getByRole('dialog', { name: 'Вход и регистрация в WETOP' })).toBeVisible();
    assertNoProtectedFixture(await page.content(), await page.locator('body').innerText());
  } else {
    expect(page.url()).toBe(`${web}/today?period=week`);
    expect(queryRequests.filter((request) => request.headers().rsc === '1')).toHaveLength(0);
    await expect(
      page
        .getByRole('navigation', { name: 'Период финансов' })
        .getByRole('link', { name: '7 дней', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  }
  page.off('request', onRequest);
  page.off('response', onResponse);
  const queryRsc = queryResponses.find((response) => response.request().headers().rsc === '1');
  const queryRscCaptureResult = queryRscCapture
    ? await queryRscCapture
    : ({ state: 'NOT_OBSERVED' } as const);
  if (queryRscCaptureResult.state === 'AVAILABLE') {
    assertNoProtectedFixture(queryRscCaptureResult.body);
  }

  const oldCookieWeb = await webForSessionCookie(revoked.value);
  const oldSessionApi = await apiForSession(revoked.value, ownerScope);
  try {
    const [document, rsc, me, branches, sessions, members] = await Promise.all([
      oldCookieWeb.get('/today?period=week', { maxRedirects: 0 }),
      oldCookieWeb.get('/today?period=week&_rsc=a28-revoked-query', {
        maxRedirects: 0,
        headers: { RSC: '1' },
      }),
      oldSessionApi.get('/auth/me'),
      oldSessionApi.get('/branches'),
      oldSessionApi.get('/auth/sessions'),
      oldSessionApi.get('/auth/members'),
    ]);
    const [documentBody, rscBody, meBody, branchesBody, sessionsBody, membersBody] =
      await Promise.all([
        document.text(),
        rsc.text(),
        me.text(),
        branches.text(),
        sessions.text(),
        members.text(),
      ]);
    assertNoProtectedFixture(
      documentBody,
      rscBody,
      meBody,
      branchesBody,
      sessionsBody,
      membersBody,
    );
    expect([302, 303, 307, 308]).toContain(document.status());
    const rscRedirected =
      [302, 303, 307, 308].includes(rsc.status()) ||
      Boolean(rsc.headers().location) ||
      Boolean(rsc.headers()['x-nextjs-redirect']) ||
      rscBody.includes(site);
    const rscUrl = new URL(rsc.url());
    expect(rscUrl.pathname).toBe('/today');
    expect(rscUrl.searchParams.get('period')).toBe('week');
    expect(rscRedirected).toBe(true);
    expect(me.status()).toBe(401);
    expect(branches.status()).toBe(401);
    expect(sessions.status()).toBe(401);
    expect(members.status()).toBe(401);

    record(testInfo, {
      baselineVisibleOwnerMarkerCount: baseline.visibleBody.occurrenceCount,
      baselineBootstrapOwnerMarkerCount: baseline.bootstrapScripts.occurrenceCount,
      actualQueryOnlyLink: true,
      actualQueryLinkTarget: `${linkUrl.pathname}${linkUrl.search}`,
      browserQueryRequestCount: queryRequests.length,
      browserQueryRscRequestCount: queryRequests.filter((request) => request.headers().rsc === '1')
        .length,
      browserQueryPrefetchRequestCount: queryRequests.filter(
        (request) => request.headers()['next-router-prefetch'] === '1',
      ).length,
      browserQueryResponseCount: queryResponses.length,
      browserQueryFirstResponseStatus: queryResponses[0]?.status() ?? 0,
      browserQueryRscObserved: Boolean(queryRsc),
      browserQueryRscStatus: queryRsc?.status() ?? 0,
      browserQueryRscCacheHeader: queryRsc?.headers()['x-nextjs-cache'] ?? 'absent',
      browserQueryRscContentType: queryRsc?.headers()['content-type'] ?? 'absent',
      browserQueryRscRedirectHeaderPresent: Boolean(
        queryRsc?.headers()['x-nextjs-redirect'] ?? queryRsc?.headers().location,
      ),
      browserQueryRscOwnerMarkersAbsent:
        queryRscCaptureResult.state === 'AVAILABLE' ? true : queryRscCaptureResult.state,
      browserNavigationUsedNoNetworkRequest: queryRequests.length === 0,
      browserNavigationOutcome: revokedNavigationRedirected
        ? 'CANONICAL_LOGIN_REDIRECT'
        : 'CACHED_WEB_WEEK',
      browserRedirectLoginVisible: revokedNavigationRedirected,
      browserRedirectProtectedMarkersAbsent: revokedNavigationRedirected,
      oldCookieDocumentStatus: document.status(),
      oldCookieRscStatus: rsc.status(),
      oldCookieRscRedirected: true,
      oldSessionMeStatus: me.status(),
      oldSessionMeProtectedMarkersAbsent: true,
      oldSessionBranchesStatus: branches.status(),
      oldSessionSessionsStatus: sessions.status(),
      oldSessionMembersStatus: members.status(),
      destination: page.url(),
    });
  } finally {
    await oldCookieWeb.dispose();
    await oldSessionApi.dispose();
  }
});

test('owner tab query-only request after STAFF login cannot query owner tenant or permissions', async ({
  page: ownerTab,
  context,
}, testInfo) => {
  await loginThroughSite(ownerTab, '/branches');
  await selectOwnerKztBranch(ownerTab, context);
  await ownerTab.goto(`${web}/today?period=month`);
  await expect(ownerTab.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
  const baseline = await pageMarkerClassification(ownerTab);
  expect(baseline.visibleBody.occurrenceCount).toBeGreaterThan(0);
  const ownerSession = await sessionCookie(context);
  const ownerScope = await selectedScope(context);

  const switchTab = await context.newPage();
  await openAccess(switchTab);
  await switchTab.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(switchTab).toHaveURL(canonicalLogin('/today'));
  await loginFixtureThroughSite(switchTab, staff, '/profile/access');
  await openAccess(switchTab);
  const staffSession = await sessionCookie(context);
  const staffScope = await selectedScope(context);
  expect(staffScope).toBe(`business=${staff.business};location=${staff.location}`);
  expect(staffScope).not.toBe(ownerScope);

  const tour = ownerTab.getByTestId('product-tour');
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: 'Пропустить', exact: true }).click();
  await expect(tour).toBeHidden();

  const period = ownerTab.getByRole('navigation', { name: 'Период финансов' });
  const weekLink = period.getByRole('link', { name: '7 дней', exact: true });
  const linkHref = await weekLink.getAttribute('href');
  const linkUrl = new URL(linkHref!, web);
  expect(linkUrl.searchParams.get('period')).toBe('week');
  const queryRequests: Request[] = [];
  const queryResponses: Response[] = [];
  let queryRscCapture:
    | Promise<
        | { state: 'AVAILABLE'; body: string }
        | { state: 'NOT_AVAILABLE_AFTER_NAVIGATION'; body?: never }
      >
    | undefined;
  const matchesQuery = (urlValue: string) => {
    const url = new URL(urlValue);
    return (
      url.origin === web && url.pathname === '/today' && url.searchParams.get('period') === 'week'
    );
  };
  const onRequest = (request: Request) => {
    if (matchesQuery(request.url())) queryRequests.push(request);
  };
  const onResponse = (response: Response) => {
    if (!matchesQuery(response.url())) return;
    queryResponses.push(response);
    if (response.request().headers().rsc === '1' && !queryRscCapture) {
      queryRscCapture = response
        .text()
        .then((body) => ({ state: 'AVAILABLE' as const, body }))
        .catch(() => ({ state: 'NOT_AVAILABLE_AFTER_NAVIGATION' as const }));
    }
  };
  ownerTab.on('request', onRequest);
  ownerTab.on('response', onResponse);
  await weekLink.click();
  await expect(ownerTab).toHaveURL(
    (url) => url.pathname === '/today' && url.searchParams.get('period') === 'week',
  );
  await expect(weekLink).toHaveAttribute('aria-current', 'page');
  ownerTab.off('request', onRequest);
  ownerTab.off('response', onResponse);
  const queryRsc = queryResponses.find((response) => response.request().headers().rsc === '1');
  const queryRscCaptureResult = queryRscCapture
    ? await queryRscCapture
    : ({ state: 'NOT_OBSERVED' } as const);
  if (queryRscCaptureResult.state === 'AVAILABLE') {
    assertNoProtectedFixture(queryRscCaptureResult.body);
  }
  const afterQuery = await pageMarkerClassification(ownerTab);

  const staffApi = await apiForSession(staffSession.value, staffScope);
  const oldOwnerApi = await apiForSession(ownerSession.value, ownerScope);
  const staffCookieWeb = await playwrightRequest.newContext({
    baseURL: web,
    storageState: await context.storageState(),
  });
  try {
    const [
      staffRsc,
      me,
      branches,
      members,
      forbidden,
      oldMe,
      oldBranches,
      oldSessions,
      oldMembers,
    ] = await Promise.all([
      staffCookieWeb.get('/today?period=week&_rsc=a28-staff-query', {
        maxRedirects: 0,
        headers: { RSC: '1' },
      }),
      staffApi.get('/auth/me'),
      staffApi.get('/branches'),
      staffApi.get('/auth/members'),
      staffApi.patch(`/auth/members/${privateData.user}`, { data: { role: 'manager' } }),
      oldOwnerApi.get('/auth/me'),
      oldOwnerApi.get('/branches'),
      oldOwnerApi.get('/auth/sessions'),
      oldOwnerApi.get('/auth/members'),
    ]);
    const [
      staffRscBody,
      meBody,
      branchesBody,
      membersBody,
      forbiddenBody,
      oldMeBody,
      oldBranchesBody,
      oldSessionsBody,
      oldMembersBody,
    ] = await Promise.all([
      staffRsc.text(),
      me.text(),
      branches.text(),
      members.text(),
      forbidden.text(),
      oldMe.text(),
      oldBranches.text(),
      oldSessions.text(),
      oldMembers.text(),
    ]);
    assertNoProtectedFixture(
      staffRscBody,
      meBody,
      branchesBody,
      membersBody,
      forbiddenBody,
      oldMeBody,
      oldBranchesBody,
      oldSessionsBody,
      oldMembersBody,
    );

    const staffRscUrl = new URL(staffRsc.url());
    expect(staffRscUrl.pathname).toBe('/today');
    expect(staffRscUrl.searchParams.get('period')).toBe('week');
    const staffRscLocation = staffRsc.headers().location;
    const staffRscMode =
      staffRsc.status() === 200
        ? 'DIRECT_RSC_200'
        : staffRsc.status() === 307 && staffRscLocation
          ? 'CANONICAL_DOCUMENT_307'
          : 'UNEXPECTED';
    expect(staffRscMode).not.toBe('UNEXPECTED');
    let staffCanonicalRscStatus = staffRsc.status();
    if (staffRscMode === 'CANONICAL_DOCUMENT_307') {
      const canonicalRscUrl = new URL(staffRscLocation!, web);
      expect(canonicalRscUrl.origin).toBe(web);
      expect(canonicalRscUrl.pathname).toBe('/today');
      expect(canonicalRscUrl.hash).toBe('');
      expect(canonicalRscUrl.searchParams.get('period')).toBe('week');
      expect(canonicalRscUrl.searchParams.get('_rsc')).toBe('');
      expect([...canonicalRscUrl.searchParams.keys()].sort()).toEqual(['_rsc', 'period']);

      const canonicalStaffRsc = await staffCookieWeb.get(canonicalRscUrl.href, {
        maxRedirects: 0,
        headers: { RSC: '1' },
      });
      staffCanonicalRscStatus = canonicalStaffRsc.status();
      expect(staffCanonicalRscStatus).toBe(200);
      assertNoProtectedFixture(await canonicalStaffRsc.text());
    }

    expect(me.status()).toBe(200);
    const identity = JSON.parse(meBody) as {
      user?: { id?: unknown; organizationId?: unknown; role?: unknown };
      context?: { businessId?: unknown; locationId?: unknown };
    };
    expect(identity.user).toMatchObject({
      id: staff.user,
      organizationId: staff.org,
      role: 'STAFF',
    });
    expect(identity.context).toMatchObject({
      businessId: staff.business,
      locationId: staff.location,
    });

    expect(branches.status()).toBe(200);
    const branchList = JSON.parse(branchesBody) as {
      organization?: { id?: unknown };
      items?: Array<{
        id?: unknown;
        locationId?: unknown;
        location?: { businessId?: unknown };
      }>;
    };
    expect(branchList.organization?.id).toBe(staff.org);
    expect(branchList.items).toEqual([
      expect.objectContaining({
        id: staff.property,
        locationId: staff.location,
        location: { businessId: staff.business },
      }),
    ]);
    expect(members.status()).toBe(403);
    expect(forbidden.status()).toBe(403);

    expect(oldMe.status()).toBe(401);
    expect(oldBranches.status()).toBe(401);
    expect(oldSessions.status()).toBe(401);
    expect(oldMembers.status()).toBe(401);

    record(testInfo, {
      baselineVisibleOwnerMarkerCount: baseline.visibleBody.occurrenceCount,
      baselineBootstrapOwnerMarkerCount: baseline.bootstrapScripts.occurrenceCount,
      afterQueryVisibleOwnerMarkerCount: afterQuery.visibleBody.occurrenceCount,
      afterQueryBootstrapOwnerMarkerCount: afterQuery.bootstrapScripts.occurrenceCount,
      actualQueryOnlyLink: true,
      actualQueryLinkTarget: `${linkUrl.pathname}${linkUrl.search}`,
      browserQueryRequestCount: queryRequests.length,
      browserQueryRscRequestCount: queryRequests.filter((request) => request.headers().rsc === '1')
        .length,
      browserQueryPrefetchRequestCount: queryRequests.filter(
        (request) => request.headers()['next-router-prefetch'] === '1',
      ).length,
      browserQueryResponseCount: queryResponses.length,
      browserQueryFirstResponseStatus: queryResponses[0]?.status() ?? 0,
      browserQueryRscObserved: Boolean(queryRsc),
      browserQueryRscStatus: queryRsc?.status() ?? 0,
      browserQueryRscCacheHeader: queryRsc?.headers()['x-nextjs-cache'] ?? 'absent',
      browserQueryRscContentType: queryRsc?.headers()['content-type'] ?? 'absent',
      browserQueryRscRedirectHeaderPresent: Boolean(
        queryRsc?.headers()['x-nextjs-redirect'] ?? queryRsc?.headers().location,
      ),
      browserQueryRscOwnerMarkersAbsent:
        queryRscCaptureResult.state === 'AVAILABLE' ? true : queryRscCaptureResult.state,
      browserNavigationUsedNoNetworkRequest: queryRequests.length === 0,
      freshStaffHttpRscStatus: staffRsc.status(),
      freshStaffHttpRscMode: staffRscMode,
      freshStaffHttpRscCanonicalTarget:
        staffRscMode === 'CANONICAL_DOCUMENT_307' ? '/today?period=week&_rsc' : 'DIRECT_RSC',
      freshStaffCanonicalRscStatus: staffCanonicalRscStatus,
      freshStaffHttpRscExactQuery: true,
      freshStaffHttpRscCacheHeader: staffRsc.headers()['x-nextjs-cache'] ?? 'absent',
      freshStaffHttpRscContentType: staffRsc.headers()['content-type'] ?? 'absent',
      freshStaffHttpRscOwnerMarkersAbsent: true,
      currentStaffMeStatus: me.status(),
      currentStaffBranchesStatus: branches.status(),
      currentStaffMembersStatus: members.status(),
      currentStaffOwnerPatchStatus: forbidden.status(),
      currentStaffTenantExact: true,
      oldOwnerMeStatus: oldMe.status(),
      oldOwnerMeProtectedMarkersAbsent: true,
      oldOwnerBranchesStatus: oldBranches.status(),
      oldOwnerSessionsStatus: oldSessions.status(),
      oldOwnerMembersStatus: oldMembers.status(),
      historicalClientMarkersClassifiedSeparately: true,
      destination: ownerTab.url(),
    });
  } finally {
    await staffCookieWeb.dispose();
    await staffApi.dispose();
    await oldOwnerApi.dispose();
  }
});

test('logout denies reload history existing tab new tab and old API session', async ({
  page,
  context,
}, testInfo) => {
  await loginThroughSite(page, '/profile/access');
  await openAccess(page);
  const oldSession = await sessionCookie(context);
  const alreadyOpenNavigation = await context.newPage();
  await openAccess(alreadyOpenNavigation);
  const alreadyOpenReload = await context.newPage();
  await openAccess(alreadyOpenReload);

  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(canonicalLogin('/today'));
  expect((await context.cookies()).some((cookie) => cookie.name === 'wetop_session')).toBe(false);

  await page.goto(`${web}/today`);
  await expect(page).toHaveURL(canonicalLogin('/today'));
  await page.reload();
  await expect(page).toHaveURL(canonicalLogin('/today'));
  await page.goBack();
  await expect(page).toHaveURL(canonicalLogin('/today'));
  let historyForwardFailure: unknown = null;
  try {
    await page.goForward();
  } catch (error) {
    historyForwardFailure = error;
  }
  await expect(page).toHaveURL(canonicalLogin('/today'));
  const loginDialog = page.getByRole('dialog', { name: 'Вход и регистрация в WETOP' });
  await expect(loginDialog).toBeVisible();
  assertNoProtectedFixture(await page.content(), await page.locator('body').innerText());
  if (historyForwardFailure !== null) {
    if (
      !(historyForwardFailure instanceof Error) ||
      !/^page\.goForward: net::ERR_ABORTED(?:;|$)/.test(historyForwardFailure.message)
    )
      throw historyForwardFailure;
  }

  await alreadyOpenNavigation
    .getByRole('link', { name: 'Открыть рабочее место', exact: true })
    .click();
  await expect(alreadyOpenNavigation).toHaveURL(canonicalLogin('/today'));
  assertNoProtectedFixture(
    await alreadyOpenNavigation.content(),
    await alreadyOpenNavigation.locator('body').innerText(),
  );

  await alreadyOpenReload.reload();
  await expect(alreadyOpenReload).toHaveURL(canonicalLogin('/profile/access'));
  assertNoProtectedFixture(
    await alreadyOpenReload.content(),
    await alreadyOpenReload.locator('body').innerText(),
  );

  const newTab = await context.newPage();
  await newTab.goto(`${web}/today`);
  await expect(newTab).toHaveURL(canonicalLogin('/today'));
  assertNoProtectedFixture(await newTab.content(), await newTab.locator('body').innerText());

  const anonymous = await playwrightRequest.newContext({ baseURL: api });
  const old = await playwrightRequest.newContext({
    baseURL: api,
    extraHTTPHeaders: { authorization: `Bearer ${oldSession.value}` },
  });
  try {
    const [anonymousResponse, oldResponse] = await Promise.all([
      anonymous.get('/auth/sessions'),
      old.get('/auth/sessions'),
    ]);
    expect(anonymousResponse.status()).toBe(401);
    expect(oldResponse.status()).toBe(401);
    assertNoProtectedFixture(await anonymousResponse.text(), await oldResponse.text());
    record(testInfo, {
      uiLogout: true,
      todayDenied: true,
      reloadDenied: true,
      historyDenied: true,
      historyForwardDenied: true,
      historyForwardAttempted: true,
      historyForwardActualError:
        historyForwardFailure instanceof Error ? historyForwardFailure.message : 'NONE',
      protectedClientNavigationDenied: true,
      alreadyOpenTabDenied: true,
      newTabDenied: true,
      anonymousApiStatus: anonymousResponse.status(),
      oldSessionApiStatus: oldResponse.status(),
      destination: page.url(),
    });
  } finally {
    await anonymous.dispose();
    await old.dispose();
  }
});

test('owner can open and reload protected routes through the real branch and navbar', async ({
  page,
  context,
}, testInfo) => {
  await loginThroughSite(page, '/branches');
  await selectOwnerKztBranch(page, context);

  for (const [route, heading] of [
    ['/today', 'Главная'],
    ['/chessboard', 'Календарь'],
    ['/reservations', 'Брони'],
  ] as const) {
    await page.goto(`${web}${route}`);
    await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}(?:[?#]|$)`));
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }

  await page.goto(`${web}/today?period=week&a27Return=owner-positive`);
  const sameIdentityScope = await selectedScope(context);
  const sameIdentitySentinel = 'a27-same-identity-document';
  const sameIdentityQuery = new URL(page.url()).search;
  await page.evaluate(
    ({ sentinel, query }) => {
      (
        window as unknown as {
          __a27SameIdentityDocument: string;
          __a27SameIdentityReturnQuery: string;
        }
      ).__a27SameIdentityDocument = sentinel;
      (
        window as unknown as {
          __a27SameIdentityDocument: string;
          __a27SameIdentityReturnQuery: string;
        }
      ).__a27SameIdentityReturnQuery = query;
      document.documentElement.dataset.a27SameIdentityDocument = sentinel;
    },
    { sentinel: sameIdentitySentinel, query: sameIdentityQuery },
  );
  const topMenu = page.locator('nav.topmenu');
  await topMenu.getByRole('link', { name: 'Календарь', exact: true }).click();
  await expect(page).toHaveURL(/\/chessboard(?:[?#]|$)/);
  await expect(page.getByRole('heading', { name: 'Календарь', exact: true })).toBeVisible();
  const sameIdentityDocument = await page.evaluate((sentinel) => {
    const values = window as unknown as {
      __a27SameIdentityDocument?: string;
      __a27SameIdentityReturnQuery?: string;
    };
    return {
      windowSentinelPreserved: values.__a27SameIdentityDocument === sentinel,
      documentSentinelPreserved:
        document.documentElement.dataset.a27SameIdentityDocument === sentinel,
      returnQuery: values.__a27SameIdentityReturnQuery ?? null,
    };
  }, sameIdentitySentinel);
  expect(sameIdentityDocument).toEqual({
    windowSentinelPreserved: true,
    documentSentinelPreserved: true,
    returnQuery: sameIdentityQuery,
  });
  expect(await selectedScope(context)).toBe(sameIdentityScope);
  await topMenu.getByRole('link', { name: 'Брони', exact: true }).click();
  await expect(page).toHaveURL(/\/reservations(?:[?#]|$)/);
  await expect(page.getByRole('heading', { name: 'Брони', exact: true })).toBeVisible();

  record(testInfo, {
    selectedBranchThroughUi: true,
    directToday: true,
    directChessboard: true,
    directReservations: true,
    allReloaded: true,
    navbarCalendar: true,
    navbarReservations: true,
    sameIdentityDocumentPreserved: true,
    sameIdentityReturnQueryPreserved: true,
    sameIdentityScopePreserved: true,
    destination: page.url(),
  });
});

test('same browser switches from owner scope to fresh STAFF without restoring owner data', async ({
  page,
  context,
}, testInfo) => {
  expect(staff.newBeforeSetup).toBe(true);
  await loginThroughSite(page, '/branches');
  const ownerScope = await selectOwnerKztBranch(page, context);
  await openAccess(page);
  expect(await page.locator('body').innerText()).toContain('A26 synthetic owner');

  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(canonicalLogin('/today'));
  expect((await context.cookies()).some((cookie) => cookie.name === 'wetop_scope')).toBe(false);

  await loginFixtureThroughSite(page, staff, '/profile/access');
  await openAccess(page);
  const cookie = await sessionCookie(context);
  const staffScope = await selectedScope(context);
  expect(staffScope).toBe(`business=${staff.business};location=${staff.location}`);
  expect(staffScope).not.toBe(ownerScope);
  const body = await page.locator('body').innerText();
  assertNoProtectedFixture(await page.content(), body);
  expect(body).not.toContain('A26 synthetic');

  const rsc = await context.request.get(`${web}/profile/access?_rsc=a27-staff`, {
    headers: { RSC: '1' },
  });
  assertNoProtectedFixture(await rsc.text());

  const staffApi = await playwrightRequest.newContext({
    baseURL: api,
    extraHTTPHeaders: {
      authorization: `Bearer ${cookie.value}`,
      'x-wetop-scope': staffScope,
    },
  });
  try {
    const me = await staffApi.get('/auth/me');
    const allowed = await staffApi.get('/auth/sessions');
    const forbidden = await staffApi.patch(`/auth/members/${staff.user}`, {
      data: { role: 'manager' },
    });
    expect(me.status()).toBe(200);
    const identity = (await me.json()) as {
      user?: { id?: unknown; organizationId?: unknown; role?: unknown };
      context?: { businessId?: unknown; locationId?: unknown };
    };
    expect(identity.user).toMatchObject({
      id: staff.user,
      organizationId: staff.org,
      role: 'STAFF',
    });
    expect(identity.context).toMatchObject({
      businessId: staff.business,
      locationId: staff.location,
    });
    expect(allowed.status()).toBe(200);
    expect(forbidden.status()).toBe(403);
    record(testInfo, {
      independentUserAndScopeWereNew: true,
      syntheticAccommodationTypes: 1,
      syntheticInventoryUnits: 1,
      sameBrowserContext: true,
      ownerScopeClearedOnLogout: true,
      staffScopeReplacedOwnerScope: true,
      authMeStatus: me.status(),
      protectedBrowserAccess: true,
      staffApiStatus: allowed.status(),
      ownerOnlyPatchStatus: forbidden.status(),
      priorOrganizationMarkersAbsent: true,
      staffRscStatus: rsc.status(),
      destination: page.url(),
    });
  } finally {
    await staffApi.dispose();
  }
});

test('mounted owner tab refreshes identity and permissions on client navigation after account switch', async ({
  page: ownerTab,
  context,
}, testInfo) => {
  await loginThroughSite(ownerTab, '/branches');
  await selectOwnerKztBranch(ownerTab, context);
  await openAccess(ownerTab);
  await ownerTab.getByRole('button', { name: 'Меню администратора' }).click();
  const ownerIdentity = await ownerTab.locator('.profile-dropdown').innerText();
  expect(ownerIdentity.includes('A26 synthetic owner')).toBe(true);
  expect(ownerIdentity.includes(privateData.email)).toBe(true);
  const initialOwnerMarkers = await pageMarkerClassification(ownerTab);

  const ownerTeamTab = await context.newPage();
  await openAccess(ownerTeamTab);
  await expect(ownerTeamTab.getByTestId('team-link')).toBeVisible();

  const switchTab = await context.newPage();
  await openAccess(switchTab);
  await switchTab.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(switchTab).toHaveURL(canonicalLogin('/today'));
  await loginFixtureThroughSite(switchTab, staff, '/profile/access');
  await openAccess(switchTab);
  const mountedStaffScope = await selectedScope(context);
  expect(mountedStaffScope).toBe(`business=${staff.business};location=${staff.location}`);

  const stillMountedIdentity = await ownerTab.locator('.profile-dropdown').innerText();
  expect(stillMountedIdentity.includes('A26 synthetic owner')).toBe(true);
  expect(stillMountedIdentity.includes(privateData.email)).toBe(true);

  const transitionSignals: IdentityObservation = {
    pathChanged: false,
    beforeUnload: false,
    newDocument: false,
    visibleOldIdentityAfterPath: false,
    visibleOwnerOnlyUiAfterPath: false,
    visibleStaffIdentityAfterPath: false,
  };
  await ownerTab.exposeBinding(
    'a27IdentityEvent',
    (_source, event: Partial<IdentityObservation>) => {
      for (const key of Object.keys(transitionSignals) as Array<keyof IdentityObservation>) {
        if (event[key] === true) transitionSignals[key] = true;
      }
    },
  );
  const observerInput = {
    startPath: '/profile/access',
    ownerName: 'A26 synthetic owner',
    ownerEmail: privateData.email,
    staffName: 'A27 isolated staff user',
    staffEmail: staff.email,
  };
  await ownerTab.addInitScript(identityObserver, observerInput);
  await ownerTab.evaluate(identityObserver, observerInput);

  await ownerTab
    .locator('nav.topmenu')
    .getByRole('link', { name: 'Календарь', exact: true })
    .click();
  await expect(ownerTab).toHaveURL(/\/chessboard(?:[?#]|$)/);
  await expect(ownerTab.getByRole('heading', { name: 'Календарь', exact: true })).toBeVisible();
  await ownerTab.getByRole('button', { name: 'Меню администратора' }).click();
  const staffIdentity = await ownerTab.locator('.profile-dropdown').innerText();
  expect(staffIdentity.includes('A26 synthetic owner')).toBe(false);
  expect(staffIdentity.includes(privateData.email)).toBe(false);
  expect(staffIdentity.includes('A27 isolated staff user')).toBe(true);
  expect(staffIdentity.includes(staff.email)).toBe(true);
  const postNavigationHtml = await ownerTab.content();
  const postNavigationBody = await ownerTab.locator('body').innerText();
  const postNavigationMarkers = await pageMarkerClassification(ownerTab);
  const [classificationDocument, classificationRsc] = await Promise.all([
    context.request.get(`${web}/chessboard`),
    context.request.get(`${web}/chessboard?_rsc=a27-marker-classification`, {
      headers: { RSC: '1' },
    }),
  ]);
  const classificationDocumentBody = await classificationDocument.text();
  const classificationRscBody = await classificationRsc.text();
  mkdirSync(evidence, { recursive: true });
  writeFileSync(
    `${evidence}/mounted-owner-marker-classification.json`,
    JSON.stringify(
      {
        phase: process.env.A27_PHASE ?? 'unspecified',
        initialOwnerPage: initialOwnerMarkers,
        postNavigationPage: postNavigationMarkers,
        strictHtml: markerSummary(postNavigationHtml),
        strictVisibleBody: markerSummary(postNavigationBody),
        freshHttpDocument: {
          status: classificationDocument.status(),
          ...markerSummary(classificationDocumentBody),
        },
        freshRsc: {
          status: classificationRsc.status(),
          ...markerSummary(classificationRscBody),
        },
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  assertNoProtectedFixture(postNavigationHtml, postNavigationBody);
  await expect.poll(() => transitionSignals.visibleStaffIdentityAfterPath).toBe(true);
  const visibleTransition = {
    pathChanged: transitionSignals.pathChanged,
    visibleOldIdentityAfterPath: transitionSignals.visibleOldIdentityAfterPath,
    visibleOwnerOnlyUiAfterPath: transitionSignals.visibleOwnerOnlyUiAfterPath,
    visibleStaffIdentityAfterPath: transitionSignals.visibleStaffIdentityAfterPath,
  };
  expect(visibleTransition).toEqual({
    pathChanged: true,
    visibleOldIdentityAfterPath: false,
    visibleOwnerOnlyUiAfterPath: false,
    visibleStaffIdentityAfterPath: true,
  });

  const mountedStaffSession = await sessionCookie(context);
  const [me, document, rsc] = await Promise.all([
    context.request.get(`${api}/auth/me`, {
      headers: {
        authorization: `Bearer ${mountedStaffSession.value}`,
        'x-wetop-scope': mountedStaffScope,
      },
    }),
    context.request.get(`${web}/chessboard`),
    context.request.get(`${web}/chessboard?_rsc=a27-mounted-owner`, {
      headers: { RSC: '1' },
    }),
  ]);
  expect(me.status()).toBe(200);
  const identity = (await me.json()) as {
    user?: { id?: unknown; organizationId?: unknown; role?: unknown };
    context?: { businessId?: unknown; locationId?: unknown };
  };
  expect(
    identity.user?.id === staff.user &&
      identity.user?.organizationId === staff.org &&
      identity.user?.role === 'STAFF' &&
      identity.context?.businessId === staff.business &&
      identity.context?.locationId === staff.location,
  ).toBe(true);
  assertNoProtectedFixture(await document.text(), await rsc.text());

  await ownerTeamTab.getByTestId('team-link').click();
  await expect(ownerTeamTab).toHaveURL(/\/team(?:[?#]|$)/);
  await expect(ownerTeamTab.getByTestId('no-access')).toBeVisible();
  await expect(
    ownerTeamTab.getByRole('heading', { name: 'Сотрудники', exact: true }),
  ).toBeVisible();
  const deniedBody = await ownerTeamTab.locator('body').innerText();
  expect(deniedBody.includes('Нет доступа')).toBe(true);
  expect(deniedBody.includes('A26 synthetic owner')).toBe(false);
  expect(deniedBody.includes(privateData.email)).toBe(false);
  assertNoProtectedFixture(await ownerTeamTab.content(), deniedBody);

  record(testInfo, {
    ownerIdentityInitiallyVisible: true,
    ownerLayoutStayedMountedUntilTransition: true,
    navigationStartedByActualLink: true,
    beforeUnloadObserved: transitionSignals.beforeUnload,
    newDocumentObserved: transitionSignals.newDocument,
    noVisibleStaleOwnerIdentityAfterPathChange: true,
    noVisibleOwnerOnlyUiAfterPathChange: true,
    visibleIdentityUpdatedToStaff: true,
    authMeStatus: me.status(),
    documentStatus: document.status(),
    rscStatus: rsc.status(),
    ownerMarkersAbsentAfterTransition: true,
    teamClientNavigationDeniedForStaff: true,
    destination: ownerTeamTab.url(),
  });
});

test('public login rejects an external return target', async ({ page }, testInfo) => {
  const external = 'https://outside.invalid/private';
  await page.goto(`${site}/?next=${encodeURIComponent(external)}#login`);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill(privateData.email);
  await dialog.getByLabel('Пароль', { exact: true }).fill(privateData.password);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/site-auth/login') && response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const result = (await response.json()) as { next?: unknown };
  expect(result.next).toBe('/scope/resolve?next=%2Ftoday');
  await expect(page).toHaveURL(new RegExp(`^${web.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`));
  expect(new URL(page.url()).hostname).toBe(new URL(site).hostname);
  record(testInfo, {
    loginStatus: response.status(),
    safeDefaultSelected: true,
    finalUrl: page.url(),
  });
});

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`real ${theme} login and logout remains focused and readable at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((selected) => {
        localStorage.setItem('wetop.theme', selected);
      }, theme);
      await page.goto(canonicalLogin('/profile/access'));
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const email = dialog.getByLabel('Почта');
      await expect(email).toBeFocused();
      const bounds = await dialog.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      const colors = await email.evaluate((element) => {
        const style = getComputedStyle(element);
        return { foreground: style.color, background: style.backgroundColor };
      });
      expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
      const publicTheme = await page.locator('html').evaluate((element) => ({
        explicitTheme: element.getAttribute('data-theme'),
        colorScheme: getComputedStyle(element).colorScheme,
      }));
      expect(publicTheme.explicitTheme).toBeNull();
      expect(publicTheme.colorScheme).toContain(theme);

      await email.fill(privateData.email);
      await dialog.getByLabel('Пароль', { exact: true }).fill(privateData.password);
      await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`^${web.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`));
      await openAccess(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.getByRole('button', { name: 'Выйти', exact: true }).click();
      await expect(page).toHaveURL(canonicalLogin('/today'));
      record(testInfo, {
        width,
        theme,
        emailFocused: true,
        contrastPass: true,
        publicFixedBrandUsesSystemColorScheme: true,
        publicColorScheme: theme,
        workspaceExplicitTheme: theme,
        loginViaPublicSite: true,
        logoutViaOrdinaryUi: true,
        destination: page.url(),
      });
    });
  }
}
