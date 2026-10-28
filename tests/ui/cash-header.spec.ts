import { randomUUID } from 'node:crypto';
import { FIXTURE_API, expect, test } from './fixtures';

test('общая шапка: одна кнопка смены, расход, итоги и одна строка разделов во всех вертикалях', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  for (const vertical of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE']) {
    await page.waitForLoadState('networkidle');
    const beforeHits = (await (await request.get(`${FIXTURE_API}/__test/hits`)).json()) as {
      byRequest: Record<string, number>;
    };
    const response = await request.post(`${FIXTURE_API}/branches`, {
      headers: { 'x-wetop-test-client': '1' },
      data: {
        id: randomUUID(),
        name: `Тест кассы ${vertical}`,
        vertical,
        currency: 'KZT',
        timezone: 'Asia/Almaty',
      },
    });
    expect(response.ok()).toBe(true);
    const branch = (await response.json()) as {
      locationId: string;
      location: { businessId: string };
    };
    await page.context().addCookies([
      {
        name: 'wetop_scope',
        value: encodeURIComponent(
          `business=${branch.location.businessId};location=${branch.locationId}`,
        ),
        url: new URL(page.url()).origin,
        httpOnly: true,
      },
    ]);
    await page.goto('/today');
    const header = page.getByTestId('cash-header');
    await expect(header.getByRole('button', { name: 'Открыть смену', exact: true })).toBeEnabled();
    await expect(header.getByRole('button', { name: 'Закрыть смену', exact: true })).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    const afterHits = (await (await request.get(`${FIXTURE_API}/__test/hits`)).json()) as {
      byRequest: Record<string, number>;
    };
    expect(
      (afterHits.byRequest['GET /cash-register'] ?? 0) -
        (beforeHits.byRequest['GET /cash-register'] ?? 0),
    ).toBe(1);
    for (const width of [1440, 1280, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width >= 1280) {
        const tops = await page
          .locator('.tabnav')
          .evaluate((el) => [...el.children].map((n) => Math.round(n.getBoundingClientRect().top)));
        expect(new Set(tops).size).toBe(1);
      }
      const overflow = await page
        .locator('body')
        .evaluate((el) => el.scrollWidth > window.innerWidth);
      if (overflow)
        console.log(
          'overflow',
          vertical,
          width,
          await page.locator('body').evaluate(() =>
            [...document.querySelectorAll('header,header *,main,main *')]
              .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
              .slice(0, 12)
              .map((el) => ({
                tag: el.tagName,
                cls: el.className,
                right: el.getBoundingClientRect().right,
                width: el.getBoundingClientRect().width,
              })),
          ),
        );
      await expect
        .poll(() => page.locator('body').evaluate((el) => el.scrollWidth > window.innerWidth))
        .toBe(false);
      await page
        .locator('.workspace-header')
        .screenshot({ path: `reports/cash-shifts-2026-10-25/${vertical}-header-${width}.png` });
    }
    await header.getByRole('button', { name: 'Открыть смену', exact: true }).click();
    let panel = page.getByRole('dialog');
    // открытие «Б» (владелец 26.10.2026): крупно сумма и «Да / Нет, другая сумма»
    await expect(panel.getByTestId('cash-open-expected')).toBeVisible();
    await expect(panel.getByRole('button', { name: /^Да, .+ Открыть смену$/ })).toBeEnabled();
    await panel.getByRole('button', { name: 'Нет, другая сумма', exact: true }).click();
    // другая сумма: появляется расхождение и поле причины
    await panel.getByLabel('Сколько наличных в кассе сейчас').fill('9900');
    await expect(panel.getByRole('status').filter({ hasText: 'Не хватает 100' })).toBeVisible();
    await expect(panel.getByLabel('Почему сумма другая')).toBeVisible();
    // сумма совпала: причина не нужна
    await panel.getByLabel('Сколько наличных в кассе сейчас').fill('10000');
    await expect(panel.getByLabel('Почему сумма другая')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Назад', exact: true }).click();
    if (vertical === 'BEAUTY') await panel.screenshot({ path: 'reports/cash-shifts-2026-10-25/open-b.png' });
    await panel.getByRole('button', { name: /^Да, .+ Открыть смену$/ }).click();
    await expect(panel).toHaveCount(0);
    await expect(header.getByRole('button', { name: 'Закрыть смену', exact: true })).toBeEnabled();
    await page.reload();
    await expect(header.getByRole('button', { name: 'Закрыть смену', exact: true })).toBeEnabled();
    await header.getByRole('button', { name: 'Добавить расход', exact: true }).click();
    panel = page.getByRole('dialog');
    await panel.getByLabel('Сумма', { exact: true }).fill('500');
    // частая статья одним касанием (владелец 27.10.2026): кнопка заполняет «Статью»
    await panel.getByTestId('cash-expense-chips').getByRole('button', { name: 'Такси', exact: true }).click();
    await expect(panel.getByLabel('Статья', { exact: true })).toHaveValue('Такси');
    await panel.getByRole('button', { name: 'Добавить расход', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await header.getByRole('button', { name: 'Итоги смены', exact: true }).click();
    panel = page.getByRole('dialog');
    await expect(panel).toContainText('9 500');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await header.getByRole('button', { name: 'Закрыть смену', exact: true }).click();
    panel = page.getByRole('dialog');
    // закрытие «А»: было + оплаты − расходы = должно быть; расход можно добавить прямо отсюда
    await expect(panel.getByTestId('cash-close-expected')).toContainText('9 500');
    // вариант B (владелец 28.10.2026): расходы смены списком, забытый расход дописывается частой статьёй
    await expect(panel.getByTestId('cash-close-expenses')).toContainText('Такси');
    await expect(panel.getByTestId('cash-close-expenses')).toContainText('500');
    await panel.getByTestId('cash-close-chips').getByRole('button', { name: '+ Другое', exact: true }).click();
    await panel.getByLabel('Сумма', { exact: true }).fill('100');
    await panel.getByLabel('Статья', { exact: true }).fill('Вода');
    await panel.getByRole('button', { name: 'Добавить расход', exact: true }).click();
    await expect(panel.getByTestId('cash-close-expected')).toContainText('9 400');
    await panel.getByLabel('Пересчитали наличные').fill('9400');
    await panel.getByLabel('Оставить на размен').fill('9400');
    await expect(panel.getByRole('status').filter({ hasText: 'Сходится' })).toBeVisible();
    if (vertical === 'BEAUTY') await panel.screenshot({ path: 'reports/cash-shifts-2026-10-25/close-a.png' });
    await panel.getByRole('button', { name: 'Закрыть смену', exact: true }).click();
    await expect(panel.getByRole('heading', { name: 'Итоги смены' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(header.getByRole('button', { name: 'Открыть смену', exact: true })).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 900 });
    expect(await page.locator('body').evaluate((el) => el.scrollWidth > window.innerWidth)).toBe(
      false,
    );
    const headerBounds = await page.locator('.workspace-header').boundingBox();
    const actionBounds = await header.boundingBox();
    expect(actionBounds!.y + actionBounds!.height).toBeLessThanOrEqual(
      headerBounds!.y + headerBounds!.height,
    );
    await page.screenshot({
      path: `reports/cash-shifts-2026-10-25/${vertical}-390.png`,
      fullPage: true,
    });
  }
});
