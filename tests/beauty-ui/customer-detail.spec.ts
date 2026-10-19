import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { api, seed } from './tz11-helpers';

const pointer = (business: string, location: string) => `business=${business};location=${location}`;

test('customer card: linked history, mobile layout and tenant isolation', async ({
  page,
  request,
}) => {
  const fixture = await seed(page, request);
  const day = await fixture.book('10:00', 0, 0, 'Тест Карточка Клиента');
  const appointment = day.appointments[0];
  expect(appointment?.customer?.id).toBeTruthy();

  await page.goto('/customers');
  const link = page.getByRole('link', { name: 'Тест Карточка Клиента', exact: true });
  await expect(link).toHaveAttribute('href', `/customers/${appointment.customer.id}`);
  await link.click();

  await expect(page).toHaveURL(`/customers/${appointment.customer.id}`, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Тест Карточка Клиента' })).toBeVisible();
  await page.getByRole('tab', { name: /История записей/ }).click();
  const history = page.getByRole('tabpanel', { name: /История записей/ }).getByRole('table');
  await expect(history).toContainText('Тест стрижка');
  await expect(history).toContainText('Тест Анна');
  await expect(history).toContainText('12 000 ₸');

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const foreignScope = pointer(fixture.otherBusiness, fixture.locations[2]);
  const foreignResponse = await request.get(`${api}/beauty/customers/${appointment.customer.id}`, {
    headers: { 'x-wetop-scope': foreignScope },
  });
  expect(foreignResponse.status()).toBe(404);

  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(foreignScope),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  const response = await page.goto(`/customers/${appointment.customer.id}`);
  if (!response) throw new Error('Customer card navigation returned no document response');
  const html = await response.text();
  expect(html).not.toContain('Тест Карточка Клиента');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Страница не найдена');
  await expect(page.getByText('Тест Карточка Клиента', { exact: true })).toHaveCount(0);
});
