import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fixture = 'http://127.0.0.1:4311';
const shots = 'reports/categories-v2-c2-2026-09-28';
const asClient = { headers: { 'x-wetop-test-client': '1' } };
const hideDevOverlay = (page: Page) =>
  page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

/**
 * «Категории v2» C2 (ADR-109, ТЗ §7, §9, §40): по строке открывается панель категории — что продаём,
 * вместимость, состав, тарифы по именам, переходы в фонд, тарифы, шахматку; режим «Карточки» ведёт
 * в ту же панель. Состав в панели не редактируется — он живёт в «Номерах и койках» (ТЗ §41).
 */
test('categories C2: quick preview from row, menu and card; cards view; light/dark/mobile', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await request.post(`${fixture}/__test/reset`);
  const withWindow = await request.post(`${fixture}/inventory/categories`, {
    ...asClient,
    data: {
      name: 'Одноместная комната с окном',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
      ratePlanCode: 'BASE',
    },
  });
  const { code } = (await withWindow.json()) as { code: string };
  await request.post(`${fixture}/inventory/rooms`, {
    ...asClient,
    data: { categoryCode: code, building: 'Основной', floor: '2', roomNumber: 'W01', codes: ['W01'] },
  });
  await request.post(`${fixture}/inventory/categories`, {
    ...asClient,
    data: {
      name: 'Одноместная комната без окон',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
      ratePlanLater: true,
    },
  });

  await page.goto('/rooms/categories');
  await hideDevOverlay(page);
  const rows = page.getByTestId('fund-category-row');
  await expect(rows).toHaveCount(5);

  // BED: число коек без списка из 36 кодов, тариф по имени, переходы — в свои модули
  await rows.filter({ hasText: 'Мужской общий номер' }).getByRole('button', { name: 'Мужской общий номер', exact: true }).click();
  const bed = page.getByRole('dialog', { name: 'Мужской общий номер' });
  await expect(bed).toBeVisible();
  await expect(bed).toContainText('Койко-место');
  await expect(bed).toContainText('36 коек');
  await expect(bed).toContainText('1 гость на койко-место');
  await expect(bed).toContainText('Стандартный');
  await expect(bed).not.toContainText('M01');
  await expect(bed.getByRole('link', { name: 'Открыть весь состав' })).toHaveAttribute(
    'href',
    '/inventory?category=MALE',
  );
  await expect(bed.getByRole('link', { name: 'Настроить тарифы' })).toHaveAttribute(
    'href',
    '/rates?category=MALE',
  );
  await expect(bed.getByRole('link', { name: 'Открыть в шахматке' })).toHaveAttribute(
    'href',
    '/chessboard?category=MALE',
  );
  await expect(bed.getByRole('button', { name: 'Добавить комнату с койками' })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: `${shots}/preview-bed-light-1440.png` });
  await page.keyboard.press('Escape');
  await expect(bed).not.toBeVisible();

  // ROOM: небольшой состав виден кодами прямо в панели
  await rows
    .filter({ hasText: 'Одноместная комната с окном' })
    .getByRole('button', { name: 'Одноместная комната с окном', exact: true })
    .click();
  const room = page.getByRole('dialog', { name: 'Одноместная комната с окном' });
  await expect(room).toContainText('Номер целиком');
  await expect(room).toContainText('1 гость');
  await expect(room.getByRole('link', { name: 'Номер W01' })).toHaveAttribute('href', '/units/W01');
  await expect(room.getByRole('button', { name: 'Добавить номер' })).toBeVisible();
  await page.screenshot({ path: `${shots}/preview-room-light-1440.png` });
  await page.keyboard.press('Escape');

  // Без фонда и без тарифа — сказано словами, что делать (ТЗ §35)
  await page
    .getByRole('button', { name: 'Действия с категорией Одноместная комната без окон' })
    .click();
  await page.getByRole('menuitem', { name: 'Открыть', exact: true }).click();
  const bare = page.getByRole('dialog', { name: 'Одноместная комната без окон' });
  await expect(bare).toContainText('Номерной фонд ещё не добавлен');
  await expect(bare).toContainText('Тариф не настроен');
  // «Добавить номер» из панели открывает прежнюю форму с этой категорией
  await bare.getByRole('button', { name: 'Добавить номер' }).click();
  const add = page.getByRole('dialog', { name: 'Добавить размещение' });
  await expect(add).toBeVisible();
  await expect(add.getByLabel('Категория')).toHaveValue(/test-category/);
  await add.getByRole('button', { name: 'Отмена' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Режим «Карточки»: по умолчанию список, выбор запоминается в адресе, карточка ведёт в ту же панель
  const view = page.getByRole('group', { name: 'Вид списка категорий' });
  await expect(view.getByRole('button', { name: 'Список' })).toHaveAttribute('aria-pressed', 'true');
  await view.getByRole('button', { name: 'Карточки' }).click();
  await expect(page).toHaveURL(/view=cards/);
  await expect(rows).toHaveCount(0);
  const cards = page.getByTestId('fund-category-card');
  await expect(cards).toHaveCount(5);
  await page.screenshot({ path: `${shots}/cards-light-1440.png`, fullPage: true });
  await cards.filter({ hasText: 'Женский общий номер' }).click();
  await expect(page.getByRole('dialog', { name: 'Женский общий номер' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Тёмная тема: карточки и панель
  await page.evaluate(() => localStorage.setItem('wetop.theme', 'dark'));
  await page.reload();
  await hideDevOverlay(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(cards).toHaveCount(5);
  await page.screenshot({ path: `${shots}/cards-dark-1440.png`, fullPage: true });
  await cards.filter({ hasText: 'Мужской общий номер' }).click();
  await expect(page.getByRole('dialog', { name: 'Мужской общий номер' })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: `${shots}/preview-bed-dark-1440.png` });
  await page.keyboard.press('Escape');

  // Телефон: карточки в одну колонку, панель на всю ширину, без прокрутки вбок
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cards.first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${shots}/cards-dark-mobile-390.png`, fullPage: true });
  await cards.filter({ hasText: 'Одноместная комната с окном' }).click();
  await expect(page.getByRole('dialog', { name: 'Одноместная комната с окном' })).toBeVisible();
  await page.screenshot({ path: `${shots}/preview-dark-mobile-390.png` });

  await page.evaluate(() => localStorage.setItem('wetop.theme', 'light'));
  await request.post(`${fixture}/__test/reset`);
});
