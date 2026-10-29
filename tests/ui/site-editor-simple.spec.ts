import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * Редактор сайта как у Lovable (SITE-1, поручение владельца 15.10.2026): слева чат с ИИ, справа сайт, вкладок нет.
 * Щелчок по тексту на сайте правит его на месте и сохраняется сам; щелчок по блоку делает его целью ИИ; «Шаблон»
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

test('по умолчанию чат слева, сайт справа, без вкладок; текст правится на месте и сохраняется сам', async ({ page }) => {
  await page.goto('/marketing/site/editor?chat=1');
  const m = main(page);
  await expect(m.getByTestId('site-editor')).toBeVisible();
  await expect(m.getByRole('tablist')).toHaveCount(0);
  await expect(m.getByTestId('ed-save')).toHaveCount(0);
  await expect(m.getByLabel('Что изменить на сайте?')).toBeVisible();
  await expect(m.getByTestId('ed-dirty')).toContainText('Сохранено');
  // чат слева от сайта
  const chat = await m.getByTestId('ed-ai').boundingBox();
  const site = await m.getByTestId('ed-frame').boundingBox();
  expect(chat!.x + chat!.width).toBeLessThanOrEqual(site!.x);

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
  await page.goto('/marketing/site/editor?chat=1');
  const m = main(page);
  const ai = m.getByTestId('ed-ai');
  await expect(m.getByTestId('ed-chip')).toHaveCount(4);
  await m.getByTestId('ed-chip').first().click();
  await expect(ai.getByLabel('Что изменить на сайте?')).toHaveValue('Сделай тексты короче и проще');
  await ai.getByTestId('ed-ai-send').click();
  await expect(m.getByTestId('ed-feed-item')).toContainText('Сделай тексты короче и проще');
  await expect(m.getByTestId('ed-ai-done')).toBeVisible({ timeout: 20_000 });
  await m.getByTestId('ed-ai-revert').click();
  await page.getByRole('button', { name: 'Вернуть', exact: true }).click();
  await expect(m.getByTestId('ed-ai-reverted')).toBeVisible();
  await expect(m.getByTestId('ed-ai-revert')).toHaveCount(0);
});

test('шаблон меняет оформление одним касанием, тексты остаются; «Расширенный режим» открывает полный редактор', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/marketing-site`, { data: { noSite: true } });
  await page.goto('/marketing/site/editor');
  await main(page).getByTestId('create-site-start').click();
  await expect(main(page).getByTestId('site-setup')).toBeVisible({ timeout: 15_000 });
  // чат с ИИ по отдельной ссылке
  await page.goto('/marketing/site/editor?chat=1');
  const m = main(page);
  await m.getByTestId('ed-template-open').click({ timeout: 15_000 });
  await expect(m.getByTestId('ed-templates')).toBeVisible();
  await expect(m.getByRole('radio', { name: /Классический отель/ })).toHaveAttribute('aria-checked', 'true');
  await expect(frame(page).locator('#sec-hero')).toContainText('Luxx Aparts');
  await m.getByRole('radio', { name: /Бутик-отель/ }).click();
  await expect(m.getByTestId('ed-template-open')).toContainText('Бутик-отель');
  await expect(frame(page).locator('body')).toHaveClass(/p-noir/);
  await expect(frame(page).locator('#sec-hero')).toContainText('Luxx Aparts');
  await expect(m.getByTestId('ed-dirty')).toContainText('Сохранено', { timeout: 10_000 });

  await m.getByTestId('ed-advanced').click();
  await expect(page).toHaveURL(/full=1/);
  await expect(main(page).getByRole('tablist', { name: 'Части редактора' })).toBeVisible();
  // «Простой режим» ведёт на экран из пяти шагов
  await main(page).getByTestId('ed-simple').click();
  await expect(main(page).getByTestId('site-setup')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const)
  test(`простой редактор: снимки и доступность, ${theme}, 1440 и 390`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/marketing/site/editor?chat=1');
      await expect(main(page).getByTestId('ed-template-open')).toBeVisible();
      await expect(frame(page).locator('#sec-hero')).toBeVisible();
      const wide = await page.evaluate(() =>
        [...document.querySelectorAll('main *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('.ed-preview__stage') && !el.closest('.lov-ed__chips')).length,
      );
      expect(wide).toBe(0);
      if (width === 390) {
        const small = await main(page)
          .locator('.lov-ed .btn, .lov-ed__composer button')
          .evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent));
        expect(small).toEqual([]);
      }
      await expect.poll(async () => (await axe(page)).violations).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/editor-simple-${theme}-${width}.png`, fullPage: true });
    }
  });
