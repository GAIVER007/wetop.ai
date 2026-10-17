import { FIXTURE_API, expect, hydrated, test, type Page } from './fixtures';

// Synthetic fixture UI coverage only. This does not certify the real guest API or its guards.
const booking = '/reservations/20260913-TESTAA';
const editorFor = (page: Page) => page.getByRole('dialog', { name: 'Данные гостя', exact: true });
const triggerFor = (page: Page) => page.getByRole('button', { name: 'Изменить гостя', exact: true });

async function openEditor(page: Page) {
  const trigger = triggerFor(page);
  await hydrated(trigger);
  await trigger.click();
  const editor = editorFor(page);
  await expect(editor.getByTestId('guest-form')).toBeVisible();
  return editor;
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
});

test('fixture UI: mobile guest loads, saves citizenship and survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(booking);
  const original = page.url();
  const editor = await openEditor(page);
  await expect(editor.getByLabel(/Гражданство/)).toHaveValue('KAZ');
  await editor.getByLabel(/Гражданство/).fill('KGZ');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByTestId('booking-head')).toContainText('гражданство KGZ');
  await expect(page).toHaveURL(original);
  // A refresh may remount the keyed editor, so close it only if still open.
  if (await editor.isVisible()) await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByTestId('booking-head')).toContainText('гражданство KGZ');
  const reopened = await openEditor(page);
  await expect(reopened.getByLabel(/Гражданство/)).toHaveValue('KGZ');
  expect(await reopened.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});

test('fixture UI: Escape restores focus and reopening discards cached guest data', async ({ page, request }) => {
  await page.goto(booking);
  const original = page.url();
  await openEditor(page);
  await page.keyboard.press('Escape');
  await expect(editorFor(page)).toHaveCount(0);
  await expect(triggerFor(page)).toBeFocused();
  await expect(page.getByTestId('guest-form')).toHaveCount(0);
  await expect(page).toHaveURL(original);
  // Change only synthetic guest data while the editor is closed. Reopen must load again.
  // Direct fixture transport requires the canonical test-client header (otherwise 403).
  const headers = { 'x-wetop-test-client': '1' };
  const updated = await request.patch(`${FIXTURE_API}/guests/ui-guest`, {
    headers,
    data: { citizenship: 'UZB' },
  });
  expect(updated.ok(), `fixture guest PATCH: HTTP ${updated.status()}`).toBe(true);
  const stored = await request.get(`${FIXTURE_API}/guests/ui-guest`, { headers });
  expect(stored.ok(), `fixture guest GET: HTTP ${stored.status()}`).toBe(true);
  expect(await stored.json()).toMatchObject({ citizenship: 'UZB' });
  const reopened = await openEditor(page);
  await expect(reopened.getByLabel(/Гражданство/)).toHaveValue('UZB');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('guest-form')).toHaveCount(0);
});

test('fixture UI: read-only booking disables guest editing', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { orgTrialDays: 'ended' } });
  await page.goto(booking);
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(triggerFor(page)).toBeDisabled();
  await expect(page.getByTestId('guest-form')).toHaveCount(0);
});

test('fixture UI: pseudonymized editor preserves warning and omits personal fields', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { piiStorage: 'pseudonymized' } });
  await page.goto(booking);
  const editor = await openEditor(page);
  await expect(editor.getByTestId('guest-pseudonymized')).toContainText('имя, контакты, заметки и документы');
  await expect(editor.locator('[name="firstName"], [name="lastName"], [name="phone"], [name="email"], [name="notes"]')).toHaveCount(0);
  await expect(editor.getByLabel(/Гражданство/)).toBeEditable();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('guest-form')).toHaveCount(0);
});

test.afterEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});
