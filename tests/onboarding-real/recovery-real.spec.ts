import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const api = 'http://127.0.0.1:55844';
const desk = 'http://127.0.0.1:55843';
async function headers(page: Page) {
  const cookies = await page.context().cookies(desk);
  const session = cookies.find(c => c.name === 'wetop_session')?.value;
  const scope = cookies.find(c => c.name === 'wetop_scope')?.value;
  if (!session || !scope) throw new Error('Synthetic authenticated context missing');
  return { 'x-wetop-session': session, 'x-wetop-scope': decodeURIComponent(scope) };
}
async function register(page: Page, vertical = 'FOOD_SERVICE', identity = { name: 'Тестовый Владелец', businessName: 'Бизнес Восстановления' }) {
  const email = `onboarding-recovery-${randomUUID()}@example.invalid`;
  const registeredIdentity = { ...identity, businessName: vertical === 'HOSPITALITY' ? `${identity.businessName} ${randomUUID()}` : identity.businessName };
  const response = await page.request.post(`${api}/auth/register`, { data: {
    email, ...registeredIdentity, vertical,
    password: 'Onboarding-Test-2026!a', phoneCountry: 'KZ', phone: '7000000000', privacyAccepted: true,
  } });
  expect(response.ok(), `registration HTTP ${response.status()}`).toBe(true);
  const mail = await (await page.request.get(`${api}/__onboarding-test/mail?email=${encodeURIComponent(email)}`)).json();
  expect(mail.link).toBeTruthy();
  await page.goto(mail.link);
  await page.waitForURL(/55843\/(?:register\/setup|today|onboarding)/);
  await page.goto('/register/setup');
  // Wait for the mount read before arming faults or opening a stale second form.
  await expect.poll(async () => (await page.request.get(`${desk}/register/setup/progress`)).status()).toBe(200);
  await expect(page.getByRole('main').getByLabel(vertical === 'HOSPITALITY' ? 'Название категории' : 'Название бизнеса', { exact: true })).toBeVisible();
  return { email, ...registeredIdentity };
}
async function control(page: Page, mode: string) {
  expect((await page.request.post(`${api}/__onboarding-test/recovery`, { headers: await headers(page), data: { mode } })).ok()).toBe(true);
}
async function state(page: Page) {
  const reply = await page.request.get(`${api}/onboarding`, { headers: await headers(page) });
  expect(reply.status()).toBe(200);
  return reply.json();
}
async function snapshot(page: Page) {
  const reply = await page.request.get(`${api}/__onboarding-test/recovery-snapshot`, { headers: await headers(page) });
  expect(reply.status()).toBe(200);
  return reply.json();
}
test('U07 real authenticated API uses non-owning restricted tenant role', async ({ page }) => {
  await register(page);
  const reply = await page.request.get(`${api}/__onboarding-test/runtime-role`, { headers: await headers(page) });
  expect(reply.status()).toBe(200);
  expect(await reply.json()).toEqual([{ role: 'wetop_app', rolsuper: false, rolbypassrls: false, owned: 0 }]);
});
const button = (page: Page, name: string) => page.getByRole('main').getByRole('button', { name, exact: true });
const saved = (page: Page) => expect(page.getByRole('main').getByRole('status').filter({ hasText: /^Сохранено$/ })).toBeVisible();
for (const vertical of ['FOOD_SERVICE', 'HOSPITALITY']) {
  test(`U07 real ${vertical}: outage retains draft and retry persists`, async ({ page }) => {
    await register(page, vertical);
    const field = page.getByRole('main').getByLabel(vertical === 'HOSPITALITY' ? 'Название категории' : 'Название бизнеса', { exact: true });
    const name = `QA outage ${vertical}`;
    await field.fill(name);
    const before = await snapshot(page);
    await control(page, 'before503');
    await button(page, 'Сохранить').click();
    await expect(button(page, 'Повторить')).toBeVisible();
    await expect(field).toHaveValue(name);
    expect(await snapshot(page)).toEqual(before);
    await control(page, 'reset');
    await button(page, 'Повторить').click();
    await saved(page);
    const persisted = await state(page);
    expect(vertical === 'HOSPITALITY' ? persisted.draft.rows[0].name : persisted.draft.businessName).toBe(name);
    expect((await snapshot(page)).progress).toHaveLength(1);
    await page.reload();
    await expect(field).toHaveValue(name);
    expect((await state(page)).updatedAt).toBe(persisted.updatedAt);
  });
  test(`U07 real ${vertical}: postcommit lost acknowledgement is read back without duplicate version`, async ({ page }) => {
    await register(page, vertical);
    await page.getByRole('main').getByLabel(vertical === 'HOSPITALITY' ? 'Название категории' : 'Название бизнеса', { exact: true }).fill('QA lost committed response');
    const before = await state(page);
    await control(page, 'dropafter');
    await button(page, vertical === 'FOOD_SERVICE' ? 'Продолжить' : 'Сохранить').click();
    await expect(button(page, 'Повторить')).toBeVisible();
    const committed = await state(page);
    expect(committed.updatedAt).not.toBe(before.updatedAt);
    expect(committed.currentStep).toBe(vertical === 'FOOD_SERVICE' ? 'location' : before.currentStep);
    await button(page, 'Повторить').click();
    await saved(page);
    expect(await state(page)).toEqual(committed);
    expect((await snapshot(page)).progress).toHaveLength(1);
    await page.reload();
    expect(await state(page)).toEqual(committed);
    if (vertical === 'FOOD_SERVICE') await expect(page.getByRole('main').getByLabel('Название филиала', { exact: true })).toBeVisible();
    else await expect(page.getByRole('main').getByLabel('Название категории', { exact: true })).toHaveValue('QA lost committed response');
  });
}
test('U07 real two-page 409 preserves local input until explicit saved load', async ({ page, context }) => {
  await register(page);
  const other = await context.newPage();
  try {
    await other.goto('/register/setup');
    await other.getByRole('main').getByLabel('Название бизнеса', { exact: true }).fill('QA other window');
    await button(other, 'Сохранить').click();
    await saved(other);
    const committed = await state(other);
    await page.getByRole('main').getByLabel('Название бизнеса', { exact: true }).fill('QA local unsaved');
    const reply = page.waitForResponse(r => r.url().endsWith('/register/setup/progress') && r.request().method() === 'POST');
    await button(page, 'Сохранить').click();
    expect((await reply).status()).toBe(409);
    await expect(page.getByRole('main').getByLabel('Название бизнеса', { exact: true })).toHaveValue('QA local unsaved');
    expect(await state(page)).toEqual(committed);
    await button(page, 'Загрузить сохранённую версию').click();
    await expect(page.getByRole('main').getByLabel('Название бизнеса', { exact: true })).toHaveValue('QA other window');
    expect(await state(page)).toEqual(committed);
  } finally { await other.close(); }
});
for (const mode of ['expire', 'STAFF', 'READ_ONLY']) {
  test(`U07 real ${mode}: guarded denial leaves persisted draft unchanged`, async ({ page }) => {
    await register(page);
    await page.getByRole('main').getByLabel('Название бизнеса', { exact: true }).fill('QA denied draft');
    const before = await snapshot(page);
    const originalHeaders = await headers(page);
    await control(page, mode);
    // Capture the actual denial before forwarding it: navigation can evict CDP response bodies.
    let captureExpired!: (reply: { status: number; body: string; cacheControl: string | undefined }) => void;
    const expiredReply = mode === 'expire'
      ? new Promise<{ status: number; body: string; cacheControl: string | undefined }>(resolve => { captureExpired = resolve; })
      : undefined;
    if (mode === 'expire') {
      await page.route('**/register/setup/progress', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        const actualResponse = await route.fetch({ maxRedirects: 0 });
        const body = await actualResponse.text();
        captureExpired({ status: actualResponse.status(), body, cacheControl: actualResponse.headers()['cache-control'] });
        await route.fulfill({ response: actualResponse });
      });
    }
    const reply = page.waitForResponse(r => r.url().endsWith('/register/setup/progress') && r.request().method() === 'POST');
    await button(page, 'Сохранить').click();
    const rejected = await reply;
    expect(rejected.status()).toBe(mode === 'expire' ? 401 : 403);
    if (mode === 'expire') {
      const captured = await expiredReply!;
      expect(captured.status).toBe(401);
      expect(captured.cacheControl).toContain('no-store');
      const body = JSON.parse(captured.body);
      const url = new URL(body.loginUrl);
      expect(url.origin).toBe('http://127.0.0.1:55845');
      expect(url.hash).toBe('#login');
      await expect(page).toHaveURL(/55845\/.*#login/);
    } else {
      await expect(page).toHaveURL(/55843\/register\/setup$/);
      await expect(page.getByRole('main').getByRole('alert')).toContainText('Недостаточно прав');
      await expect(page.getByRole('main').getByLabel('Название бизнеса', { exact: true })).toHaveValue('QA denied draft');
      expect((await page.request.get(`${api}/auth/me`, { headers: originalHeaders })).status()).toBe(200);
    }
    // Retained explicit session headers permit an owner-fixture snapshot even after site redirect.
    const after = await page.request.get(`${api}/__onboarding-test/recovery-snapshot`, { headers: originalHeaders });
    expect(after.status()).toBe(200);
    expect(await after.json()).toEqual(before);
  });
}
test('U07 real foreign business and location pointers never expose or adopt another organization', async ({ page, browser }) => {
  await register(page);
  const own = await state(page);
  const foreignContext = await browser.newContext({ baseURL: desk });
  try {
    const other = await foreignContext.newPage();
    const foreignIdentity = await register(other, 'FOOD_SERVICE', { name: 'QA Foreign Owner Sentinel', businessName: 'QA Foreign Business Sentinel' });
    const draftSentinel = 'QA foreign persisted draft sentinel';
    await other.getByRole('main').getByLabel('Название бизнеса', { exact: true }).fill(draftSentinel);
    await button(other, 'Сохранить').click();
    await saved(other);
    const foreign = await state(other);
    expect(foreign.draft.businessName).toBe(draftSentinel);
    const ownBefore = await snapshot(page);
    const foreignBefore = await snapshot(other);
    const h = await headers(page);
    for (const scope of [`business=${foreign.businessId};location=${foreign.locationId}`, `business=${own.businessId};location=${foreign.locationId}`]) {
      for (const method of ['GET', 'POST']) {
        const response = await page.request.fetch(`${api}/onboarding`, {
          method, headers: { ...h, 'x-wetop-scope': scope },
          ...(method === 'POST' ? { data: { action: 'save', updatedAt: foreign.updatedAt, draft: { ...foreign.draft, businessName: 'QA forbidden mutation sentinel' } } } : {}),
        });
        expect(response.status()).toBe(403);
        const body = await response.json();
        expect(Object.keys(body).sort()).toEqual(['error', 'message', 'statusCode']);
        expect(body.statusCode).toBe(403);
        expect(body.error).toBe('Forbidden');
        expect(typeof body.message).toBe('string');
        expect(body.message.length).toBeLessThan(200);
        const denial = JSON.stringify(body);
        for (const sentinel of [foreign.businessId, foreign.locationId, foreignIdentity.email, foreignIdentity.name, foreignIdentity.businessName, draftSentinel, 'QA forbidden mutation sentinel']) {
          expect(denial).not.toContain(sentinel);
        }
        expect(await snapshot(page)).toEqual(ownBefore);
        expect(await snapshot(other)).toEqual(foreignBefore);
      }
    }
    expect(await state(page)).toEqual(own);
    await page.reload();
    expect(await headers(page)).toEqual(h);
    expect(await state(page)).toEqual(own);
    expect(await state(other)).toEqual(foreign);
    expect(await snapshot(page)).toEqual(ownBefore);
    expect(await snapshot(other)).toEqual(foreignBefore);
    await expect(page.getByRole('main').getByLabel('Название бизнеса', { exact: true })).toHaveValue(own.draft.businessName);
  } finally { await foreignContext.close(); }
});
