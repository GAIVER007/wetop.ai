import type { Response } from '@playwright/test';
import { test, expect, FIXTURE_API } from '../../tests/ui/fixtures';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const out = '/Users/urijzapojnov/Developer/wetop-ui31-20261011/reports/ui3-1-audit-2026-10-11';
test('diagnostic only: request timing and menu screenshots, not the 15 second acceptance gate', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  const variant = process.env.AUDIT_VARIANT || 'ui31';
  mkdirSync(out, { recursive: true });
  const samples: unknown[] = [];
  for (let i = 0; i < 2; i++) {
    await page.goto('/chessboard');
    const trigger = page.locator('.sidenav__current');
    await expect(trigger).toBeEnabled();
    if (i === 0 && variant === 'ui31') await page.screenshot({ path: join(out, 'desktop-closed.png') });
    await trigger.click();
    const panel = page.locator('.sidenav__panel');
    await panel.getByRole('button', { name: 'Настройки', exact: true }).hover();
    if (i === 0 && variant === 'ui31') await page.screenshot({ path: join(out, 'desktop-submenus.png') });
    const started = Date.now();
    const responses: unknown[] = [];
    const onResponse = (response: Response) => { if (new URL(response.url()).pathname === '/hotel-settings') responses.push({ afterMs: Date.now() - started, status: response.status() }); };
    page.on('response', onResponse);
    await panel.getByRole('link', { name: 'Объект', exact: true }).click();
    const menuClosedAfterClick = !(await panel.isVisible());
    let navigation: string | null = null;
    try { await page.waitForURL(/\/hotel-settings$/, { timeout: 60_000 }); } catch (e) { navigation = String(e); }
    const elapsedMs = Date.now() - started;
    await page.waitForTimeout(100);
    samples.push({ iteration: i + 1, elapsedMs, withinOriginal15s: elapsedMs < 15000, menuClosedAfterClick, responses, navigation, mainFocused: await page.locator('#main-content').evaluate((el) => document.activeElement === el).catch(() => false) });
    page.off('response', onResponse);
  }
  if (variant === 'ui31') {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/chessboard');
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Навигация', exact: true })).toBeVisible();
    await page.screenshot({ path: join(out, 'mobile-open.png') });
  }
  writeFileSync(join(out, `${variant}-navigation-timing.json`), JSON.stringify({ variant, note: 'Existing dev caches; 60s observation only, original acceptance test unchanged at 15s', samples }, null, 2));
});

test('diagnostic branch after visible main: переключатель филиалов сохраняет раздел и выбор после перезагрузки', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  const branchId = '66666666-6666-4666-8666-666666666666';
  const seeded = await request.post(`${FIXTURE_API}/branches`, {
    headers: { 'x-wetop-test-client': '1' },
    data: { id: branchId, name: 'Филиал Север', address: 'Тестовая улица, 2' },
  });
  expect(seeded.ok()).toBe(true);
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { branchWithInventory: true },
  });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  // Филиалов два: после входа сервер не выбирает первый, человек выбирает сам (SCOPE-HARDENING)
  await page.waitForURL('**/branches');
  expect((await page.context().cookies()).find((c) => c.name === 'wetop_scope')).toBeUndefined();
  await page.goto('/chessboard');
  // объект и филиал стоят в шапке рядом со знаком (ADR-134); список не сдвигает строку разделов
  const sidebar = page.locator('.workspace-header');
  const trigger = sidebar.getByRole('button', { name: 'Выбрать филиал', exact: true });
  const navigation = page.getByRole('main');
  await expect(navigation).toBeVisible();
  const before = await navigation.boundingBox();
  await trigger.click();
  const choices = sidebar.getByRole('region', { name: 'Выбор филиала' });
  await expect(choices).toBeVisible();
  expect((await navigation.boundingBox())!.y).toBe(before!.y);
  await choices.getByLabel('Найти филиал').fill('Нет такого филиала');
  await expect(choices.getByText('Филиалы не найдены')).toBeVisible();
  await choices.getByLabel('Найти филиал').fill('');
  // Указателя ещё нет, и стойка филиал не угадывает (MV8, `9023217b`): в списке оба филиала и ни одного
  // текущего; отметка «Текущий филиал» появляется только после выбора (проверка ниже, после перезагрузки)
  await expect(choices.getByRole('button', { name: /Тестовый центральный филиал/ })).toBeVisible();
  await expect(choices.getByRole('button', { name: /Филиал Север/ })).toBeVisible();
  await expect(choices.getByText('Текущий филиал')).toHaveCount(0);
  await choices.getByRole('button', { name: /Филиал Север/ }).click();
  await expect(trigger).toContainText('Филиал Север');
  await expect(page).toHaveURL(/\/chessboard$/);
  expect((await page.context().cookies()).find((c) => c.name === 'wetop_scope')?.value).toContain(
    branchId,
  );
  await page.reload();
  await expect(trigger).toContainText('Филиал Север');
  await trigger.click();
  await expect(choices.getByRole('button', { name: /Филиал Север/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(choices.getByText('Текущий филиал')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(choices).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(choices.getByRole('button', { name: /Филиал Север/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({ path: 'reports/ui3-1-audit-2026-10-11/branch-switcher.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  const mobile = page.locator('.mobile-navigation');
  await mobile.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
  // в кнопке между названием и адресом подписано направление (#403): «Филиал Север Гостиничный бизнес Тестовая улица…»
  await expect(mobile.getByRole('button', { name: /Филиал Север .*Тестовая улица/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'reports/ui3-1-audit-2026-10-11/branch-switcher-mobile.png' });
});

test('audit header controls: search click and manual theme toggle', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/chessboard');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const theme = await page.locator('html').getAttribute('data-theme');
    await page.getByRole('button', { name: 'Переключить тему', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');
    expect((await page.locator('.workspace-header').boundingBox())!.height).toBe(56);
    await page.getByRole('button', { name: 'Найти гостя или бронь', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Быстрый поиск' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Быстрый поиск' })).toBeHidden();
  }
});
