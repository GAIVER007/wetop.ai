import { test, expect } from '@playwright/test';
const API = 'http://127.0.0.1:4428';
const PROXY = 'http://127.0.0.1:4430';
const WEB = 'http://127.0.0.1:3138';
const SITE = 'http://127.0.0.1:3038';

test.beforeEach(async ({ request, page }) => {
  await request.post(`${API}/__test/reset`);
  await request.post(`${PROXY}/__a27/network`, { data: { unavailable: false } });
  await page.goto(`${WEB}/login`);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill(process.env.A27_FIXTURE_EMAIL!);
  await dialog.getByLabel('Пароль', { exact: true }).fill(process.env.A27_FIXTURE_PASSWORD!);
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(`${WEB}/today`);
});

for (const status of [403, 500]) {
  test(`session check ${status} is a safe distinct failure and preserves the valid session`, async ({ page, request, context }) => {
    const before = (await context.cookies(WEB)).find(c => c.name === 'wetop_session')?.value;
    expect(Boolean(before)).toBe(true);
    await request.post(`${API}/__test/control`, { data: { failPath: '/auth/me', failStatus: status } });
    const target = '/today?from=2026-10-07&to=2026-10-08';
    const response = await page.goto(`${WEB}${target}`);
    await expect(page).toHaveURL(`${WEB}${target}`);
    await expect(page.getByRole('heading', { name: status === 403 ? 'Нет доступа' : 'Нет связи с сервером', exact: true })).toBeVisible();
    await expect(page.locator('section[role="alert"]')).toBeVisible();
    await expect(page.getByTestId('desk-kpi')).toHaveCount(0);
    const raw = await response!.text();
    expect(raw.includes(process.env.A27_FIXTURE_EMAIL!)).toBe(false);
    expect((await context.cookies(WEB)).find(c => c.name === 'wetop_session')?.value === before).toBe(true);
    if (status === 403) await expect(page.getByRole('link', { name: 'Выбрать филиал', exact: true })).toHaveAttribute('href', '/scope/resolve?next=' + encodeURIComponent(target));
    await request.post(`${API}/__test/control`, { data: { failPath: null } });
    await page.getByRole('link', { name: status === 403 ? 'Выбрать филиал' : 'Повторить загрузку', exact: true }).click();
    await expect(page).toHaveURL(`${WEB}${target}`);
    await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
  });
}

for (const width of [1440, 390]) for (const theme of ['light', 'dark'] as const) {
  test(`unavailable session API ${width} ${theme}: safe keyboard recovery without cookie deletion`, async ({ page, request, context }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const before = (await context.cookies(WEB)).find(c => c.name === 'wetop_session')?.value;
    await request.post(`${PROXY}/__a27/network`, { data: { unavailable: true } });
    await page.goto(`${WEB}/today`);
    await expect(page).toHaveURL(`${WEB}/today`);
    await expect(page.getByRole('heading', { name: 'Нет связи с сервером', exact: true })).toBeVisible();
    await expect(page.locator('section[role="alert"]')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
    const retry = page.getByRole('link', { name: 'Повторить загрузку', exact: true });
    await retry.focus();
    await expect(retry).toBeFocused();
    expect((await context.cookies(WEB)).find(c => c.name === 'wetop_session')?.value === before).toBe(true);
    await request.post(`${PROXY}/__a27/network`, { data: { unavailable: false } });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(SITE);
  });
}
