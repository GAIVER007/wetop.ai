import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
const qa = 'http://127.0.0.1:55825';
async function fixture(request: APIRequestContext, vertical = 'BEAUTY') {
  return (await request.post(`${qa}/__qa/reset`, { data: { vertical } })).json();
}
async function login(page: Page, f: { email: string; password: string }) {
  await page.goto('/auth/fallback');
  await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => ['/register/complete', '/onboarding'].includes(url.pathname));
  if (new URL(page.url()).pathname === '/onboarding') await page.goto('/register/complete');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Настройте/);
}
async function snapshot(request: APIRequestContext) {
  return (await request.get(`${qa}/__qa/snapshot`)).json();
}
async function apiSession(
  request: APIRequestContext,
  f: { email: string; password: string; businessId: string; locationId: string },
) {
  const response = await request.post(`${qa}/auth/login`, {
    data: { email: f.email, password: f.password },
  });
  expect(response.ok()).toBe(true);
  const { token } = await response.json();
  return {
    'x-wetop-session': token,
    'x-wetop-scope': `business=${f.businessId};location=${f.locationId}`,
  };
}
test.afterAll(async ({ request }) =>
  expect((await request.post(`${qa}/__qa/cleanup`)).ok()).toBe(true),
);
test('U01 first launch uses verified vertical and creates no draft on read', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  const before = await snapshot(request);
  await login(page, f);
  await page.goto('/register/setup?vertical=HOSPITALITY');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройте Beauty');
  expect(await snapshot(request)).toEqual(before);
});
test('U02 save/reload restores version, step and draft', async ({ page, request }) => {
  const f = await fixture(request);
  await login(page, f);
  await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-U02');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('main').getByLabel('Название филиала')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('main').getByLabel('Название филиала')).toBeVisible();
  const s = await snapshot(request);
  expect(s.progress).toHaveLength(1);
  expect(s.progress[0]).toMatchObject({
    flowVersion: 1,
    currentStep: 'location',
    draft: { businessName: 'QA-U02' },
  });
});
test('U03 close/reopen and real re-login preserve saved progress', async ({
  page,
  context,
  request,
}) => {
  const f = await fixture(request);
  await login(page, f);
  await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-U03');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Сохранено');
  const reopened = await context.newPage();
  await page.close();
  await reopened.goto('/register/setup');
  await expect(reopened.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U03');
  await request.post(`${qa}/__qa/access`, { data: { revoke: true } });
  await login(reopened, f);
  await expect(reopened.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U03');
  await reopened.close();
});
test('U04 commit with lost response, repeat and reload produce one progress', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  await login(page, f);
  await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-U04');
  await request.post(`${qa}/__qa/fault`, { data: { mode: 'after' } });
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeVisible();
  const committed = await snapshot(request);
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Сохранено');
  await page.reload();
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U04');
  expect(await snapshot(request)).toEqual(committed);
});
test('U05 unsaved/saved back and forward are explicit', async ({ page, request }) => {
  const f = await fixture(request);
  await login(page, f);
  await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-unsaved');
  await expect(page.getByRole('status')).toHaveText('Есть несохранённые изменения');
  await page.reload();
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).not.toHaveValue('QA-unsaved');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('main').getByLabel('Название филиала').fill('QA-U05');
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('main').getByLabel('Название филиала')).toHaveValue('QA-U05');
  await expect(page.getByRole('status')).toHaveText('Сохранено');
  await page.goto('/auth/fallback');
  await page.goBack();
  await expect(page.getByRole('main').getByLabel('Название филиала')).toHaveValue('QA-U05');
  await page.goForward();
  await page.goBack();
  await expect(page.getByRole('main').getByLabel('Название филиала')).toHaveValue('QA-U05');
});
test('U06 invalid input never persists, correction proceeds', async ({ page, request }) => {
  const f = await fixture(request);
  await login(page, f);
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('main').getByLabel('Название филиала')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Сохранено');
  const before = await snapshot(request);
  await page.getByRole('main').getByLabel('Часовой пояс IANA').fill('Invalid/Zone');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  expect(await snapshot(request)).toEqual(before);
  await page.getByRole('main').getByLabel('Часовой пояс IANA').fill('Asia/Almaty');
  await page.getByRole('main').getByLabel('Название филиала').fill('');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  expect(await snapshot(request)).toEqual(before);
  await page.getByRole('main').getByLabel('Название филиала').fill('QA-valid');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Завершить настройку' })).toBeVisible();
});
test('U07 complete API disconnect preserves input and retry', async ({ page, request }) => {
  const f = await fixture(request);
  await login(page, f);
  await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-U07');
  await request.post(`${qa}/__qa/fault`, { data: { mode: 'offline' } });
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/register/setup');
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U07');
  await request.post(`${qa}/__qa/fault`, { data: { mode: 'none' } });
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Сохранено');
  await page.reload();
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U07');
});
test('U08 completion replay is denied and re-login preserves completion', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  await login(page, f);
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('button', { name: 'Завершить настройку' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройка сохранена');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройка сохранена');
  const before = await snapshot(request);
  const headers = await apiSession(request, f);
  const current = await (await request.get(`${qa}/onboarding`, { headers })).json();
  expect(
    (
      await request.post(`${qa}/onboarding`, {
        headers,
        data: { action: 'complete', draft: current.draft, updatedAt: current.updatedAt },
      })
    ).status(),
  ).toBe(409);
  expect(await snapshot(request)).toEqual(before);
  await request.post(`${qa}/__qa/access`, { data: { revoke: true } });
  await page.goto('/auth/fallback');
  await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.goto('/register/setup');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройка сохранена');
});
test('U09 existing hotel fund and rates survive reopening wizard', async ({ page, request }) => {
  const f = await fixture(request, 'HOSPITALITY');
  await login(page, f);
  await page.getByRole('main').getByLabel('Название категории').fill('QA-U09-room');
  await page
    .getByRole('main')
    .getByLabel(/Цена за ночь/)
    .fill('18000');
  await page.getByRole('main').getByLabel('Сколько мест').fill('2');
  await page.getByRole('button', { name: 'Запустить отель' }).click();
  await page.waitForURL('**/today');
  const before = await snapshot(request);
  expect(before.units).toBe(2);
  expect(before.rates).toBeGreaterThan(0);
  await page.goto('/register/setup');
  await page.waitForURL('**/today');
  await page.reload();
  expect(await snapshot(request)).toEqual(before);
});
test('U10 read-only UI and direct API forbid writes', async ({ page, request }) => {
  const f = await fixture(request);
  const headers = await apiSession(request, f);
  await request.post(`${qa}/__qa/access`, { data: { status: 'READ_ONLY' } });
  await login(page, f);
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toHaveCount(0);
  const before = await snapshot(request);
  expect(
    (
      await request.post(`${qa}/onboarding`, {
        headers,
        data: { action: 'save', draft: { businessName: 'forbidden' }, updatedAt: null },
      })
    ).status(),
  ).toBe(403);
  expect(await snapshot(request)).toEqual(before);
});
test('U11 real STAFF rejected, MANAGER saved', async ({ page, request }) => {
  const f = await fixture(request);
  const headers = await apiSession(request, f);
  await request.post(`${qa}/__qa/access`, { data: { role: 'STAFF' } });
  await login(page, f);
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toBeDisabled();
  const before = await snapshot(request);
  expect(
    (
      await request.post(`${qa}/onboarding`, {
        headers,
        data: { action: 'save', draft: {}, updatedAt: null },
      })
    ).status(),
  ).toBe(403);
  expect(await snapshot(request)).toEqual(before);
  await request.post(`${qa}/__qa/access`, { data: { role: 'MANAGER' } });
  await page.reload();
  await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-manager');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Сохранено');
  await page.reload();
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-manager');
});
test('U12 full guarded API and UI isolate organizations', async ({ page, context, request }) => {
  const a = await fixture(request);
  await login(page, a);
  await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-private-A');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Сохранено');
  const headers = await apiSession(request, a);
  const branch = await (await request.post(`${qa}/__qa/branch`)).json();
  const branchHeaders = {
    ...headers,
    'x-wetop-scope': `business=${branch.businessId};location=${branch.locationId}`,
  };
  const branchState = await (
    await request.get(`${qa}/onboarding`, { headers: branchHeaders })
  ).json();
  expect(
    (
      await request.post(`${qa}/onboarding`, {
        headers: branchHeaders,
        data: {
          action: 'save',
          draft: { ...branchState.draft, businessName: 'QA-private-A2' },
          updatedAt: branchState.updatedAt,
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (await (await request.get(`${qa}/onboarding`, { headers })).json()).draft.businessName,
  ).toBe('QA-private-A');
  expect(
    (await (await request.get(`${qa}/onboarding`, { headers: branchHeaders })).json()).draft
      .businessName,
  ).toBe('QA-private-A2');
  const b = await fixture(request);
  const otherContext = await context.browser()!.newContext();
  const other = await otherContext.newPage();
  await login(other, b);
  await expect(other.getByRole('main').getByLabel('Название бизнеса')).not.toHaveValue(
    'QA-private-A',
  );
  const before = await snapshot(request);
  const foreign = {
    ...headers,
    'x-wetop-scope': `business=${b.businessId};location=${b.locationId}`,
  };
  expect((await request.get(`${qa}/onboarding`, { headers: foreign })).status()).toBe(403);
  expect(
    (
      await request.post(`${qa}/onboarding`, {
        headers: foreign,
        data: { action: 'save', draft: {}, updatedAt: null },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(`${qa}/onboarding`, {
        headers,
        data: { action: 'save', draft: {}, updatedAt: null, locationId: b.locationId },
      })
    ).status(),
  ).toBe(400);
  expect(await snapshot(request)).toEqual(before);
  await page.reload();
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-private-A');
  await otherContext.close();
});
