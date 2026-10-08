import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API } from './fixtures';

/**
 * «Гости v2» (27.09.2026, ТЗ владельца; план plans/guests-v2-2026-09-27.md).
 *
 * Прежний экран показывал брони на сегодня и подписывал гостя статусом брони («отменена») — то самое
 * смешение сущностей, которое ТЗ называет главной проблемой (§3, §15). Здесь проверяется новый
 * справочник: одна строка — один человек; разделы-чипы со счётчиками до нажатия; состояние гостя —
 * вычисленное слово («живёт», «ожидается», «выехал недавно»), а не статус брони; компактный
 * автопоиск без кнопки «Найти»; пустые состояния словами.
 */
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/control`, { data: {} });
});

test('гости: одна строка — один гость, разделы-чипы со счётчиками, состояние — слово о госте', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/guests');
  // 9 гостей фикстуры: 4 живут, 4 ожидаются (включая просроченный заезд TEST8), 1 выехал сегодня
  await expect(main.getByTestId('guests-meta')).toContainText('9 гостей');
  await expect(main.getByTestId('guests-table').locator('tbody tr')).toHaveCount(9);

  const chips = main.getByRole('navigation', { name: 'Гости по состоянию' });
  await expect(chips).toHaveClass(/chips/);
  for (const [label, count] of [
    ['Все', '9'],
    ['Проживают', '4'],
    ['Ожидаются', '4'],
    ['Недавние', '1'],
  ] as const) {
    await expect(chips.getByRole('link', { name: `${label} ${count}` })).toBeVisible();
  }
  // слово о госте, не статус брони: «Завершены» и «Проживают» из словаря броней в строках нет
  await expect(main.getByTestId('guests-table')).toContainText('живёт');
  await expect(main.getByTestId('guests-table')).toContainText('ожидается');
  await expect(main.getByText('Завершены', { exact: true })).toHaveCount(0);

  // раздел фильтрует и назван в выборке; бейджи строк совпадают с разделом
  await page.goto('/guests?state=inhouse');
  await expect(main.getByTestId('guests-meta')).toContainText('4 гостя, проживают');
  await expect(main.getByTestId('guests-table').locator('tbody tr')).toHaveCount(4);
  await expect(main.getByTestId('guests-table')).not.toContainText('ожидается');

  // старый адрес со статусом брони живёт в закладках — читается как раздел
  await page.goto('/guests?status=CHECKED_OUT');
  await expect(main.getByTestId('guests-meta')).toContainText('выехали за 30 дней');
  await expect(main.getByTestId('guests-table')).toContainText('выехал недавно');

  // строка ведёт в карточку человека, а колонка «Сейчас» показывает ячейку живущего
  await page.goto('/guests?state=inhouse');
  const row = main.getByTestId('guest-row').first();
  await expect(row.locator('.dir-unit')).toBeVisible();
  const chipHeight = await chips
    .getByRole('link', { name: /Проживают/ })
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(chipHeight).toBeGreaterThanOrEqual(38);
});

test('гости: кейсы владельца — несколько проживаний, только отменённая бронь, давний выезд', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');
  await page.goto('/guests');
  await expect(main.getByTestId('guests-table').locator('tbody tr')).toHaveCount(13);

  // три брони одного человека — одна строка: живёт, «Визитов 3», последний визит заполнен
  const returning = main.getByTestId('guest-row').filter({ hasText: 'Возвращающийся' });
  await expect(returning).toHaveCount(1);
  await expect(returning).toContainText('живёт');
  await expect(returning.locator('td').nth(4)).toHaveText(/(визитов )?3/);
  await expect(returning.locator('td').nth(3).locator('time')).toHaveCount(2);

  // только отменённая бронь — это статус брони, не человека: «—» и подпись словами (ТЗ §16)
  const cancelled = main.getByTestId('guest-row').filter({ hasText: 'Отменившийся' });
  await expect(cancelled).toContainText('бронь на');
  await expect(cancelled).toContainText('отменена');
  await expect(cancelled.locator('.badge')).toHaveCount(0);

  // выехал 40 дней назад: активного проживания нет и «Недавние» его не считают
  await expect(main.getByTestId('guest-row').filter({ hasText: 'Давний' })).toContainText('—');
  const chips = main.getByRole('navigation', { name: 'Гости по состоянию' });
  await expect(chips.getByRole('link', { name: 'Недавние 1' })).toBeVisible();
  await expect(chips.getByRole('link', { name: 'Проживают 6' })).toBeVisible();
});

test('гости: панель предпросмотра — сейчас, история и долг из счетов, переходы и Escape (G3)', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');
  // стоп-гейт п. 1: панель открывается из отфильтрованного раздела и возвращает тот же отбор
  await page.goto('/guests?state=inhouse');

  // живущий должник: состояние — слово у имени, где живёт — ячейка и дата, долг словом и суммой
  await main.getByRole('link', { name: /Задолжавший/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Гость', exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('.guest-preview__name')).toContainText('живёт');
  await expect(drawer.getByTestId('guest-preview-now')).toContainText('R11');
  await expect(drawer.getByTestId('guest-preview-now')).toContainText('до');
  await expect(drawer.getByTestId('guest-preview-finance')).toContainText('к оплате');
  await expect(drawer.getByTestId('guest-preview-finance')).toContainText('4 000 ₸');
  await expect(drawer.getByRole('link', { name: 'Открыть бронь', exact: true })).toHaveAttribute(
    'href',
    /\/reservations\/20260916-GCDEBT0/,
  );
  // стоп-гейт п. 2–3: действия на месте, документов и ИИН в предпросмотре нет — их показ пишется
  // в журнал и живёт на карточке
  await expect(drawer.getByRole('link', { name: 'Новая бронь' })).toBeVisible();
  await expect(drawer.getByText(/ИИН|Документ/)).toHaveCount(0);
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  // Escape закрывает панель и возвращает тот же раздел с тем же отбором
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/guests\?state=inhouse$/);

  // история одного человека: три визита, восемь ночей; «Назад» браузера — тоже возврат к отбору
  // точное имя: у гостя есть телефон (G6), и рядом с именем стоит ссылка «WhatsApp: …»
  await main.getByRole('link', { name: 'Возвращающийся Гость', exact: true }).click();
  const history = drawer.getByTestId('guest-preview-history');
  await expect(history).toContainText('Визитов');
  await expect(history).toContainText('3');
  await expect(history).toContainText('Ночей');
  await expect(history).toContainText('8');
  await page.goBack();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/guests\?state=inhouse$/);

  // только отменённая бронь: ложного «Сейчас» нет вовсе, подпись про бронь — в истории;
  // долга нет — раздел «Финансы» не занимает место (стоп-гейт пп. 4–5)
  await page.goto('/guests');
  await main.getByRole('link', { name: /Отменившийся/ }).click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId('guest-preview-history')).toContainText('отменена');
  await expect(drawer.getByTestId('guest-preview-now')).toHaveCount(0);
  await expect(drawer.getByText('Сейчас', { exact: true })).toHaveCount(0);
  await expect(drawer.getByTestId('guest-preview-finance')).toHaveCount(0);
  await expect(drawer.getByText(/Долга нет|Счетов пока нет/)).toHaveCount(0);
  await expect(drawer.getByRole('link', { name: 'Открыть бронь', exact: true })).toHaveCount(0);
  // крестик закрывает панель мышью — та же точка возврата
  await drawer.getByRole('button', { name: 'Закрыть: Гость' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/guests$/);

  // «Открыть гостя» — полная карточка с документами и историей
  await main.getByRole('link', { name: /Отменившийся/ }).click();
  await drawer.getByRole('link', { name: 'Открыть гостя', exact: true }).click();
  await expect(page).toHaveURL(/\/guests\/ui-guest-GCCAN0$/);
  await expect(main.getByTestId('guest-head')).toBeVisible();
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

test('гости: автопоиск без кнопки «Найти», имя — ссылка, пустые состояния словами', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.goto('/guests');
  // компактный поиск: поле с подсказкой, кнопки «Найти» больше нет (ТЗ §6, §48)
  const input = main.getByLabel('Поиск гостей');
  expect((await input.boundingBox())!.width).toBeGreaterThanOrEqual(280);
  await expect(main.getByRole('button', { name: 'Найти', exact: true })).toHaveCount(0);
  await input.fill('Демо');
  await page.waitForURL(/\/guests\?q=%D0%94%D0%B5%D0%BC%D0%BE|\/guests\?q=Демо/);
  await expect(main.getByTestId('guests-meta')).toContainText('по запросу «Демо»');
  await expect(main.getByTestId('guests-table').locator('tbody tr')).toHaveCount(2);

  // имя гостя отличается от обычного текста: ссылка подчёркивается под курсором и в фокусе
  const guest = main.getByTestId('guests-table').getByRole('link').first();
  await guest.hover();
  await expect(guest).toHaveCSS('text-decoration-line', 'underline');
  // имя читается от левого края ячейки: старый класс `.directory-guest` центрировал его (21.09)
  const offset = await guest.evaluate(
    (el) => el.getBoundingClientRect().left - el.closest('td')!.getBoundingClientRect().left,
  );
  expect(offset, 'имя гостя не прижато к левому краю ячейки').toBeLessThanOrEqual(16);

  // пустой результат отбора: что пусто и что сделать, шапки таблицы над пустотой нет
  await page.goto('/guests?q=Нетакого');
  await expect(main.getByTestId('guests-empty')).toContainText('Ничего не найдено');
  await expect(main.getByTestId('guests-table')).toHaveCount(0);
  await expect(main.getByRole('columnheader')).toHaveCount(0);

  // пустая база: гостей нет вовсе — свой текст и путь к первой брони (ТЗ §42)
  await request.post(`${fixture}/__test/control`, { data: { noBookings: true } });
  await page.goto('/guests');
  await expect(main.getByTestId('guests-none')).toContainText('Гостей пока нет');
  await expect(
    main.getByTestId('guests-none').getByRole('link', { name: 'Новая бронь' }),
  ).toBeVisible();

  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
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
  await form.locator('details.booking-create__extras').evaluate((d) => { (d as HTMLDetailsElement).open = true; });
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

test('гости: отборы по визиту и числу визитов, порядок, всё в адресе (G7)', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');
  const table = main.getByTestId('guests-table');
  const filters = main.getByTestId('guests-filters');

  // четвёртый раздел: не живёт, не ожидается и не выезжал за 30 дней — число видно до нажатия
  await page.goto('/guests');
  const none = main.getByRole('link', { name: /Без активного проживания/ });
  await expect(none.locator('.chips__count')).not.toHaveText('0');
  await none.click();
  await expect(page).toHaveURL(/\/guests\?state=none$/);
  await expect(table).toContainText('Отменившийся');
  await expect(table).toContainText('Давний');
  await expect(table).not.toContainText('Возвращающийся');

  // последний визит за 30 дней и 2–5 визитов: остаётся тот, кто приезжал трижды
  await page.goto('/guests');
  await filters.getByRole('button', { name: 'Фильтры', exact: true }).click();
  await filters.getByRole('combobox', { name: 'Последний визит', exact: true }).selectOption('30d');
  await filters.getByRole('combobox', { name: 'Визитов', exact: true }).selectOption('2-5');
  await filters.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL(/\/guests\?last=30d&visits=2-5$/);
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table).toContainText('Возвращающийся');
  await expect(main.getByTestId('guests-meta')).toContainText(
    'последний визит за 30 дней, 2–5 визитов',
  );
  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);

  // смена раздела и поиск уносят отбор с собой; «Назад» возвращает прежний вид
  await main.getByRole('link', { name: /Проживают/ }).click();
  await expect(page).toHaveURL(/\/guests\?state=inhouse&last=30d&visits=2-5$/);
  await main.getByRole('searchbox', { name: 'Поиск гостей' }).fill('Возвр');
  await expect(page).toHaveURL(/state=inhouse&last=30d&visits=2-5&q=/);
  await expect(table).toContainText('Возвращающийся');
  // поиск заменяет запись истории, а не копит её: «Назад» — к виду до смены раздела
  await page.goBack();
  await expect(page).toHaveURL(/\/guests\?last=30d&visits=2-5$/);
  await expect(table).toContainText('Возвращающийся');

  // порядок: больше визитов — выше
  await page.goto('/guests?sort=visits');
  await expect(table.getByRole('row').nth(1)).toContainText('Возвращающийся');
  await expect(filters.getByRole('combobox', { name: 'Порядок', exact: true })).toHaveValue(
    'visits',
  );

  // период с–по виден, когда выбран «период»; даты едут в адрес
  await page.goto('/guests');
  await expect(filters.getByLabel('Последний визит: с', { exact: true })).toBeHidden();
  await filters.getByRole('button', { name: 'Фильтры', exact: true }).click();
  await filters
    .getByRole('combobox', { name: 'Последний визит', exact: true })
    .selectOption('period');
  await expect(filters.getByLabel('Последний визит: с', { exact: true })).toBeVisible();
  await page.goto('/guests?last=period&from=2020-01-01&to=2020-01-31');
  await expect(main.getByTestId('guests-empty')).toContainText('Ничего не найдено');
  await expect(main.getByTestId('guests-meta')).toContainText('последний визит 01.01 → 31.01.2020');

  // опечатка в адресе — слово об ошибке и полный список, а не молча другой отбор
  await page.goto('/guests?visits=5%2B');
  await expect(main.getByRole('alert')).toContainText('Неизвестный отбор по числу визитов');
  await main.getByRole('link', { name: 'Сбросить фильтры' }).first().click();
  await expect(page).toHaveURL(/\/guests$/);
});

test('гости: плотная строка поиска и отборов, ошибка словами, визиты словом на телефоне (G8)', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');

  // §47: поиск и отборы — одна строка над таблицей; лупа стоит внутри поля, по его середине
  await page.goto('/guests');
  const search = main.getByRole('searchbox', { name: 'Поиск гостей' });
  const show = main.getByTestId('guests-filters').getByRole('button', { name: 'Показать' });
  const [s, b] = [(await search.boundingBox())!, (await show.boundingBox())!];
  expect(Math.abs(s.y + s.height / 2 - (b.y + b.height / 2))).toBeLessThanOrEqual(4);
  const icon = (await main.locator('.guests-toolbar .search-field > svg').boundingBox())!;
  expect(icon.y).toBeGreaterThanOrEqual(s.y);
  expect(icon.y + icon.height).toBeLessThanOrEqual(s.y + s.height);
  // итог выдачи — живая область: автопоиск меняет его без перехода фокуса
  await expect(main.getByTestId('guests-meta')).toHaveAttribute('role', 'status');

  // §43: сбой API — что не загрузилось и «Повторить», разделы и поиск остаются
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guests/directory' } });
  await page.goto('/guests');
  const error = main.getByTestId('guests-error');
  await expect(error).toContainText('Не удалось загрузить гостей');
  await expect(error.getByRole('button', { name: 'Повторить загрузку' })).toBeVisible();
  await expect(main.getByRole('searchbox', { name: 'Поиск гостей' })).toBeVisible();
  await request.post(`${fixture}/__test/control`, { data: {} });
  await request.post(`${fixture}/__test/guest-cases`);

  // §46: на телефоне строка — карточка, визиты словом, а не «визитов 3»
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/guests?q=Возвращающийся');
  const card = main.getByTestId('guests-table').getByRole('row').nth(1);
  await expect(card).toContainText('3 визита');
  await expect(card).not.toContainText('визитов 3');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
