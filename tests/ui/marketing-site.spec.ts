import { FIXTURE_API, expect, test, devNoise, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * MKT7 (plans/mkt7-publication-preview-domains-2026-10-07.md §8): тонкая страница публикации сайта филиала. Состояние,
 * ревизии, адрес, предпросмотр в новой вкладке (токен не показывается), публикация головы черновика, пауза и
 * возобновление, журнал с откатом, источник брони ИИ-продавца без автоподстановки (Q-275) и архив с вопросом.
 * Редактора нет (MKT9). Данные вымышленные (ADR-010).
 */
const fixture = FIXTURE_API;
const SHOTS = 'reports/mkt7-publication-2026-10-07';
const main = (page: Page) => page.getByRole('main').filter({ visible: true });
const control = (request: { post: (url: string, o: { data: unknown }) => Promise<unknown> }, data: Record<string, unknown>) =>
  request.post(`${fixture}/__test/marketing-site`, { data });

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('черновик: ревизия, «Не опубликован», будущий адрес; источник брони не выбран и не подставлен', async ({ page }) => {
  await page.goto('/marketing/site');
  const m = main(page);
  await expect(m.getByRole('heading', { level: 1 })).toHaveText('Публикация сайта');
  await expect(m.getByTestId('publication-status')).toHaveText('Черновик');
  await expect(m.getByTestId('publication-latest')).toHaveText('ревизия 2');
  await expect(m.getByTestId('publication-published')).toHaveText('Не опубликован');
  await expect(m.getByTestId('publication-url')).toContainText('luxx-aparts.sites.test');
  await expect(m.getByTestId('publication-url').getByRole('link')).toHaveCount(0);
  await expect(m.getByTestId('publication-booking-none')).toHaveText('Источник бронирования для ИИ-продавца не выбран');
  // два подходящих сайта: выбор, а не первый по списку
  const source = m.getByLabel('Сайт брони');
  await expect(source).toHaveValue('');
  await expect(source.locator('option')).toHaveCount(3);
  await expect(m.getByTestId('publication-booking-save')).toBeDisabled();
});

test('предпросмотр открывается в новой вкладке, токен на странице не виден', async ({ page, context }) => {
  // домен превью в стенде не существует: вкладке отдаём заглушку, проверяется только адрес
  await context.route('https://preview.sites.test/**', (route) => route.fulfill({ body: 'preview' }));
  await page.goto('/marketing/site');
  const popup = context.waitForEvent('page');
  await main(page).getByTestId('publication-preview').click();
  const tab = await popup;
  await tab.waitForLoadState();
  expect(tab.url()).toContain('preview.sites.test');
  await tab.close().catch(() => undefined);
  await expect(main(page)).not.toContainText('ui-preview-token');
});

test('публикация, пауза, возобновление, новая ревизия и откат; журнал без документа', async ({ page, request }) => {
  await control(request, { revisions: 1 });
  await page.goto('/marketing/site');
  const m = main(page);
  // публикация открывает сайт посетителям: сначала вопрос, «Оставить как есть» ничего не публикует
  await m.getByTestId('publication-publish').click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toContainText('Опубликовать ревизию 1?');
  await expect(confirm).toContainText('luxx-aparts.sites.test');
  await confirm.getByRole('button', { name: 'Оставить как есть', exact: true }).click();
  await expect(m.getByTestId('publication-status')).toHaveText('Черновик');
  await m.getByTestId('publication-publish').click();
  await confirm.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(m.getByTestId('publication-message')).toHaveText('Версия опубликована');
  await expect(m.getByTestId('publication-status')).toHaveText('Опубликован');
  await expect(m.getByTestId('publication-published')).toHaveText('ревизия 1');
  await expect(m.getByTestId('publication-url').getByRole('link')).toHaveAttribute('href', 'https://luxx-aparts.sites.test');
  await expect(m.getByTestId('publication-publish')).toHaveCount(0);

  await m.getByTestId('publication-pause').click();
  await expect(m.getByTestId('publication-status')).toHaveText('Приостановлен');
  await m.getByTestId('publication-resume').click();
  await expect(m.getByTestId('publication-status')).toHaveText('Опубликован');

  await control(request, { addRevision: true });
  await page.reload();
  await expect(m.getByTestId('publication-latest')).toHaveText('ревизия 2');
  await m.getByTestId('publication-publish').click();
  // повторная публикация говорит, что заменит
  await expect(confirm).toContainText('вместо ревизии 1');
  await confirm.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(m.getByTestId('publication-published')).toHaveText('ревизия 2');

  // откат на ревизию 1 с вопросом; голова черновика остаётся ревизией 2
  const row = m
    .getByTestId('publication-row')
    .filter({ hasText: 'Публикация' })
    .filter({ has: page.getByRole('cell', { name: '1', exact: true }) });
  await row.getByRole('button', { name: 'Откатить', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('ревизию 1');
  await dialog.getByRole('button', { name: 'Откатить', exact: true }).click();
  await expect(m.getByTestId('publication-published')).toHaveText('ревизия 1');
  await expect(m.getByTestId('publication-latest')).toHaveText('ревизия 2');
  await expect(m.getByTestId('publication-row')).toHaveText([/Откат/, /Публикация/, /Возобновление/, /Пауза/, /Публикация/]);
});

test('без тарифа брони публикация отказывает словами; с выбранным тарифом проходит', async ({ page, request }) => {
  await control(request, { rateRequired: true });
  await page.goto('/marketing/site');
  const m = main(page);
  const publish = async () => {
    await m.getByTestId('publication-publish').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Опубликовать', exact: true }).click();
  };
  await publish();
  await expect(m.getByTestId('publication-error')).toContainText('Выберите тариф');
  await expect(m.getByTestId('publication-status')).toHaveText('Черновик');
  await m.getByLabel('Тариф брони').selectOption({ label: 'Сайт' });
  await publish();
  await expect(m.getByTestId('publication-status')).toHaveText('Опубликован');
});

test('источник брони выбирается явно; архив с вопросом', async ({ page }) => {
  await page.goto('/marketing/site');
  const m = main(page);
  await m.getByLabel('Сайт брони').selectOption({ label: 'Лендинг акции, тариф Сайт' });
  await m.getByTestId('publication-booking-save').click();
  await expect(m.getByTestId('publication-message')).toHaveText('Источник бронирования выбран');
  await expect(m.getByTestId('publication-booking-none')).toHaveCount(0);
  await m.getByTestId('publication-archive').click();
  await page.getByRole('dialog').getByRole('button', { name: 'В архив', exact: true }).click();
  await expect(m.getByTestId('marketing-site-empty')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`страница на компьютере и телефоне, доступность: ${theme}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    mkdirSync(SHOTS, { recursive: true });
    await control(request, { revisions: 1 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    await page.goto('/marketing/site');
    await main(page).getByTestId('publication-publish').click();
    // окно подтверждения публикации тоже без нарушений доступности
    const confirm = page.getByRole('dialog');
    await expect(confirm).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await confirm.getByRole('button', { name: 'Опубликовать', exact: true }).click();
    await expect(main(page).getByTestId('publication-status')).toHaveText('Опубликован');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/marketing/site');
      await expect(main(page).getByTestId('publication-history')).toBeVisible();
      const wide = await page.evaluate(() =>
        [...document.querySelectorAll('main *')]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 5)
          .map((el) => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().right)}`),
      );
      expect(wide).toEqual([]);
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(audit.violations).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/publication-${theme}-${width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
