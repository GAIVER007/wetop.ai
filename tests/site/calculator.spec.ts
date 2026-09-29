import { expect, test } from '@playwright/test';

/**
 * Калькулятор «прямая бронь против OTA» (срез D3 плана прямых продаж, Q-225): готовых ставок нет, человек вводит
 * свои цифры; до ввода результата нет; расчёт — целые тенге, без обещаний результата и без чужих названий.
 */
test('калькулятор: пустые поля — результата нет, после ввода — сумма в месяц и в год', async ({ page }) => {
  await page.goto('/calculator/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const label of ['Ночей в месяц через OTA', 'Средняя цена ночи, ₸', 'Комиссия OTA, %', 'Доля броней, которые перейдут напрямую, %']) {
    await expect(page.getByLabel(label)).toHaveValue('');
  }
  await expect(page.locator('[data-calc-result]')).toHaveCount(0);

  await page.getByLabel('Ночей в месяц через OTA').fill('100');
  await page.getByLabel('Средняя цена ночи, ₸').fill('20000');
  await page.getByLabel('Комиссия OTA, %').fill('18');
  await page.getByLabel('Доля броней, которые перейдут напрямую, %').fill('25');

  const result = page.locator('[data-calc-result]');
  await expect(result).toBeVisible();
  const text = (await result.innerText()).replace(/\u00a0|\u202f/g, ' ');
  expect(text).toContain('360 000 ₸');
  expect(text).toContain('90 000 ₸');
  expect(text).toContain('1 080 000 ₸');
  expect(text).toMatch(/не обещание|оценка/i);
  const body = (await page.locator('body').innerText()).toLowerCase();
  expect(body).not.toMatch(/exely|travelline/);
});

test('калькулятор: неверное значение — подсказка у поля, результат пропадает', async ({ page }) => {
  await page.goto('/calculator/');
  await page.getByLabel('Ночей в месяц через OTA').fill('100');
  await page.getByLabel('Средняя цена ночи, ₸').fill('20000');
  await page.getByLabel('Комиссия OTA, %').fill('180');
  await page.getByLabel('Доля броней, которые перейдут напрямую, %').fill('25');
  await expect(page.locator('[data-calc-result]')).toHaveCount(0);
  await expect(page.getByText('От 0 до 100')).toBeVisible();
});
