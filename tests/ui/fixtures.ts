/**
 * `test` для набора UI: тот же Playwright, но переход и перезагрузка дают потоковой отрисовке
 * короткую фору. Разбор тот же, что и в `tests/e2e/fixtures.ts` (журнал 15.09.2026): стойка отдаёт
 * страницу потоком, и первые сотни миллисекунд после `load` в DOM живут две копии — скрытый
 * сегмент `<div hidden id="S:0">` и клиентская отрисовка. Человек скрытую не видит, а Playwright
 * в строгом режиме находит каждый элемент дважды и падает сразу, не дожидаясь.
 *
 * До 21.09.2026 набор UI брал `test` прямо из `@playwright/test` и ловил это по одному локатору за
 * прогон (журнал 20.09 и 21.09). Ожидание здесь снимает весь класс разом, `page.reload()` тоже —
 * на нём падала `reservations-design`.
 *
 * Фора именно короткая, и это не мелочь. Замер 15.09 дал окно 35…330 мс, поэтому 700 мс его
 * покрывают. Ждать дольше нельзя: в наборе есть спеки, которые нарочно задерживают ответы API на
 * 2…6 с и проверяют, что видно, ПОКА страница грузится (`loading-performance`, `real-data`,
 * `reservations-states`, «загрузка словом» в `system-screens` и `channex-screens`). Длинное
 * ожидание здесь отдавало бы им уже загруженную страницу и проверяло пустоту вместо скелетона.
 */
import { test as base, expect, type Locator, type Page } from '@playwright/test';

const STREAM_GRACE_MS = 700;

/**
 * Скрытый потоковый сегмент ещё в DOM? Даём ему уйти; не ушёл за форой — отдаём страницу как есть.
 *
 * Обёртки ниже зовут это сами на `goto` и `reload`, но до перехода **щелчком по ссылке** фикстура не
 * достаёт. На спокойной машине он укладывается мгновенно (замер 03.10.2026 на `/reports/print`: один
 * `main`, скрытых сегментов ноль, пять повторов), а на загруженном раннере, где стойка отдаёт 503 и
 * рвёт поток, обе копии висят в DOM, и строгий режим Playwright находит `data-testid` дважды. Спеку,
 * который после щелчка ищет элемент по testid, это ожидание нужно позвать самому.
 */
export async function settleStreaming(page: Page): Promise<void> {
  // Выражение строкой: в корневом tsconfig нет библиотеки DOM, `document` тут не типизирован
  await page
    .waitForFunction('!document.querySelector(\'body > div[hidden][id^="S:"]\')', null, {
      timeout: STREAM_GRACE_MS,
    })
    .catch(() => undefined);
}

/**
 * Смена темы меняет цвета не мгновенно: `premium.css` даёт всем `button`, `a`, `input`, `select` и
 * `textarea` переход `--ease` (180 мс) по фону, кромке и цвету текста, а сам `data-theme` ставит
 * слушатель React, то есть мгновением позже, чем вернётся `emulateMedia`. Спеки с axe в двух темах
 * переключают тему и сразу замеряют контраст, попадая в это окно: axe видит цвета, которых нет ни в
 * одной теме (замер 03.10.2026 на `/guests/birthdays`: подпись поиска `#8192a9` на фоне `#353d4a`,
 * 3.45:1 — при том, что в настоящей тёмной теме та же подпись даёт 6.48:1 и норму проходит).
 * Отсюда «блуждающий» красный: падает тот спек, чей замер попал в 180 мс. Причина чинится здесь,
 * а не в тестах и не в токенах (тот же разбор, что у анимации панели в срезе B4 03.10.2026).
 */
const THEME_APPLY_MS = 400;
const THEME_TRANSITION_MS = 600;

async function settleTheme(page: Page, scheme: 'light' | 'dark' | 'no-preference'): Promise<void> {
  // Выражения строкой: в корневом tsconfig нет библиотеки DOM, `document` тут не типизирован
  if (scheme === 'light' || scheme === 'dark') {
    await page
      .waitForFunction(`document.documentElement.dataset.theme === '${scheme}'`, null, {
        timeout: THEME_APPLY_MS,
      })
      .catch(() => undefined);
  }
  await page
    .waitForFunction(
      "!document.getAnimations().some((a) => a.constructor.name === 'CSSTransition')",
      null,
      { timeout: THEME_TRANSITION_MS },
    )
    .catch(() => undefined);
}

export * from '@playwright/test';

/**
 * Шум `next dev`, а не ошибка стойки: React ведёт собственную дорожку замеров, и на странице,
 * пришедшей через redirect(), подаёт начало серверного рендера раньше timeOrigin вкладки —
 * браузер отвечает отказом `measure`. Приходит и как console.error, и как необработанное
 * исключение страницы; в сборке этой дорожки нет (разбор 21.09.2026).
 */
export const devNoise = /Failed to execute 'measure' on 'Performance'/;

/**
 * ADR-134 (02.10.2026, поручение владельца): навигация стойки сверху, шапка из двух строк, `--header-h` 72 → 100 px.
 * Владелец принял, что экраны отдают шапке эту высоту («шахматка на компьютере теряет 28 px высоты»). Проверки
 * «помещается на экране ноутбука», заданные до 02.10.2026, считали место под содержимое при прежней шапке: бюджет
 * содержимого у них прежний, бюджет окна больше ровно на рост шапки. Всё, что сверх, это рост самого экрана, и
 * проверка его ловит (разбор полного UI 03.10.2026, `docs/history/2026-10-03-double-shift.md`).
 */
export const HEADER_GROWTH_PX = 28;

/**
 * Оживил ли React этот узел. Сервер рисует кнопку раньше, чем браузер получит и выполнит скрипты стойки, и клик в
 * этот промежуток пропадает: кнопка видна, а обработчика у неё ещё нет. Признак оживления: служебное свойство React
 * на самом узле (`__reactProps$…`), его ставят вместе с обработчиками (тот же признак, что у `ai-seller.spec.ts`).
 * На медленном раннере GitHub промежуток доходит до секунд: TESTING.md, строки 20.09 (`real-data`), 27.09
 * (`ai-seller`) и 03.10 (`login-access`, release-checks #7).
 */
export async function hydrated(target: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        target.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps$'))),
      { message: 'React не оживил элемент: скрипты стойки не дошли или упали', timeout: 30_000 },
    )
    .toBe(true);
}

/**
 * «Меню администратора» в шапке: нажать, когда React оживил кнопку, и убедиться, что меню раскрылось. Спеки открывают
 * меню профиля только так (сторож `tests/unit/ui-profile-menu.test.ts`); возвращает саму кнопку.
 */
export async function openProfileMenu(page: Page): Promise<Locator> {
  const menu = page.getByRole('button', { name: 'Меню администратора' });
  await hydrated(menu);
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  return menu;
}

/**
 * Обучение в стойке (ADR-100) само открывается на Главной у вошедшего, пока в браузере нет отметки «пройдено».
 * Спекам, которые входят и работают на Главной, окно поверх экрана не нужно: по умолчанию стенд считает обучение
 * пройденным. Спек обучения включает его сам: `test.use({ tour: true })`.
 */
const TOUR_DONE_SCRIPT = `(() => {
  try {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      const value = get.call(this, key);
      return value === null && typeof key === 'string' && key.startsWith('wetop.tour.v1:') ? 'done' : value;
    };
  } catch (e) {}
})();`;

export const test = base.extend<{ tour: boolean }>({
  tour: [false, { option: true }],
  page: async ({ page, tour }, use) => {
    if (!tour) await page.addInitScript(TOUR_DONE_SCRIPT);
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      await settleStreaming(page);
      return response;
    };
    const reload = page.reload.bind(page);
    page.reload = async (options) => {
      const response = await reload(options);
      await settleStreaming(page);
      return response;
    };
    const emulateMedia = page.emulateMedia.bind(page);
    page.emulateMedia = async (options) => {
      await emulateMedia(options);
      if (options?.colorScheme) await settleTheme(page, options.colorScheme);
    };
    await use(page);
  },
});

export { expect };

/**
 * Адрес подставного API для запросов спека (`__test/reset`, `__test/control`). Дерево делят несколько сессий, и
 * 4311 бывает занят соседним прогоном: `playwright.alt.config.ts` поднимает свой стенд и передаёт его адрес
 * `UI_FIXTURE_API` (календарные спеки задавали тот же стенд через `FIXTURE_PORT`, поэтому понимаем и его).
 * Спек, у которого адрес зашит константой, в этом случае сбрасывает и настраивает ЧУЖУЮ фикстуру,
 * а страницу читает со своей. 03.10.2026 так падал `ai-seller.spec` на «Коде для сайта»: `sellerHosts: []` уехал
 * соседу, своя фикстура осталась с доменом, и подсказка «сайта нет» на странице не появлялась.
 */
const fixturePort = process.env['FIXTURE_PORT'];
export const FIXTURE_API =
  process.env['UI_FIXTURE_API'] ??
  (fixturePort ? `http://127.0.0.1:${fixturePort}` : 'http://127.0.0.1:4311');

/**
 * Окошко «Фильтры» календаря. С 09.10.2026 (образец владельца) категория и «Места» живут в нём, а не
 * в строке над сеткой: открыть, выбрать и «Применить».
 */
export async function openBoardFilters(page: Page) {
  await page
    .getByRole('main')
    .getByRole('button', { name: /^Фильтры( \d+)?$/ })
    .click();
  const pop = page.getByRole('dialog', { name: 'Фильтры календаря' });
  await expect(pop).toBeVisible();
  return pop;
}

/** Выбрать категорию и/или состояние места в окошке «Фильтры» и применить */
export async function boardFilter(page: Page, pick: { category?: string; state?: string }) {
  const pop = await openBoardFilters(page);
  if (pick.category !== undefined)
    await pop.getByLabel('Категория в календаре').selectOption(pick.category);
  if (pick.state !== undefined) await pop.getByLabel('Места в календаре').selectOption(pick.state);
  await pop.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(pop).toBeHidden();
}
