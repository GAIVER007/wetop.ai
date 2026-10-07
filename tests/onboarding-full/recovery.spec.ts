import { test, expect } from '@playwright/test';
import { fullQaPorts } from './ports';
const qa = fullQaPorts.url;
test.beforeEach(async ({ page, request }) => {
  const fixture = await (await request.post(`${qa}/__qa/reset`, { data: {} })).json();
  await page.goto('/auth/fallback');
  await page.getByRole('main').getByLabel('Email', { exact: true }).fill(fixture.email);
  await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/register/setup');
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toBeVisible();
});
test.afterAll(async ({ request }) =>
  expect((await request.post(`${qa}/__qa/cleanup`)).ok()).toBe(true),
);
for (const mode of ['offline', 'timeout', 'before503', 'after']) {
  test(`U07 ${mode}: retains draft, retries and persists once`, async ({ page, request }) => {
    const name = `QA-${mode}-preserved`;
    await page.getByRole('main').getByLabel('Название бизнеса').fill(name);
    await request.post(`${qa}/__qa/fault`, { data: { mode } });
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeVisible({
      timeout: 80000,
    });
    expect(new URL(page.url()).pathname).toBe('/register/setup');
    await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue(name);
    await request.post(`${qa}/__qa/fault`, { data: { mode: 'none' } });
    await page.getByRole('button', { name: 'Повторить', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Сохранено');
    await page.reload();
    await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue(name);
    const state = await (await request.get(`${qa}/__qa/snapshot`)).json();
    expect(state.progress).toHaveLength(1);
    expect(state.progress[0].draft.businessName).toBe(name);
  });
}
test('lost next response never advances twice', async ({ page, request }) => {
  await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-next-once');
  await request.post(`${qa}/__qa/fault`, { data: { mode: 'after' } });
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByRole('main').getByLabel('Название филиала')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('main').getByLabel('Название филиала')).toBeVisible();
  expect((await (await request.get(`${qa}/__qa/snapshot`)).json()).progress).toHaveLength(1);
});
test('409 preserves unsaved input and never overwrites another window', async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await other.goto('/register/setup');
  await other.getByRole('main').getByLabel('Название бизнеса').fill('QA-other-window');
  await other.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(other.getByRole('status')).toHaveText('Сохранено');
  await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-local-unsaved');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Загрузить сохранённую версию' })).toBeVisible();
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue(
    'QA-local-unsaved',
  );
  await other.reload();
  await expect(other.getByRole('main').getByLabel('Название бизнеса')).toHaveValue(
    'QA-other-window',
  );
  await page.getByRole('button', { name: 'Загрузить сохранённую версию' }).click();
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue(
    'QA-other-window',
  );
  await other.close();
});
for (const mode of ['expire', 'revoke'])
  test(`${mode}: real SessionGuard denies write and requires login`, async ({ page, request }) => {
    await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-rejected');
    const before = await (await request.get(`${qa}/__qa/snapshot`)).json();
    await request.post(`${qa}/__qa/access`, { data: { [mode]: true } });
    let loginUrl = '';
    await page.route('**/register/setup/progress', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      // Read the actual guarded response before the browser immediately follows its login redirect.
      const reply = await route.fetch();
      loginUrl = (await reply.json()).loginUrl || '';
      await route.fulfill({ response: reply });
    });
    const rejected = page.waitForResponse(
      (r) => r.url().endsWith('/register/setup/progress') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    const response = await rejected;
    expect(response.status()).toBe(401);
    expect(loginUrl).toContain('#login');
    await page.waitForURL((url) => url.pathname !== '/register/setup');
    await page.goto('/auth/fallback');
    await expect(page.getByRole('main').getByLabel('Email', { exact: true })).toBeVisible();
    expect(await (await request.get(`${qa}/__qa/snapshot`)).json()).toEqual(before);
  });
for (const role of ['STAFF', 'READ_ONLY'])
  test(`${role}: real guarded API rejects write`, async ({ page, request }) => {
    await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-forbidden');
    const before = await (await request.get(`${qa}/__qa/snapshot`)).json();
    await request.post(`${qa}/__qa/access`, {
      data: role === 'STAFF' ? { role } : { status: 'READ_ONLY' },
    });
    const reply = page.waitForResponse(
      (response) =>
        response.url().endsWith('/register/setup/progress') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    expect((await reply).status()).toBe(403);
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      role === 'STAFF' ? 'доступ есть' : 'Данные доступны для просмотра',
    );
    expect(new URL(page.url()).pathname).toBe('/register/setup');
    expect(await (await request.get(`${qa}/__qa/snapshot`)).json()).toEqual(before);
  });

test('initial protected page outage requires a real reload after recovery, without invalidating session', async ({
  page,
  request,
}) => {
  await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-freshpage-persisted');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Сохранено');
  await request.post(`${qa}/__qa/fault`, { data: { mode: 'offline' } });
  await page.reload();
  expect(new URL(page.url()).pathname).toBe('/register/setup');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Не удалось загрузить настройку',
  );
  await request.post(`${qa}/__qa/fault`, { data: { mode: 'none' } });
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click();
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue(
    'QA-freshpage-persisted',
  );
});
