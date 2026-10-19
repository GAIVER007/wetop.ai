import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { api, date, seed } from './tz11-helpers';

test.use({ actionTimeout: 15000 });

const evidence = process.env.ZAPIS_EVIDENCE || 'test-results/zapis-report';

test('reviews: manager copies link, anonymous client rates selected master once', async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(180000);
  const f = await seed(page, request);
  const day = await f.call('/beauty/appointments', {
    startsAt: `${date}T10:00:00+05:00`,
    firstName: 'Тестовый клиент отзыва',
    items: [0, 1, 0].map((index) => ({
      employeeId: f.employees[index]!.id,
      serviceId: f.services[0]!.id,
    })),
  });
  const appointment = day.appointments[0];
  await f.call(`/beauty/appointments/${appointment.id}/status`, { status: 'DONE' }, 'post');
  await page.goto(`/calendar?date=${date}&appointment=${appointment.id}`);
  const card = page.getByRole('dialog', { name: 'Запись', exact: true });
  await card.getByRole('button', { name: 'Создать ссылку на отзыв', exact: true }).click();
  const link = card.getByRole('textbox', { name: 'Ссылка на отзыв', exact: true });
  await expect(link).toHaveValue(/\/reviews\/[A-Za-z0-9_-]{40,}$/);
  const url = await link.inputValue();
  await expect(card).toContainText('Отправьте её клиенту вручную.');
  const anonymous = await browser.newContext({ reducedMotion: 'reduce' });
  const guest = await anonymous.newPage();
  await guest.goto(url);
  await expect(guest.getByRole('heading', { name: 'Оцените визит' })).toBeVisible();
  await expect(guest.getByText('Тестовый клиент отзыва', { exact: true })).toHaveCount(0);
  await expect(guest.getByRole('navigation', { name: 'Главное меню' })).toHaveCount(0);
  await expect(guest.getByRole('checkbox')).toHaveCount(2);
  await guest.getByRole('checkbox', { name: 'Оценить Тест Анна', exact: true }).check();
  await guest
    .getByRole('radiogroup', { name: 'Оценка для Тест Анна', exact: true })
    .getByRole('radio', { name: '5 из 5', exact: true })
    .check({ force: true });
  await guest
    .getByRole('textbox', { name: /^Комментарий для Тест Анна/ })
    .fill('Тестовый отзыв выбранному мастеру');
  mkdirSync(evidence, { recursive: true });
  for (const colorScheme of ['light', 'dark'] as const) {
    await guest.emulateMedia({ colorScheme });
    for (const width of [1440, 390]) {
      await guest.setViewportSize({ width, height: 1000 });
      expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect((await new AxeBuilder({ page: guest }).analyze()).violations).toEqual([]);
      await guest.screenshot({
        path: `${evidence}/review-${width}-${colorScheme}.png`,
        fullPage: true,
      });
    }
  }
  await guest.getByRole('button', { name: 'Отправить отзыв', exact: true }).click();
  await expect(guest.getByText('Спасибо, отзыв отправлен.', { exact: true })).toBeVisible();
  await guest.reload();
  await expect(
    guest.getByText('Отзыв по этой ссылке уже отправлен.', { exact: true }),
  ).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Отправить отзыв', exact: true })).toHaveCount(0);
  const repeated = await request.post(
    `${api}/beauty/appointments/${appointment.id}/review-invitation`,
    { headers: f.headers, data: {} },
  );
  expect(repeated.status()).toBe(409);
  await anonymous.close();
});
