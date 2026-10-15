import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

test('drawer text retains AA contrast at the start of its opening animation', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/rooms/categories', { waitUntil: 'domcontentloaded' });
  const category = page.getByTestId('fund-category-row').filter({ hasText: 'Мужской общий номер' });
  await category
    .getByRole('button', { name: 'Изменить категорию Мужской общий номер', exact: true })
    .click();
  const drawer = page.getByRole('dialog', { name: 'Редактировать категорию', exact: true });
  await expect(drawer).toBeVisible();
  await drawer.evaluate((element) => {
    element.style.animation = 'none';
    element.getBoundingClientRect();
    element.style.removeProperty('animation');
    element.getBoundingClientRect();
    for (const animation of element.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
  });
  await expect(drawer).toHaveCSS('opacity', '1');
  const result = await new AxeBuilder({ page })
    .include('.ui-drawer')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations.filter((violation) => violation.id === 'color-contrast')).toEqual([]);
});
