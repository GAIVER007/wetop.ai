import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API } from './fixtures';

/**
 * Карточка гостя и новая бронь из неё («Гости v2», 27.09.2026; план plans/guests-v2-2026-09-27.md).
 *
 * Список гостей (чипы, таблица, панель предпросмотра, отборы, пустые состояния) с 09.10.2026 другой экран,
 * «Гости и бронирования», и проверяется в `guests-bookings.spec.ts`. Здесь остались полная карточка человека
 * (обзор, история, документы, финансы) и путь «новая бронь этому же гостю», которые экран не менял.
 */
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/control`, { data: {} });
});

test('гости: полная карточка — обзор, вся история, «Редактировать» (G4)', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');

  // живёт, приезжал дважды и уже забронировал следующий визит: «Обзор» открыт первым
  await page.goto('/guests/ui-guest-GCRET0');
  await expect(main.getByRole('tab', { name: 'Обзор', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // визиты — состоявшиеся проживания: будущая бронь визитом не считается (ТЗ §19)
  await expect(main.getByTestId('guest-visits')).toHaveText('3 визита · 8 ночей');
  const now = main.getByTestId('guest-stay-current');
  await expect(now).toContainText('R08');
  await expect(now).toContainText('к оплате');
  await expect(now.getByRole('link', { name: 'Открыть бронь', exact: true })).toHaveAttribute(
    'href',
    '/reservations/20260916-GCRET2',
  );
  // следующий визит говорит, подтверждена ли бронь; долг будущей брони здесь не показан (Q-202)
  const next = main.getByTestId('guest-stay-next');
  await expect(next).toContainText('R12');
  await expect(next).toContainText('Подтверждена');
  await expect(next).not.toContainText('к оплате');
  await expect(next.getByRole('link', { name: 'Открыть бронь', exact: true })).toHaveAttribute(
    'href',
    '/reservations/20260916-GCRET3',
  );
  // на «Обзоре» — три свежих проживания и путь ко всей истории
  await expect(main.getByRole('tabpanel').getByTestId('guest-stay-row')).toHaveCount(3);
  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await main.getByRole('link', { name: 'Все проживания (4)', exact: true }).click();
  await expect(main.getByRole('tab', { name: 'Проживания', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // история (ТЗ §21): свежие сверху; источник брони, сумма по счёту и слово о брони
  const rows = main.getByRole('tabpanel').getByTestId('guest-stay-row');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('Подтверждена');
  await expect(rows.nth(1)).toContainText('Проживает');
  await expect(rows.nth(2)).toContainText('Сайт');
  await expect(rows.nth(3)).toContainText('Booking.com');
  await expect(rows.nth(3)).toContainText('Выехал');
  await expect(rows.nth(3)).toContainText('12 000 ₸');
  // строка ведёт в бронь
  await rows.nth(3).getByRole('link').first().click();
  await expect(page).toHaveURL(/\/reservations\/20260916-GCRET0$/);

  // только отменённая бронь: ни «сейчас», ни «следующего»; в истории — бронь словом, суммы нет
  await page.goto('/guests/ui-guest-GCCAN0');
  await expect(main.getByTestId('guest-stay-current')).toHaveCount(0);
  await expect(main.getByTestId('guest-stay-next')).toHaveCount(0);
  await expect(main.getByTestId('guest-visits')).toHaveText('0 визитов · 0 ночей');
  const cancelled = main.getByRole('tabpanel').getByTestId('guest-stay-row');
  await expect(cancelled).toHaveCount(1);
  await expect(cancelled).toContainText('Отменена');
  await expect(cancelled.locator('td').nth(3)).toHaveText('—');

  // «Редактировать» — профиль и документы на вкладке «Данные гостя», адрес помнит вкладку
  await main.getByRole('link', { name: 'Редактировать', exact: true }).click();
  await expect(main.getByTestId('guest-form')).toBeVisible();
  await expect(page).toHaveURL(/#guest-profile$/);
});

test('гости: документы и финансовый свод гостя (G5)', async ({ page, request }) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');

  // документы — своя вкладка: тип, номер маской, страна и даты словами
  await page.goto('/guests/ui-guest-GCRET0#guest-documents');
  const docs = main.getByRole('tabpanel').getByTestId('document-row');
  await expect(docs).toHaveCount(1);
  await expect(docs).toContainText('удостоверение личности');
  await expect(docs).toContainText('•••• 1234');
  await expect(docs).toContainText('действителен до 15.03.2032');
  await expect(docs.getByText('просрочен', { exact: true })).toHaveCount(0);
  // полного номера, ИИН и расшифровки в карточке нет — только маска
  await expect(main.getByRole('tabpanel')).not.toContainText(/\d{6,}/);

  // финансы (ТЗ §24): свод по счетам всех проживаний и разбивка по проживаниям
  await main.getByRole('tab', { name: 'Финансы', exact: true }).click();
  const summary = main.getByTestId('guest-finance-summary');
  await expect(summary).toContainText('Начислено');
  await expect(summary).toContainText('48 000 ₸');
  await expect(summary).toContainText('Оплачено');
  await expect(summary).toContainText('32 000 ₸');
  await expect(summary).toContainText('к оплате');
  await expect(summary).toContainText('16 000 ₸');
  // состав суммы назван честно, пока владелец не решил, что из неё долг (Q-202)
  await expect(main.getByRole('tabpanel')).toContainText('включая будущие брони');
  const rows = main.getByRole('tabpanel').getByTestId('guest-finance-row');
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toContainText('Подтверждена');
  await expect(rows.first()).toContainText('к оплате');
  await expect(rows.first().getByRole('link').first()).toHaveAttribute(
    'href',
    '/reservations/20260916-GCRET3#booking-finance',
  );
  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);

  // истёкший документ помечен словом: без него гостя не заселить
  await page.goto('/guests/ui-guest-GCOLD0#guest-documents');
  const old = main.getByRole('tabpanel').getByTestId('document-row');
  await expect(old).toContainText('•••• 7788');
  await expect(old.getByText('просрочен', { exact: true })).toBeVisible();

  // только отменённая бронь: счетов нет — пустое состояние словами, без нулевого свода
  await page.goto('/guests/ui-guest-GCCAN0#guest-finance');
  await expect(main.getByRole('tabpanel')).toContainText('Счетов пока нет');
  await expect(main.getByTestId('guest-finance-summary')).toHaveCount(0);
});

test('гости: новая бронь этому же гостю — из карточки и по телефону, второго гостя нет (G6)', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');
  const lastCreate = async () => {
    const commands = (await (await request.get(`${fixture}/__test/commands`)).json()) as Array<{
      path: string;
      body: Record<string, unknown>;
    }>;
    return commands.filter((c) => c.path === '/reservations').at(-1)?.body ?? {};
  };

  // §33: «Новая бронь» в карточке — форма уже с этим гостем, полей нового гостя нет
  await page.goto('/guests/ui-guest-GCRET0');
  await main.getByRole('link', { name: 'Новая бронь', exact: true }).click();
  await expect(page).toHaveURL(/\/reservations\/new\?guest=ui-guest-GCRET0$/);
  const form = page.getByTestId('new-reservation-form');
  const picked = form.getByTestId('booking-guest');
  await expect(picked).toContainText('Возвращающийся Гость');
  await expect(picked).toContainText('+77010000042');
  await expect(picked).toContainText('3 визита');
  for (const name of ['firstName', 'lastName', 'middleName', 'email', 'phone'])
    await expect(form.locator(`[name="${name}"]`)).toHaveCount(0);
  await expect(form.getByTestId('booking-summary')).toContainText('Возвращающийся Гость');
  const audit = await new AxeBuilder({ page })
    .include('[data-testid="new-reservation-form"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await form.getByText('Дополнительно', { exact: true }).click();
  await form.locator('details.booking-create__extras').evaluate((d) => {
    (d as HTMLDetailsElement).open = true;
  });
  await form.locator('[name="source"]').selectOption('PHONE');
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);
  const created = await lastCreate();
  expect(created['guestId']).toBe('ui-guest-GCRET0');
  expect(created).not.toHaveProperty('guest');
  // у того же человека стало пять проживаний — новый гость не появился
  await page.goto('/guests/ui-guest-GCRET0#guest-stays');
  await expect(main.getByRole('tabpanel').getByTestId('guest-stay-row')).toHaveCount(5);
  await page.goto('/guests?q=Возвращающийся');
  await expect(main.getByTestId('guests-table').getByRole('row')).toHaveCount(2);

  // «Другой гость» — та же форма без выбора и без перехода; адрес больше не несёт гостя
  await page.goto('/reservations/new?guest=ui-guest-GCRET0');
  await form.getByRole('button', { name: 'Другой гость', exact: true }).click();
  await expect(page).not.toHaveURL(/guest=/);
  await expect(page.getByTestId('new-reservation-form')).toHaveCount(1);
  await expect(form.getByTestId('booking-guest')).toHaveCount(0);
  await expect(form.locator('[name="lastName"]')).toBeVisible();

  // §34: набран полный телефон — сначала известный гость; «Выбрать» переключает шаг «Гость»
  await form.locator('[name="phone"]').fill('+7 701 000 00');
  await expect(form.getByTestId('guest-matches')).toHaveCount(0);
  await form.locator('[name="phone"]').fill('+77010000042');
  const matches = form.getByTestId('guest-matches');
  await expect(matches.getByTestId('guest-match')).toHaveCount(1);
  await expect(matches).toContainText('Возвращающийся Гость');
  // визиты — состоявшиеся проживания: только что созданная бронь визитом ещё не стала
  await expect(matches).toContainText('3 визита');
  await matches.getByRole('button', { name: 'Выбрать', exact: true }).click();
  await expect(form.getByTestId('booking-guest')).toContainText('Возвращающийся Гость');
  await expect(form.locator('[name="phone"]')).toHaveCount(0);
  // Смена дат сохраняет выбранного гостя без перезагрузки.
  await form.getByRole('button', { name: '3 ночи', exact: true }).click();
  await expect(form.getByTestId('availability')).toContainText('3 ночи');
  await expect(form.getByTestId('booking-guest')).toContainText('Возвращающийся Гость');
  // передумал — снова поля нового гостя
  await form.getByRole('button', { name: 'Другой гость', exact: true }).click();
  await expect(form.locator('[name="lastName"]')).toBeVisible();
  await expect(form.locator('[name="phone"]')).toHaveValue('');
  await expect(form.getByTestId('guest-matches')).toHaveCount(0);

  // ссылка на гостя, которого нет: предупреждение и обычная форма
  await page.goto('/reservations/new?guest=ui-guest-missing');
  await expect(page.getByTestId('booking-guest-missing')).toContainText('не найден');
  await expect(form.locator('[name="lastName"]')).toBeVisible();
});

