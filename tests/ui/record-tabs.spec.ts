import { expect, test, type Locator, type Page, FIXTURE_API } from './fixtures';
import { cardTab } from '../e2e/card-tabs';

/**
 * Вкладки карточки (`components/record-tabs.tsx`): открытая вкладка живёт в адресе после `#`, а выбор человека
 * не перебивается перерисовкой с сервера.
 *
 * Гонка из полного UI-набора 28.09.2026 (`manager-actions.spec.ts:138`, лог 2026-09-28T18-08-55Z-e2e-4673.log):
 * ответ действия «Отметить незаезд» пришёл, пока шёл клик по «Обзору»; роутер Next применил состояние со старым
 * адресом (`#booking-actions`), а вкладки на новой разметке с сервера перечитали адрес и вернули «Действия».
 * В точные миллисекунды тест не попадает, поэтому первый тест воспроизводит сам ингредиент: пока человек уже на
 * «Обзоре», роутер записывает старый адрес — и тут же приходит свежая разметка карточки с сервера.
 */
const fixture = FIXTURE_API;
const BOOKING = '20260913-TESTAA';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

const tab = (scope: Page | Locator, name: string) =>
  scope
    .getByRole('tablist', { name: 'Разделы карточки брони' })
    .getByRole('tab', { name, exact: true });

/** Два кадра после применения: эффекты React к этому времени отработали */
const afterPaint = (page: Page) =>
  page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );

test('выбор вкладки держится, когда роутер пишет старый адрес на перерисовке с сервера', async ({
  page,
}) => {
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  const form = page.getByRole('main').getByTestId('edit-reservation-form');
  await form.locator('textarea[name="notes"]').fill('Поздний заезд после 23:00');

  await cardTab(page, 'Обзор');
  await expect(page).toHaveURL(/#booking-overview$/);
  await afterPaint(page);
  // Запоздалый ответ действия: роутер применяет состояние с адресом, с которым действие стартовало. Каждая его
  // запись адреса (`__NA` — служебная метка Next) отсюда пишет «Действия», как при гонке
  await page.evaluate(() => {
    const original = history.replaceState.bind(history);
    const w = window as unknown as { staleWrites: number };
    w.staleWrites = 0;
    history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
      if ((data as { __NA?: boolean } | null)?.__NA && String(url).endsWith('#booking-overview')) {
        w.staleWrites += 1;
        return original(data, unused, String(url).replace('#booking-overview', '#booking-actions'));
      }
      return original(data, unused, url);
    };
  });
  // свежая разметка карточки с сервера: сохранение заметок делает revalidatePath карточки
  await form.evaluate((f) => (f as HTMLFormElement).requestSubmit());
  await expect
    .poll(async () =>
      (await (await page.request.get(`${fixture}/__test/commands`)).json()).some(
        (c: { body: { notes?: string } }) => c.body.notes === 'Поздний заезд после 23:00',
      ),
    )
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { staleWrites: number }).staleWrites))
    .toBeGreaterThan(0);
  await afterPaint(page);

  await expect(tab(page, 'Обзор')).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('main').getByTestId('stay-row').first().getByRole('cell').first(),
  ).toBeVisible();
});

test('ссылка с другой страницы открывает вкладку из адреса: гость → «Счета» брони', async ({
  page,
}) => {
  await page.goto('/guests/ui-guest');
  // вкладка карточки гостя со счетами проживаний — «Финансы» с G5 (PR #122), до неё звалась «Счета и услуги»
  await page
    .getByRole('tablist', { name: 'Разделы карточки гостя' })
    .getByRole('tab', { name: 'Финансы', exact: true })
    .click();
  const link = page.getByRole('main').locator(`a[href="/reservations/${BOOKING}#booking-finance"]`);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/reservations/${BOOKING}#booking-finance$`));
  await expect(tab(page, 'Счета')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#booking-finance')).toBeVisible();
});

test('якорь внутри карточки переключает вкладку: «Продлить или переселить» → «Действия»', async ({
  page,
}) => {
  await page.goto(`/reservations/${BOOKING}`);
  await expect(tab(page, 'Обзор')).toHaveAttribute('aria-selected', 'true');
  await page
    .getByRole('main')
    .getByTestId('booking-next')
    .getByRole('link', { name: 'Продлить или переселить' })
    .click();
  await expect(tab(page, 'Действия')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/#booking-actions$/);
  await expect(page.getByRole('main').getByTestId('edit-reservation-form')).toBeVisible();
});

test('переход между бронями без перезагрузки открывает вкладку из адреса — и из карточки, и внутри панели', async ({
  page,
  request,
}) => {
  // вторая и третья брони стенда — из витрины (`showcase`)
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  const push = (href: string) =>
    page.evaluate((to) => {
      (window as unknown as { next: { router: { push: (h: string) => void } } }).next.router.push(to);
    }, href);
  // Клиентский переход, как по ссылке: бронь открывается панелью «Бронирование» поверх карточки (@drawer)
  const drawer = page.getByRole('dialog', { name: 'Бронирование' });
  await push('/reservations/20260913-SHOWUN#booking-finance');
  await expect(drawer.getByRole('heading', { level: 1 })).toHaveText('Бронь 20260913-SHOWUN');
  await expect(tab(drawer, 'Счета')).toHaveAttribute('aria-selected', 'true');
  await expect(drawer.locator('#booking-finance')).toBeVisible();
  // из панели — на другую бронь той же панелью: вкладка берётся из нового адреса, а не остаётся от прежней брони
  await push('/reservations/20260913-SHOWTN#booking-actions');
  await expect(drawer.getByRole('heading', { level: 1 })).toHaveText('Бронь 20260913-SHOWTN');
  await expect(tab(drawer, 'Действия')).toHaveAttribute('aria-selected', 'true');
  // карточка под панелью своей вкладки не меняла
  const underneath = page.locator('main', {
    has: page.getByRole('heading', { level: 1, name: `Бронь ${BOOKING}` }),
  });
  await expect(tab(underneath, 'Действия')).toHaveAttribute('aria-selected', 'true');
});
