import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { api, date, seed , nextDate } from './tz11-helpers';
const evidence = process.env.ZAPIS_EVIDENCE || 'test-results/zapis-report';

test('report: centered multi-service appointment, per-master occupancy and exact payment', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  const f = await seed(page, request);
  await page.goto(`/calendar?date=${date}`);
  const timeline = page.getByTestId('beauty-grid').locator('.beauty-col-body').first();
  const normalHeight = (await timeline.boundingBox())!.height;
  const compact = page.getByRole('button', { name: 'Компактный вид', exact: true });
  await compact.click();
  await expect(compact).toHaveAttribute('aria-pressed', 'true');
  expect((await timeline.boundingBox())!.height).toBeLessThan(normalHeight);
  await page.getByRole('button', { name: 'Тест Анна, 10:00, свободно', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Новая запись', exact: true });
  await expect(form).toBeVisible();
  const box = await form.boundingBox();
  expect(box).toBeTruthy();
  expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThan(3);
  await form.getByLabel('Имя клиента', { exact: true }).fill('Тестовый клиент отчёта');
  await form.getByLabel('Услуга', { exact: true }).selectOption(f.services[0]!.id);
  await form.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  await form.getByLabel('Услуга 2', { exact: true }).selectOption(f.services[1]!.id);
  await form.getByLabel('Специалист услуги 2', { exact: true }).selectOption(f.employees[1]!.id);
  await form.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  await form.getByLabel('Услуга 3', { exact: true }).selectOption(f.services[0]!.id);
  await form.getByLabel('Специалист услуги 3', { exact: true }).selectOption(f.employees[0]!.id);
  await form.getByLabel('Часы услуги 1', { exact: true }).selectOption('0');
  await form.getByLabel('Минуты услуги 1', { exact: true }).selectOption('45');
  await form.getByText('Скидка и доплата', { exact: true }).first().click();
  await form.getByLabel('Тип скидки услуги 1', { exact: true }).selectOption('percent');
  await form.getByLabel('Скидка услуги 1', { exact: true }).fill('10');
  await expect(form.getByText('Итого:', { exact: false })).toContainText('34 800');
  mkdirSync(evidence, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(form).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
    await page.screenshot({
      path: `${evidence}/appointment-${width}.png`,
      fullPage: true,
    });
  }
  await form.getByRole('button', { name: 'Записать', exact: true }).click();
  await expect(form).toBeHidden();
  const response = await request.get(`${api}/beauty/appointments?date=${date}`, {
    headers: f.headers,
  });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const row = data.appointments.find(
    (item: { customer: { name: string } }) => item.customer.name === 'Тестовый клиент отчёта',
  );
  expect(row.items).toHaveLength(3);
  expect(row.items[0]).toMatchObject({
    durationMinutes: 45,
    discountPercent: 10,
    discountMinor: '120000',
    priceMinor: '1080000',
  });
  expect(row.items[1]).toMatchObject({ discountMinor: '0', priceMinor: '1200000' });
  expect(row.items[2]).toMatchObject({ discountMinor: '0', priceMinor: '1200000' });
  expect(new Date(row.endsAt).getTime() - new Date(row.startsAt).getTime()).toBe(165 * 60000);
  expect(row.items.map((item: { employeeId: string }) => item.employeeId)).toEqual([
    f.employees[0]!.id,
    f.employees[1]!.id,
    f.employees[0]!.id,
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Быстрый отчёт', exact: true }).click();
  const stats = page.getByRole('dialog', { name: /^Статистика за/ });
  await expect(stats).toBeVisible();
  const discountRow = stats.locator('.reference-row').filter({
    has: page.getByText('Скидка (сумма)', { exact: true }),
  });
  await expect(discountRow).toContainText('1 200');
  const statsBox = await stats.boundingBox();
  expect(Math.abs(statsBox!.x + statsBox!.width / 2 - 720)).toBeLessThan(3);
  await page.screenshot({
    path: `${evidence}/day-statistics-1440.png`,
    fullPage: true,
  });
  await stats.getByRole('button', { name: /^Закрыть:/ }).click();
  await page.goto(`/calendar?date=${date}&appointment=${row.id}`);
  const card = page.getByRole('dialog', { name: 'Запись', exact: true });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Тест стрижка');
  await expect(card).toContainText('Тест укладка');
  await card.getByLabel('Сумма, ₸', { exact: true }).fill('123,45');
  await card.getByRole('button', { name: 'Принять оплату', exact: true }).click();
  await expect(card).toBeHidden({ timeout: 20000 });
  const after = await (
    await request.get(`${api}/beauty/appointments?date=${date}`, { headers: f.headers })
  ).json();
  expect(after.appointments.find((item: { id: string }) => item.id === row.id).paidMinor).toBe(
    '12345',
  );
  await page.goto(`/calendar?date=${date}&appointment=${row.id}`);
  await card.getByRole('button', { name: 'История изменений', exact: true }).click();
  await expect(card.getByText('Оплата добавлена', { exact: true })).toBeVisible();
  await expect(card.getByText('Запись создана', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Повторить запись', exact: true }).click();
  const repeated = page.getByRole('dialog', { name: 'Новая запись', exact: true });
  await expect(repeated.getByLabel('Клиент', { exact: true })).toHaveValue(row.customer.id);
  await expect(repeated.getByLabel('Услуга 3', { exact: true })).toHaveValue(f.services[0]!.id);
  await repeated.locator('input[type="date"]').fill('2026-10-23');
  await repeated.getByRole('button', { name: 'Записать', exact: true }).click();
  await expect(repeated).toBeHidden();
  const repeatedDay = await (
    await request.get(`${api}/beauty/appointments?date=2026-10-23`, { headers: f.headers })
  ).json();
  const newVisit = repeatedDay.appointments.find(
    (item: { customer: { id: string } }) => item.customer.id === row.customer.id,
  );
  expect(newVisit.id).not.toBe(row.id);
  expect(newVisit.paidMinor).toBe('0');
  expect(newVisit.items).toHaveLength(3);
  const originalDay = await (
    await request.get(`${api}/beauty/appointments?date=${date}`, { headers: f.headers })
  ).json();
  expect(originalDay.appointments.find((item: { id: string }) => item.id === row.id)).toMatchObject(
    { paidMinor: '12345', priceMinor: row.priceMinor },
  );
  await f.call('/beauty/appointments', {
    employeeId: f.employees[0]!.id,
    serviceId: f.services[0]!.id,
    startsAt: `${nextDate}T10:00:00+05:00`,
    firstName: 'Тестовый клиент периода',
  });
  await page.goto(`/appointments?date=${date}`);
  await page.getByLabel('Период с', { exact: true }).fill(date);
  await page.getByLabel('Период по', { exact: true }).fill(nextDate);
  await page.getByRole('button', { name: 'Показать период', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Тестовый клиент отчёта', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Тестовый клиент периода', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidence}/appointments-period-1440.png`,
    fullPage: true,
  });
  await page.goto('/services');
  const catalog = page.locator('[data-service-list="catalog"]');
  await catalog
    .getByRole('button', { name: 'Настроить и добавить в филиал: Стрижка мужская', exact: true })
    .click();
  const serviceForm = page.getByRole('dialog').filter({ visible: true });
  await expect(serviceForm.getByLabel('Название', { exact: true })).toHaveValue('Стрижка мужская');
  await expect(serviceForm.getByLabel(/Цена каталога/)).toHaveValue('');
  await serviceForm.getByLabel(/Цена каталога/).fill('35.50');
  await serviceForm.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(serviceForm.getByRole('status')).toContainText('Услуга создана');
  await serviceForm.getByRole('button', { name: 'Сохранить для филиала', exact: true }).click();
  await expect(
    serviceForm.getByRole('status').filter({ hasText: 'Настройки филиала сохранены' }),
  ).toBeVisible();
  await serviceForm.getByRole('button', { name: /^Закрыть:/ }).click();
  await expect(
    page.locator('[data-service-list="salon"]').getByText('Стрижка мужская', { exact: true }),
  ).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
    await page.screenshot({ path: `${evidence}/services-${width}.png`, fullPage: true });
  }
});
