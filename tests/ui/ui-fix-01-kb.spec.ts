import { FIXTURE_API, test, expect } from './fixtures';
async function open(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
) {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
  await page.goto('/platform/support/base?status=DRAFT');
  await page
    .getByTestId('kb-catalog')
    .getByRole('link', { name: /только чтение/ })
    .click();
  await page.waitForURL((url) => url.searchParams.has('id'));
  await expect(page.getByTestId('kb-entry').getByLabel('Текст знания')).toBeVisible();
}
async function publishes(request: import('@playwright/test').APIRequestContext) {
  const hits = await (await request.get(`${FIXTURE_API}/__test/hits`)).json();
  return Object.entries(hits.byRequest as Record<string, number>)
    .filter(([k]) => /^POST .*kb.*publish/.test(k))
    .reduce((n, [, count]) => n + count, 0);
}
async function requestCount(
  request: import('@playwright/test').APIRequestContext,
  method: string,
  path: string,
) {
  const hits = await (await request.get(`${FIXTURE_API}/__test/hits`)).json();
  return Number((hits.byRequest as Record<string, number>)[`${method} ${path}`] ?? 0);
}
test('C-P1-2 unsaved text cannot publish', async ({ page, request }) => {
  await open(page, request);
  const editor = page.getByTestId('kb-entry');
  await editor.getByLabel('Текст знания').fill('Synthetic version B');
  await expect(editor.getByRole('button', { name: 'Опубликовать', exact: true })).toBeDisabled();
  expect(await publishes(request)).toBe(0);
});
test('C-P1-2 save then publish B survives reload', async ({ page, request }) => {
  await open(page, request);
  const editor = page.getByTestId('kb-entry');
  await editor.getByLabel('Текст знания').fill('Synthetic version B');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByTestId('kb-result')).toContainText('Сохранено');
  await editor.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(page.getByTestId('kb-result')).toContainText('Опубликовано');
  expect(await publishes(request)).toBe(1);
  await page.reload();
  await expect(editor.getByLabel('Текст знания')).toHaveValue('Synthetic version B');
});

test('C-P1-2 editing C during save B preserves C as dirty', async ({ page, request }) => {
  await open(page, request);
  const editor = page.getByTestId('kb-entry');
  const id = new URL(page.url()).searchParams.get('id');
  expect(id).toBeTruthy();
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { platformAdmin: true, delayPath: `/platform/support/kb/${id}`, delayMs: 2500 },
  });
  const text = editor.getByLabel('Текст знания');
  await text.fill('Synthetic version B');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Сохраняю…', exact: true })).toBeDisabled();
  await text.fill('Synthetic version C');
  await expect(page.getByTestId('kb-result')).toContainText('Сохранена отправленная версия');
  await expect(text).toHaveValue('Synthetic version C');
  await expect(editor.getByRole('button', { name: 'Опубликовать', exact: true })).toBeDisabled();
  expect(await publishes(request)).toBe(0);
});
test('C-P1-2 initial create B keeps typed C, then PATCHes the same document', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { platformAdmin: true, delayPath: '/platform/support/kb', delayMs: 2500 },
  });
  await page.goto('/platform/support/base?new=1');

  const editor = page.getByTestId('kb-entry');
  const text = editor.getByLabel('Текст знания');
  await editor.getByLabel('Название').fill('Synthetic initial create race');
  await text.fill('Synthetic version B');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Сохраняю…', exact: true })).toBeDisabled();
  await text.fill('Synthetic version C');

  await expect(editor.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled();
  await expect(text).toHaveValue('Synthetic version C');
  await expect(page).toHaveURL(/\?new=1$/);
  await expect(page.getByTestId('kb-result')).toContainText('Сохранена отправленная версия');
  await expect(editor.getByRole('button', { name: 'Опубликовать', exact: true })).toBeDisabled();
  await expect(editor.getByRole('button', { name: 'В архив', exact: true })).toHaveCount(0);
  await expect(
    editor.getByRole('button', { name: 'Пометить устаревшим', exact: true }),
  ).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'Вернуть в черновик', exact: true })).toHaveCount(
    0,
  );
  expect(await requestCount(request, 'POST', '/platform/support/kb')).toBe(1);
  expect(await publishes(request)).toBe(0);

  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.waitForURL((url) => url.searchParams.has('id'));
  const createdId = new URL(page.url()).searchParams.get('id');
  expect(createdId).toBeTruthy();
  expect(await requestCount(request, 'POST', '/platform/support/kb')).toBe(1);
  expect(await requestCount(request, 'PUT', `/platform/support/kb/${createdId}`)).toBe(1);
  expect(await publishes(request)).toBe(0);

  await page.reload();
  await expect(page.getByTestId('kb-entry').getByLabel('Текст знания')).toHaveValue(
    'Synthetic version C',
  );
});
test('C-P1-2 save and publish failures preserve text without false success', async ({
  page,
  request,
}) => {
  await open(page, request);
  const editor = page.getByTestId('kb-entry');
  const id = new URL(page.url()).searchParams.get('id');
  expect(id).toBeTruthy();
  const text = editor.getByLabel('Текст знания');
  await text.fill('Synthetic version B');
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: {
      platformAdmin: true,
      failPath: `/platform/support/kb/${id}`,
      failMethod: 'PUT',
      failStatus: 503,
    },
  });
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByTestId('kb-error')).toBeVisible();
  await expect(text).toHaveValue('Synthetic version B');
  await expect(editor.getByRole('button', { name: 'Опубликовать', exact: true })).toBeDisabled();
  expect(await publishes(request)).toBe(0);
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { platformAdmin: true, failPath: '' },
  });
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByTestId('kb-result')).toContainText('Сохранено');
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: {
      platformAdmin: true,
      failPath: `/platform/support/kb/${id}/publish`,
      failMethod: 'POST',
      failStatus: 503,
    },
  });
  await editor.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(page.getByTestId('kb-error')).toContainText('Сохранено, но не опубликовано');
  await expect(text).toHaveValue('Synthetic version B');
  await expect(page.getByTestId('kb-result')).toHaveCount(0);
});
