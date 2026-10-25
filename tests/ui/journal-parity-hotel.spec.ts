import { FIXTURE_API, expect, test } from './fixtures';
import { journalHeadLook } from '../tools/journal-head-look';

/** Эталон шапки журнала: календарь гостиницы (владелец 24.10.2026). Те же условия проверяют салон и ресторан. */
test.beforeEach(async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
});

for (const [width, height] of [[1440, 1000], [1280, 800]] as const) {
  test(`гостиница: шапка журнала эталон ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/chessboard');
    await page.locator('.board-toolbar').waitFor();
    const look = await journalHeadLook(page);
    expect(look.padding).toBe(height >= 900 ? '16px 24px' : '8px 24px');
    for (const h of look.heights) expect(h).toBe(`${h.split('=')[0]}=${look.controlH}`);
    for (const f of look.fonts) expect(f).toBe(`${f.split('=')[0]}=${look.textSm}`);
    expect(look.selectsLeftOfSearch).toBe(true);
    expect(look.filtersIcon).toBe(true);
    expect(look.createIcon).toBe(true);
    expect(look.lupa).toBe(false);
    expect(look.subtitleShown).toBe(height >= 900);
    expect(look.titleFont).toBe(height >= 900 ? look.text4xl : look.text3xl);
  });
}
