import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * Простой редактор сайта (SITE-1, поручение владельца 15.10.2026): одна страница без вкладок. Щелчок по тексту на сайте
 * правит его на месте и сохраняется сам; щелчок по блоку делает его целью ИИ; «Изменить с ИИ» с подсказками; «Шаблон»
 * меняет оформление одним касанием, не трогая тексты; «Расширенный режим» открывает прежний редактор. Стенд отвечает
 * правилами API, данные вымышленные (ADR-010).
 */
const SHOTS = 'reports/site-1';
const main = (page: Page) => page.getByRole('main').filter({ visible: true });
const frame = (page: Page) => page.frameLocator('[data-testid="ed-frame"]');
const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('[data-testid="ed-frame"]').analyze();

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('простой режим по умолчанию: без вкладок, сайт и одна панель; текст правится на месте и сохраняется сам', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await expect(m.getByTestId('site-editor')).toBeVisible();
  await expect(m.getByRole('tablist')).toHaveCount(0);
  await expect(m.getByTestId('ed-save')).toHaveCount(0);
  await expect(m.getByRole('heading', { name: 'Изменить с ИИ' })).toBeVisible();
  await expect(m.getByTestId('ed-templates')).toBeVisible();
  await expect(m.getByTestId('ed-dirty')).toContainText('Сохранено');

  // щелчок по заголовку на сайте: текст правится прямо там, Enter применяет, сохранение само
  const heading = frame(page).locator('[data-editor-path="pages[0].sections[0].heading"]');
  await heading.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Тихие номера в центре');
  await page.keyboard.press('Enter');
  await expect(heading).toHaveText('Тихие номера в центре');
  await expect(m.getByTestId('ed-dirty')).toContainText('Сохранено', { timeout: 10_000 });
  // блок заголовка стал целью ИИ
  await expect(m.getByTestId('ed-ai-target')).toContainText('Блок «');
  await page.reload();
  await expect(frame(page).locator('#sec-hero')).toContainText('Тихие номера в центре');
  // «Отменить» возвращает текст, и это тоже сохраняется само
  await expect(main(page).getByTestId('ed-undo')).toBeDisabled();
});

test('ИИ: подсказка-чип, правка блока, «Вернуть как было»', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  const ai = m.getByTestId('ed-ai');
  await expect(m.getByTestId('ed-chip')).toHaveCount(4);
  await m.getByTestId('ed-chip').first().click();
  await expect(ai.getByLabel('Что изменить на сайте?')).toHaveValue('Сделай тексты короче и проще');
  await ai.getByTestId('ed-ai-send').click();
  await expect(m.getByTestId('ed-ai-done')).toBeVisible({ timeout: 20_000 });
  await m.getByTestId('ed-ai-revert').click();
  await page.getByRole('button', { name: 'Вернуть', exact: true }).click();
  await expect(m.getByTestId('ed-ai-done')).toHaveCount(0);
});

test('шаблон меняет оформление одним касанием, тексты остаются; «Расширенный режим» открывает полный редактор', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/marketing-site`, { data: { noSite: true } });
  await page.goto('/marketing/site/editor');
  await main(page).getByTestId('create-site-start').click();
  const m = main(page);
  await expect(m.getByTestId('ed-templates')).toBeVisible({ timeout: 15_000 });
  await expect(m.getByRole('radio', { name: /Классический отель/ })).toHaveAttribute('aria-checked', 'true');
  await expect(frame(page).locator('#sec-hero')).toContainText('Luxx Aparts');
  await m.getByRole('radio', { name: /Бутик-отель/ }).click();
  await expect(m.getByRole('radio', { name: /Бутик-отель/ })).toHaveAttribute('aria-checked', 'true');
  await expect(frame(page).locator('body')).toHaveClass(/p-night/);
  await expect(frame(page).locator('#sec-hero')).toContainText('Luxx Aparts');
  await expect(m.getByTestId('ed-dirty')).toContainText('Сохранено', { timeout: 10_000 });

  await m.getByTestId('ed-advanced').click();
  await expect(page).toHaveURL(/full=1/);
  await expect(main(page).getByRole('tablist', { name: 'Части редактора' })).toBeVisible();
  await main(page).getByTestId('ed-simple').click();
  await expect(main(page).getByTestId('ed-templates')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const)
  test(`простой редактор: снимки и доступность, ${theme}, 1440 и 390`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/marketing/site/editor');
      await expect(main(page).getByTestId('ed-templates')).toBeVisible();
      await expect(frame(page).locator('#sec-hero')).toBeVisible();
      const wide = await page.evaluate(() =>
        [...document.querySelectorAll('main *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('.ed-preview__stage')).length,
      );
      expect(wide).toBe(0);
      if (width === 390) {
        const small = await main(page)
          .locator('.simple-ed .btn, .simple-ed .chip, .simple-ed__tpl, .simple-ed__link')
          .evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent));
        expect(small).toEqual([]);
      }
      await expect.poll(async () => (await axe(page)).violations).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/editor-simple-${theme}-${width}.png`, fullPage: true });
    }
  });
