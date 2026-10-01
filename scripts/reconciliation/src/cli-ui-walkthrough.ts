/**
 * Обход стойки «по каждому экрану и каждой кнопке» (поручение владельца 17.09.2026): открыть все экраны из меню,
 * нажать все кнопки, вкладки и ссылки на них, а там, где показатели считаются за выбранный период, — сверить числа на
 * экране с ответом API за тот же период. Только чтение: кнопки, которые пишут (заселить, отправить очередь,
 * сохранить…), не нажимаются и перечисляются в отчёте отдельно; окна подтверждения закрываются «Оставить»/Escape.
 *
 * Запуск на машине стойки (живые 3000 и 3001, как у `cli-ui-smoke.ts`):
 *   npm run ui:walkthrough
 * На стенде сквозных тестов (стойка из сборки 3100 + API на схеме `pms_test` 3101):
 *   WEB_URL=http://127.0.0.1:3100 APP_API_URL=http://127.0.0.1:3101 npm run ui:walkthrough
 * Машина без браузеров Playwright, но со своим Chromium: `CHROMIUM_PATH=/путь/к/chrome`.
 * Пишет reports/ui-walkthrough-YYYY-MM-DD.md. Код выхода 1, если хоть одна проверка дала FAIL.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';
import { previousPeriod, resolvePeriod } from '@pms/domain';
import { serviceFetch } from '../../lib/service-api';
import { LOCKED_DETAIL, SIGN_IN_FAILED, deskCredentials, locked } from './desk-auth';

const ROOT = resolve(import.meta.dirname, '../../..');
// По умолчанию — живая стойка, как у остальных скриптов эксплуатации; стенд задаётся переменными
const WEB = process.env['WEB_URL'] ?? 'http://127.0.0.1:3000';
const API = process.env['APP_API_URL'] ?? 'http://127.0.0.1:3001';
const NAV_TIMEOUT = 90_000;
/** сегодня по часам объекта (Алматы, UTC+5) — так же считает стойка */
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;

type Verdict = 'ok' | 'FAIL' | 'skip';
interface Finding {
  route: string;
  subject: string;
  verdict: Verdict;
  detail: string;
}
const findings: Finding[] = [];
const note = (route: string, subject: string, verdict: Verdict, detail = '') => {
  findings.push({ route, subject, verdict, detail });
  console.log(
    `${verdict === 'ok' ? 'ок  ' : verdict === 'skip' ? 'пропуск' : 'FAIL'} ${route} · ${subject}${detail ? ` — ${detail}` : ''}`,
  );
};

const json = async <T>(path: string): Promise<T> => {
  // с включённым замком (ADR-049, ADR-053) API пускает скрипты по служебному ключу, а не как людей
  const res = await serviceFetch(`${API}${path}`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
};
/** «15 688 018 ₸» → 15688018; «60,5 %» → 60.5 */
const num = (text: string) => Number(text.replace(/[\s\u00a0₸%]/g, '').replace(',', '.'));
const tenge = (minor: string) => Number((BigInt(minor) + 50n) / 100n);

// ── Экраны из меню (apps/web/src/lib/navigation.ts) плюс то, что открывается из них ──
const STATIC = [
  '/today',
  '/chessboard',
  '/reservations',
  '/guests',
  '/rooms',
  '/inventory',
  '/rooms/categories',
  '/rooms/availability',
  '/rates',
  '/hotel-settings',
  '/hotel-settings/check-in',
  '/hotel-settings/stay',
  '/hotel-settings/penalties',
  '/hotel-settings/services',
  '/hotel-settings/description',
  '/hotel-settings/photos',
  '/hotel-settings/amenities',
  '/management/analytics',
  '/management/analytics/occupancy',
  '/finance',
  '/channel-manager',
  '/channels',
  '/website',
  '/website/booking',
  '/website/analytics',
  '/website/settings',
  '/connections',
  '/incidents',
  '/journal',
  '/reservations/new',
  '/profile',
  '/login',
  '/login/reset',
];
/** Узкая ширина: экран обязан открываться и не уезжать вбок (DESIGN.md §2 «Телефон») */
const PHONE = { width: 390, height: 844 };
/**
 * Действия записи обход не нажимает — их доказывают сквозные тесты на живой базе.
 * Слева — как кнопка названа на экране, справа — спек, который делает это действие целиком.
 */
const WRITE_COVERAGE: Array<[RegExp, string]> = [
  [/Заселить|Выселить/i, 'tests/e2e/check-in-out.spec.ts, full-day.spec.ts'],
  [/Создать счёт|Закрыть счёт|Оплатить|Начислить|Вернуть|Сторн/i, 'tests/e2e/finance.spec.ts'],
  [
    /Сохранить|Пересчитать и сохранить|Переселить|Продлить/i,
    'tests/e2e/desk-tasks.spec.ts, desk-edit.spec.ts',
  ],
  [/Отменить бронь|Незаезд/i, 'tests/e2e/manual-reservation.spec.ts, cancellation-penalty.spec.ts'],
  [/Применить|Добавить в список/i, 'tests/e2e/channex-certification.spec.ts (цены и ограничения)'],
  [
    /Забрать брони|Отправить очередь|Полная выгрузка|Создать объект|webhook/i,
    'tests/e2e/channex-certification.spec.ts',
  ],
  [/Добавить сайт|Проверить счётчик/i, 'tests/e2e/web-analytics.spec.ts'],
  [/Проверить сейчас|Принято|Решено/i, 'tests/e2e/incidents.spec.ts'],
  [
    /Заблокировать|Разблокировать|снять|Требует уборки|Убрано|Проверено/i,
    'tests/e2e/unit-blocks.spec.ts, tests/ui/housekeeping.spec.ts',
  ],
  [/Войти|Выйти/i, 'tests/ui/password-reset.spec.ts, playwright.auth.config.ts'],
];
const coverageOf = (name: string) => WRITE_COVERAGE.find(([re]) => re.test(name))?.[1] ?? '';
/** Кнопки, которые пишут без окна подтверждения, — не нажимаем (только чтение) */
const WRITES =
  /заселить|выселить|забрать брони|отправить очередь|полная выгрузка|создать объект|зарегистрировать|проверить webhook|обработать заново|принять|повторить|проверить сейчас|выйти|войти|сохранить|записать|применить|оплатить|начислить|вернуть|сторн|перечитать|прочитать заново|обновить контент|снять|удалить|разблокировать|заблокировать|создать|отправить|включить|выключить|закрыть счёт|перезапуст|синхрониз|запустить|требует уборки|убрано|проверено/i;
/** Что на странице считается ошибкой */
const ERROR_TEXT =
  /Internal Server Error|Application error|Unhandled Runtime Error|Не удалось загрузить|не загрузил|Ошибка API|Синтетический/;

async function open(page: Page, route: string): Promise<{ status: number; errors: string[] }> {
  const errors: string[] = [];
  const onConsole = (m: { type: () => string; text: () => string }) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`);
  };
  page.on('console', onConsole);
  const res = await page.goto(`${WEB}${route}`, { waitUntil: 'load', timeout: NAV_TIMEOUT });
  // потоковые куски Next (Suspense) дорисовываются после load — ждём, пока не останется скрытых сегментов
  await page
    .waitForFunction(() => !document.querySelector('body > div[hidden][id^="S:"]'), null, {
      timeout: 60_000,
    })
    .catch(() => errors.push('поток Next не завершился за 60 с'));
  await page.waitForTimeout(300);
  page.off('console', onConsole);
  const status = res?.status() ?? 0;
  const text = await page
    .locator('main')
    .first()
    .innerText()
    .catch(() => '');
  const m = ERROR_TEXT.exec(text);
  if (m && !/\/login$/.test(route)) errors.push(`текст ошибки на экране: «${m[0]}»`);
  return {
    status,
    errors: errors.filter((e) => !/favicon|hydrat|Download the React DevTools/i.test(e)),
  };
}

async function closeOverlays(page: Page) {
  for (let i = 0; i < 3; i++) {
    const dialog = page.locator('dialog[open]');
    if (await dialog.count()) {
      const keep = dialog.getByRole('button', { name: /Оставить|Отмена|Закрыть|Нет/ }).first();
      if (await keep.count()) await keep.click().catch(() => page.keyboard.press('Escape'));
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      continue;
    }
    if (await page.locator('[role="menu"]:visible').count()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      continue;
    }
    break;
  }
}

const nameOf = async (el: Locator) =>
  ((await el.getAttribute('aria-label')) ?? (await el.innerText().catch(() => '')) ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

/** Кнопки, вкладки и раскрывашки экрана: нажать каждую и записать, что произошло */
async function pressButtons(page: Page, route: string) {
  const seen = new Set<string>();
  const main = page.locator('main').first();
  // вкладки открывает внешний цикл: нажми мы их здесь, содержимое открытой вкладки сменилось бы
  // до её собственных кнопок, и действия карточки остались бы непроверенными
  const selector = 'button:not([role="tab"]), summary, [role="menuitem"]';
  const total = await main.locator(selector).count();
  for (let i = 0; i < Math.min(total, 80); i++) {
    const el = main.locator(selector).nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const name = await nameOf(el);
    // образец имени: числа и даты — в «:x», чтобы 60 одинаковых кнопок цены не заслонили остальные
    const pattern = name.replace(/\d+/g, ':x');
    const same = [...seen].filter((k) => k.startsWith(`${pattern}#`)).length;
    if (!name || same >= 2) continue;
    seen.add(`${pattern}#${i}`);
    if (await el.isDisabled().catch(() => false)) {
      note(route, `кнопка «${name}»`, 'ok', 'отключена по состоянию');
      continue;
    }
    const type = (await el.getAttribute('type')) ?? '';
    const form = el.locator('xpath=ancestor::form[1]');
    const formMethod = (await form.count())
      ? ((await form.getAttribute('method')) ?? 'get').toLowerCase()
      : null;
    const formAction = (await form.count()) ? ((await form.getAttribute('action')) ?? '') : '';
    const writesViaForm =
      (type === 'submit' || (type === '' && (await el.evaluate((b) => b.tagName === 'BUTTON')))) &&
      formMethod !== null &&
      (formMethod === 'post' || formAction.startsWith('javascript:'));
    if (writesViaForm || WRITES.test(name)) {
      const covered = coverageOf(name);
      note(
        route,
        `кнопка «${name}»`,
        'skip',
        covered
          ? `действие записи — доказано сквозными: ${covered}`
          : 'действие записи — не нажимаем',
      );
      continue;
    }
    // прошлое меню или окно могло остаться открытым и перехватывать клики
    await closeOverlays(page);
    const before = page.url();
    const alertsBefore = await page.locator('[role="alert"]:visible').count();
    const selectedBefore = await el.getAttribute('aria-selected');
    const expandedBefore = await el.getAttribute('aria-expanded');
    const pressedBefore = await el.getAttribute('aria-pressed');
    const rowsBefore = await main
      .locator('tbody tr:visible, [data-testid$="-row"]:visible')
      .count();
    const textBefore = (await main.innerText().catch(() => '')).replace(/\s+/g, ' ');
    const docBefore = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme') ?? '',
      hidden: document.querySelectorAll('input[type="password"]').length,
    }));
    try {
      await el.click({ timeout: 5_000 });
    } catch {
      // список кнопок живой: предыдущий клик мог сдвинуть номера — повторяем по имени
      try {
        await main.getByRole('button', { name, exact: true }).first().click({ timeout: 5_000 });
      } catch (e) {
        note(
          route,
          `кнопка «${name}»`,
          'FAIL',
          `не нажалась: ${(e as Error).message.split('\n')[0]}`,
        );
        continue;
      }
    }
    await page.waitForTimeout(700);
    const effects: string[] = [];
    // вкладка карточки меняет только якорь — это не уход со страницы
    const samePage = new URL(page.url()).href.split('#')[0] === new URL(before).href.split('#')[0];
    if (page.url() !== before)
      effects.push(
        samePage
          ? `якорь → ${new URL(page.url()).hash}`
          : `переход → ${page.url().replace(WEB, '')}`,
      );
    const dialog = page.locator('dialog[open]');
    if (await dialog.count()) {
      const title = (
        await dialog
          .locator('h2, h3, [class*="title"]')
          .first()
          .innerText()
          .catch(() => '')
      ).trim();
      effects.push(`окно «${title.slice(0, 50)}»`);
    }
    const menu = page.locator('[role="menu"]:visible');
    if (await menu.count()) {
      const items = await menu.getByRole('menuitem').allInnerTexts();
      effects.push(
        `меню: ${items
          .map((s) => s.trim())
          .join(' / ')
          .slice(0, 80)}`,
      );
    }
    const editor = el.locator('xpath=ancestor::td[1]').locator('input:visible, textarea:visible');
    if (await editor.count()) {
      const hint = (
        await el
          .locator('xpath=ancestor::td[1]')
          .innerText()
          .catch(() => '')
      )
        .replace(/\s+/g, ' ')
        .trim();
      effects.push(`поле правки открыто${hint ? `: «${hint.slice(0, 60)}»` : ''}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
    if (pressedBefore !== null) {
      const now = await el.getAttribute('aria-pressed').catch(() => null);
      const rowsAfter = await main
        .locator('tbody tr:visible, [data-testid$="-row"]:visible')
        .count();
      // на экране без таблицы (переключатель темы) число строк ни о чём не говорит — не пишем его
      const rows = rowsBefore || rowsAfter ? `, строк ${rowsBefore} → ${rowsAfter}` : '';
      effects.push(now === 'true' ? `включено${rows}` : `не включилось (aria-pressed=${now})`);
    }
    const alertsAfter = await page.locator('[role="alert"]:visible').count();
    if (alertsAfter > alertsBefore) {
      const t = (await page.locator('[role="alert"]:visible').last().innerText())
        .replace(/\s+/g, ' ')
        .slice(0, 80);
      effects.push(`сообщение «${t}»`);
    }
    if (selectedBefore !== null) {
      const now = await el.getAttribute('aria-selected').catch(() => null);
      effects.push(
        now === 'true' ? 'вкладка открыта' : `вкладка не переключилась (aria-selected=${now})`,
      );
    }
    if (expandedBefore !== null) {
      const now = await el.getAttribute('aria-expanded').catch(() => null);
      effects.push(now !== expandedBefore ? `раскрыто: ${now}` : 'aria-expanded не изменился');
    }
    const docAfter = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme') ?? '',
      hidden: document.querySelectorAll('input[type="password"]').length,
    }));
    if (docAfter.theme !== docBefore.theme)
      effects.push(
        `тема: «${docBefore.theme || 'по устройству'}» → «${docAfter.theme || 'по устройству'}»`,
      );
    if (docAfter.hidden !== docBefore.hidden)
      effects.push(docAfter.hidden < docBefore.hidden ? 'пароль показан' : 'пароль скрыт');
    const textAfter = (await main.innerText().catch(() => '')).replace(/\s+/g, ' ');
    if (textAfter !== textBefore && !effects.length) {
      // что именно прибавилось или убыло — первые отличающиеся слова
      const at = [...textAfter].findIndex((ch, k) => ch !== textBefore[k]);
      const added = textAfter.length >= textBefore.length;
      effects.push(
        `текст экрана изменился (${added ? '+' : '−'}${Math.abs(textAfter.length - textBefore.length)} зн.): «${(added ? textAfter : textBefore).slice(Math.max(0, at), Math.max(0, at) + 60)}»`,
      );
    }
    const errText = ERROR_TEXT.exec(
      await page
        .locator('main')
        .first()
        .innerText()
        .catch(() => ''),
    );
    const failed =
      effects.some((e) => /не переключилась|не включилось/.test(e)) ||
      (errText && !/\/login$/.test(route));
    note(
      route,
      `кнопка «${name}»`,
      failed ? 'FAIL' : 'ok',
      [...effects, errText ? `ошибка на экране «${errText[0]}»` : ''].filter(Boolean).join('; ') ||
        'без видимого изменения',
    );
    await closeOverlays(page);
    // возвращаемся только если ушли со страницы: иначе открытая вкладка карточки закрылась бы до её кнопок
    if (!samePage) await open(page, route);
  }
}

/** Ссылки экрана: по две на каждый образец адреса (номера броней и id гостей сворачиваются в один образец) */
async function followLinks(page: Page, route: string, visited: Set<string>) {
  const hrefs = await page
    .locator('main')
    .first()
    .locator('a[href]')
    .evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? '').filter(Boolean),
    );
  const byPattern = new Map<string, string[]>();
  for (const h of hrefs) {
    if (!h.startsWith('/') || h.startsWith('//')) continue;
    const path = h.split('?')[0]!.split('#')[0]!;
    const pattern = path
      .split('/')
      .map((s) => (/\d/.test(s) || s.length > 20 ? ':x' : s))
      .join('/');
    const q = h.includes('?') ? '?…' : '';
    const key = pattern + q;
    const list = byPattern.get(key) ?? [];
    if (!list.includes(h)) list.push(h);
    byPattern.set(key, list);
  }
  for (const [pattern, list] of byPattern) {
    for (const h of list.slice(0, 2)) {
      if (visited.has(h)) continue;
      visited.add(h);
      const { status, errors } = await open(page, h);
      const h1 = (
        await page
          .locator('main h1')
          .first()
          .innerText()
          .catch(() => '')
      ).trim();
      // переход по якорю Next ведёт клиентски: ответа у goto нет (status 0), судим по заголовку экрана
      const statusOk = status === 200 || (status === 0 && h.includes('#') && h1.length > 0);
      const ok = statusOk && errors.length === 0 && h1 !== 'Страница не найдена';
      note(
        route,
        `ссылка ${h} (${pattern})`,
        ok ? 'ok' : 'FAIL',
        ok ? `«${h1}»` : `HTTP ${status}; ${errors.join('; ')} ${h1}`.trim(),
      );
    }
  }
  await open(page, route);
}

/** GET-формы фильтров: нажать «Показать»/«Найти» как есть и убедиться, что экран отвечает */
async function submitGetForms(page: Page, route: string) {
  const forms = page.locator('main').first().locator('form');
  const n = await forms.count();
  for (let i = 0; i < n; i++) {
    const f = forms.nth(i);
    const method = ((await f.getAttribute('method')) ?? 'get').toLowerCase();
    if (method !== 'get') continue;
    const submit = f.locator('button[type="submit"], button:not([type])').first();
    if (!(await submit.count()) || !(await submit.isVisible())) continue;
    const name = await nameOf(submit);
    await submit.click();
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    const errText = ERROR_TEXT.exec(
      await page
        .locator('main')
        .first()
        .innerText()
        .catch(() => ''),
    );
    note(
      route,
      `форма фильтра «${name}»`,
      errText ? 'FAIL' : 'ok',
      `→ ${page.url().replace(WEB, '')}${errText ? `; «${errText[0]}»` : ''}`,
    );
    await open(page, route);
  }
}

// ── «Аналитика → Обзор»: периоды и сверка показателей с API ──
// «Показатели за период» (A1, ADR-103) с AN2 перенаправляют сюда (ADR-114); определения ADR-047 те же
const OVERVIEW = '/management/analytics';
/** Готовые отрезки «Обзора» — `ANALYTICS_PRESETS` из `management/analytics/params.ts`; «Этот месяц» — по умолчанию */
const OVERVIEW_PRESETS = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: '7 дней' },
  { id: 'month', label: 'Этот месяц' },
  { id: 'last-month', label: 'Прошлый месяц' },
] as const;
interface DashboardPeriodApi {
  from: string;
  to: string;
  occupancy: { percent: number; occupiedNights: number };
  revenue: { accommodationMinor: string };
  bookings: { total: number };
}
async function checkDashboard(page: Page, label: string, from: string, to: string) {
  const route = OVERVIEW;
  // Next отдаёт страницу потоком: те же `data-testid` секунду живут в двух копиях — берём первую
  const kpi = page.getByTestId('pa-kpi-occupancy').first();
  const err = page.getByTestId('pa-error').first();
  const empty = page.getByTestId('pa-empty').first();
  await Promise.race([
    kpi.waitFor({ timeout: 90_000 }),
    err.waitFor({ timeout: 90_000 }),
    empty.waitFor({ timeout: 90_000 }),
  ]).catch(() => undefined);
  if (await err.count()) {
    note(
      route,
      `показатели «${label}»`,
      'FAIL',
      (await err.innerText()).replace(/\s+/g, ' ').slice(0, 120),
    );
    return;
  }
  const api = await json<{ current: DashboardPeriodApi; previous: DashboardPeriodApi }>(
    `/desk/dashboard?from=${from}&to=${to}`,
  );
  const c = api.current;
  const caption = (await page.getByTestId('pa-period').first().innerText()).replace(/\s+/g, ' ');
  if (!(await kpi.count())) {
    // пустой период — словами; ошибка, если API видит данные
    const apiEmpty =
      c.occupancy.occupiedNights === 0 &&
      c.bookings.total === 0 &&
      BigInt(c.revenue.accommodationMinor) === 0n;
    note(
      route,
      `показатели «${label}» ${from}…${to}`,
      (await empty.count()) && apiEmpty ? 'ok' : 'FAIL',
      `«Недостаточно данных»; API: ночей ${c.occupancy.occupiedNights}, броней ${c.bookings.total}`,
    );
    return;
  }
  const checks: Array<[string, number, number]> = [
    ['Загрузка', num(await kpi.innerText()), Math.round(c.occupancy.percent * 10) / 10],
    [
      'Выручка проживания',
      num(await page.getByTestId('pa-kpi-revenue').first().innerText()),
      tenge(c.revenue.accommodationMinor),
    ],
    ['Брони', num(await page.getByTestId('pa-kpi-bookings').first().innerText()), c.bookings.total],
  ];
  const bad = checks.filter(([, screen, expected]) => Math.abs(screen - expected) > 0.051);
  const prev = previousPeriod(from, to);
  const compare = (await page.getByTestId('pa-compare').first().innerText()).replace(/\s+/g, ' ');
  const prevDay = Number(prev.from.slice(8, 10));
  const compareOk = new RegExp(`\\b${prevDay}\\b`).test(compare);
  note(
    route,
    `показатели «${label}» ${from}…${to}`,
    bad.length || !compareOk ? 'FAIL' : 'ok',
    bad.length
      ? bad.map(([n, s, e]) => `${n}: на экране ${s}, API ${e}`).join('; ')
      : `${checks.map(([n, s]) => `${n} ${s}`).join(', ')} = API; подпись «${caption}»; сравнение с ${prev.from}${compareOk ? '' : ' НЕ найдено в «' + compare + '»'}`,
  );
}

async function walkDashboard(page: Page) {
  const route = OVERVIEW;
  // прежний адрес «Показателей за период» ведёт на «Обзор» с тем же периодом
  await open(page, '/management/dashboard?period=week');
  note(
    '/management/dashboard',
    'перенаправление на «Аналитику»',
    /\/management\/analytics\?period=week$/.test(page.url()) ? 'ok' : 'FAIL',
    `→ ${page.url().replace(WEB, '')}`,
  );
  await open(page, route);
  for (const p of OVERVIEW_PRESETS) {
    const link = page
      .getByRole('navigation', { name: 'Период', exact: true })
      .first()
      .getByRole('link', { name: p.label, exact: true });
    if (!(await link.count())) {
      note(route, `период «${p.label}»`, 'FAIL', 'ссылки нет на экране');
      continue;
    }
    await link.click();
    // отрезок по умолчанию в адрес не пишется
    const target = p.id === 'month' ? /\/management\/analytics$/ : new RegExp(`period=${p.id}`);
    await page.waitForURL(target, { timeout: NAV_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
    const current = await page
      .getByRole('navigation', { name: 'Период', exact: true })
      .first()
      .getByRole('link', { name: p.label, exact: true })
      .getAttribute('aria-current');
    note(
      route,
      `период «${p.label}» нажимается`,
      current === 'page' ? 'ok' : 'FAIL',
      `→ ${page.url().replace(WEB, '')}, aria-current=${current}`,
    );
    const r = resolvePeriod({ preset: p.id }, today);
    await checkDashboard(page, p.label, r.from, r.to);
  }
  // свои даты — панель «Период»
  const from = monthStart(today);
  const to = addDays(today, -1) >= from ? addDays(today, -1) : today;
  await page.locator('.pa-range > summary').first().click();
  await page.getByLabel('Период: с').first().fill(from);
  await page.getByLabel('Период: по').first().fill(to);
  await page
    .getByTestId('pa-range-form')
    .first()
    .getByRole('button', { name: 'Применить' })
    .click();
  await page.waitForURL(/period=custom|date=/, { timeout: NAV_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  note(
    route,
    'свои даты — «Применить»',
    /period=custom&from=[\d-]{10}&to=[\d-]{10}|date=[\d-]{10}/.test(page.url()) ? 'ok' : 'FAIL',
    `→ ${page.url().replace(WEB, '')}`,
  );
  await checkDashboard(page, `свои даты`, from, to);
  // период длиннее года — отказ словами, не пустые нули
  await open(page, `${route}?period=custom&from=${addDays(today, -400)}&to=${today}`);
  const text = (await page.locator('main').first().innerText()).replace(/\s+/g, ' ');
  note(
    route,
    'период длиннее 366 дней',
    /не больше 366/.test(text) ? 'ok' : 'FAIL',
    /не больше 366/.test(text) ? 'сказано словами' : 'предупреждения нет',
  );
  // ?date= — полоса стойки на выбранный день (Главная)
  const y = addDays(today, -1);
  await open(page, `/today?date=${y}`);
  await page.getByTestId('c-arrivals').first().waitFor({ timeout: 60_000 });
  const day = await json<{ counts: { arrivals: number; departures: number; inHouse: number } }>(
    `/desk/today?date=${y}`,
  );
  const strip: Array<[string, number, number]> = [
    ['заезды', num(await page.getByTestId('c-arrivals').first().innerText()), day.counts.arrivals],
    [
      'выезды',
      num(await page.getByTestId('c-departures').first().innerText()),
      day.counts.departures,
    ],
    ['проживают', num(await page.getByTestId('c-inhouse').first().innerText()), day.counts.inHouse],
  ];
  const badStrip = strip.filter(([, s, e]) => s !== e);
  note(
    '/today',
    `полоса «На стойке» за ${y}`,
    badStrip.length ? 'FAIL' : 'ok',
    badStrip.length
      ? badStrip.map(([n, s, e]) => `${n}: экран ${s}, API ${e}`).join('; ')
      : strip.map(([n, s]) => `${n} ${s}`).join(', ') + ' = API',
  );
}

// ── Экраны с периодом: сверка чисел с API ──
async function walkPeriodPages(page: Page) {
  // Оплаты (деньги за период)
  for (const [from, to] of [
    [monthStart(today), today],
    [monthStart(addDays(monthStart(today), -1)), addDays(monthStart(today), -1)],
  ]) {
    const route = `/finance?from=${from}&to=${to}`;
    await open(page, route);
    const r = await json<{ chargedMinor: string; paidMinor: string }>(
      `/finance/report?from=${from}&to=${to}`,
    );
    const charged = num(await page.getByTestId('charged').first().innerText());
    const paid = num(await page.getByTestId('paid').first().innerText());
    const ok =
      Math.abs(charged - Number(BigInt(r.chargedMinor) / 100n)) <= 1 &&
      Math.abs(paid - Number(BigInt(r.paidMinor) / 100n)) <= 1;
    note(
      '/finance',
      `деньги за ${from}…${to}`,
      ok ? 'ok' : 'FAIL',
      `начислено ${charged}, оплачено ${paid}${ok ? ' = API' : ` ≠ API ${r.chargedMinor}/${r.paidMinor}`}`,
    );
  }
  // Менеджер каналов — отчёт по каналам
  for (const [from, to] of [
    [monthStart(today), today],
    [addDays(today, -30), today],
  ]) {
    await open(page, `/channel-manager?from=${from}&to=${to}&status=ALL`);
    const report = await json<{ rows: Array<{ count: number }> }>(
      `/hotel/channel-report?from=${from}&to=${to}&status=ALL`,
    );
    const expected = report.rows.reduce((s, r) => s + r.count, 0);
    const screen = num(await page.getByTestId('channel-bookings').first().innerText());
    note(
      '/channel-manager',
      `бронирований за ${from}…${to}`,
      screen === expected ? 'ok' : 'FAIL',
      `экран ${screen}, API ${expected}`,
    );
  }
  // Брони — список за отрезок
  for (const [from, to] of [
    [today, today],
    [addDays(today, -7), today],
  ]) {
    await open(page, `/reservations?from=${from}&to=${to}&status=ALL`);
    const r = await json<{ total: number }>(
      `/hotel/reservations?from=${from}&to=${to}&status=ALL&page=1`,
    );
    const text = (await page.locator('main').first().innerText()).replace(/\s+/g, ' ');
    const m = /(\d[\d\s\u00a0]*)\s+бронирован/.exec(text);
    const screen = m ? num(m[1]!) : NaN;
    note(
      '/reservations',
      `броней за ${from}…${to}`,
      screen === r.total ? 'ok' : 'FAIL',
      `экран ${screen}, API ${r.total}`,
    );
  }
  // Шахматка — колонки дат и занято по дням
  for (const [from, to] of [
    [today, addDays(today, 6)],
    [addDays(today, 7), addDays(today, 20)],
  ]) {
    await open(page, `/chessboard?from=${from}&to=${to}`);
    const board = await json<{ dates: string[]; summary: Record<string, { occupied: number }> }>(
      `/chessboard?from=${from}&to=${to}`,
    );
    const cols = await page.getByTestId('date-col').count();
    const bad: string[] = [];
    for (const d of board.dates) {
      const s = await page
        .getByTestId(`occupied-${d}`)
        .first()
        .innerText()
        .catch(() => 'нет');
      if (num(s) !== board.summary[d]?.occupied)
        bad.push(`${d}: экран ${s}, API ${board.summary[d]?.occupied}`);
    }
    note(
      '/chessboard',
      `период ${from}…${to}`,
      cols === board.dates.length && !bad.length ? 'ok' : 'FAIL',
      `колонок ${cols} из ${board.dates.length}; занято по дням ${bad.length ? bad.join('; ') : 'сходится'}`,
    );
  }
  // Доступность номеров — свободно по категориям
  for (const [a, d] of [
    [today, addDays(today, 1)],
    [addDays(today, 3), addDays(today, 6)],
  ]) {
    await open(page, `/rooms/availability?arrival=${a}&departure=${d}`);
    const av = await json<{
      total: { available: number };
      byCategory: Record<string, { available: number }>;
    }>(`/availability?arrival=${a}&departure=${d}`);
    const text = (await page.locator('main').first().innerText()).replace(/\s+/g, ' ');
    const ok = text.includes(String(av.total.available));
    note(
      '/rooms/availability',
      `свободно ${a}→${d}`,
      ok ? 'ok' : 'FAIL',
      `API всего ${av.total.available}${ok ? ' есть на экране' : ' на экране не найдено'}`,
    );
  }
  // Аналитика сайта — сессии за период
  const sites = await json<Array<{ id: string }>>('/analytics/sites').catch(() => []);
  if (sites[0]) {
    const from = addDays(today, -13);
    await open(page, `/website/analytics?site=${sites[0].id}&from=${from}&to=${today}`);
    const rep = await json<{ summary: { sessions: number } }>(
      `/analytics/sites/${sites[0].id}/report?from=${from}&to=${today}`,
    );
    const screen = num(
      await page
        .getByTestId('an-sessions')
        .first()
        .innerText()
        .catch(() => 'NaN'),
    );
    note(
      '/website/analytics',
      `сессий за ${from}…${today}`,
      screen === rep.summary.sessions ? 'ok' : 'FAIL',
      `экран ${screen}, API ${rep.summary.sessions}`,
    );
  } else note('/website/analytics', 'сверка за период', 'skip', 'сайтов в базе нет');
  // Тарифы — листание месяца (с 27.09, ADR-111: подзаголовок постоянный, месяц читается по ячейкам)
  await open(page, '/rates');
  const firstDay = await page
    .locator('[data-testid^="rate-row-"]')
    .first()
    .getAttribute('data-testid');
  await page.getByRole('link', { name: 'Следующий месяц' }).first().click();
  // Link ведёт клиентски: события load нет — ждём новый месяц в адресе и перерисованную сетку
  await page.waitForURL(/month=\d{4}-\d{2}/, { timeout: NAV_TIMEOUT }).catch(() => undefined);
  await page
    .waitForFunction(
      (was) =>
        document.querySelector('[data-testid^="rate-row-"]')?.getAttribute('data-testid') !== was,
      firstDay,
      { timeout: 30_000 },
    )
    .catch(() => undefined);
  const firstDay2 = await page
    .locator('[data-testid^="rate-row-"]')
    .first()
    .getAttribute('data-testid');
  const rows = await page.locator('[data-testid^="rate-row-"]').count();
  note(
    '/rates',
    'следующий месяц',
    firstDay !== firstDay2 && rows >= 28 ? 'ok' : 'FAIL',
    `«${firstDay}» → «${firstDay2}», строк ${rows}`,
  );
  // Статистика на дату — с ADR-114 вкладка «Аналитика → Загрузка»
  await open(page, `/management/analytics/occupancy?date=${addDays(today, -1)}`);
  const stText = (await page.locator('main').first().innerText()).replace(/\s+/g, ' ');
  note(
    '/management/analytics/occupancy',
    `на дату ${addDays(today, -1)}`,
    /Загрузка|занято/i.test(stText) ? 'ok' : 'FAIL',
    stText.slice(0, 80),
  );
}

/** «Аналитика → Обзор» (ADR-114): этот месяц по каждому типу фонда — плитки равны ответу API */
async function walkAnalytics(page: Page) {
  const route = '/management/analytics';
  const from = `${today.slice(0, 7)}-01`;
  const last = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0));
  const to = last.toISOString().slice(0, 10);
  for (const fund of ['all', 'rooms', 'beds'] as const) {
    await open(page, fund === 'all' ? route : `${route}?fund=${fund}`);
    const kpi = page.getByTestId('pa-kpi-occupancy').first();
    const empty = page.getByTestId('pa-empty').first();
    await Promise.race([
      kpi.waitFor({ timeout: 90_000 }),
      empty.waitFor({ timeout: 90_000 }),
    ]).catch(() => undefined);
    if (!(await kpi.count())) {
      note(route, `обзор «${fund}»`, (await empty.count()) ? 'ok' : 'FAIL', 'плиток нет');
      continue;
    }
    const api = await json<{
      current: {
        occupancy: { percent: number; occupiedNights: number };
        revenue: { accommodationMinor: string };
        bookings: { total: number };
      };
    }>(`/desk/dashboard?from=${from}&to=${to}&fund=${fund}`);
    const c = api.current;
    const checks: Array<[string, number, number]> = [
      ['Загрузка', num(await kpi.innerText()), Math.round(c.occupancy.percent * 10) / 10],
      [
        'Выручка проживания',
        num(await page.getByTestId('pa-kpi-revenue').first().innerText()),
        tenge(c.revenue.accommodationMinor),
      ],
      [
        'Продано ночей',
        num(await page.getByTestId('pa-kpi-nights').first().innerText()),
        c.occupancy.occupiedNights,
      ],
      [
        'Брони',
        num(await page.getByTestId('pa-kpi-bookings').first().innerText()),
        c.bookings.total,
      ],
    ];
    const bad = checks.filter(([, screen, expected]) => Math.abs(screen - expected) > 0.051);
    note(
      route,
      `обзор «${fund}» ${from}…${to}`,
      bad.length ? 'FAIL' : 'ok',
      bad.length
        ? bad.map(([n, sc, e]) => `${n}: на экране ${sc}, API ${e}`).join('; ')
        : `${checks.map(([n, sc]) => `${n} ${sc}`).join(', ')} = API`,
    );
  }
  // «Загрузка» (AN2): сегодняшний день по каждому типу фонда — пять плиток и категории равны ответу API;
  // знаменатель прежний: занято + свободно + заблокировано = весь фонд
  const tab = '/management/analytics/occupancy';
  for (const fund of ['all', 'rooms', 'beds'] as const) {
    await open(page, fund === 'all' ? tab : `${tab}?fund=${fund}`);
    const kpi = page.getByTestId('pa-kpi-occupancy').first();
    const empty = page.getByTestId('pa-empty').first();
    await Promise.race([
      kpi.waitFor({ timeout: 90_000 }),
      empty.waitFor({ timeout: 90_000 }),
    ]).catch(() => undefined);
    if (!(await kpi.count())) {
      note(tab, `загрузка «${fund}»`, (await empty.count()) ? 'ok' : 'FAIL', 'плиток нет');
      continue;
    }
    const api = await json<{
      current: {
        occupancy: {
          percent: number;
          unitNights: number;
          occupiedNights: number;
          freeNights: number;
          blockedNights: number;
        };
        unassigned: number;
        categories: unknown[];
      };
    }>(`/desk/dashboard?from=${today}&to=${today}&fund=${fund}`);
    const o = api.current.occupancy;
    const read = async (id: string) =>
      num(await page.getByTestId(`pa-kpi-${id}`).first().innerText());
    const rows = await page.getByTestId('statistics-table').first().locator('tbody tr').count();
    const checks: Array<[string, number, number]> = [
      ['Загрузка', await read('occupancy'), Math.round(o.percent * 10) / 10],
      ['Занято', await read('occupied'), o.occupiedNights],
      ['Свободно', await read('free'), o.freeNights],
      ['Заблокировано', await read('blocked'), o.blockedNights],
      ['Без размещения', await read('unassigned'), api.current.unassigned],
      ['Категорий', rows, api.current.categories.length],
      [
        'Фонд = занято + свободно + блок',
        o.unitNights,
        o.occupiedNights + o.freeNights + o.blockedNights,
      ],
    ];
    const bad = checks.filter(([, screen, expected]) => Math.abs(screen - expected) > 0.051);
    note(
      tab,
      `загрузка «${fund}» на ${today}`,
      bad.length ? 'FAIL' : 'ok',
      bad.length
        ? bad.map(([n, sc, e]) => `${n}: на экране ${sc}, API ${e}`).join('; ')
        : `${checks.map(([n, sc]) => `${n} ${sc}`).join(', ')} = API`,
    );
  }
}

/** Отчёт обхода: пишется всегда — в том числе когда обход остановил замок входа. */
function report(failedRequests: string[]): number {
  const takenAt = new Date();
  const fails = findings.filter((f) => f.verdict === 'FAIL');
  const skips = findings.filter((f) => f.verdict === 'skip');
  const byRoute = new Map<string, Finding[]>();
  for (const f of findings) byRoute.set(f.route, [...(byRoute.get(f.route) ?? []), f]);
  const lines = [
    `# Обход стойки по экранам и кнопкам — ${takenAt.toISOString().slice(0, 10)}`,
    '',
    `Стенд: ${WEB} → ${API}, ${takenAt.toISOString()} UTC. Скрипт \`scripts/reconciliation/src/cli-ui-walkthrough.ts\` (только чтение).`,
    '',
    `**Итог: проверок ${findings.length}, FAIL ${fails.length}, пропущено (действия записи) ${skips.length}.**${failedRequests.length ? ` Ответы 5xx стойки: ${failedRequests.length}.` : ''}`,
    '',
    ...(fails.length
      ? [
          '## Что не сошлось',
          '',
          '| Экран | Что | Подробности |',
          '|---|---|---|',
          ...fails.map((f) => `| ${f.route} | ${f.subject} | ${f.detail} |`),
          '',
        ]
      : ['## Что не сошлось', '', 'Ничего.', '']),
    ...(failedRequests.length
      ? ['## Ответы 5xx', '', ...failedRequests.map((r) => `- ${r}`), '']
      : []),
    '## По экранам',
    '',
  ];
  for (const [route, list] of byRoute) {
    lines.push(`### ${route}`, '', '| Результат | Что | Подробности |', '|---|---|---|');
    for (const f of list)
      lines.push(
        `| ${f.verdict === 'ok' ? 'ок' : f.verdict === 'skip' ? 'пропуск' : '**FAIL**'} | ${f.subject.replace(/\|/g, '/')} | ${f.detail.replace(/\|/g, '/')} |`,
      );
    lines.push('');
  }
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const out = resolve(ROOT, `reports/ui-walkthrough-${takenAt.toISOString().slice(0, 10)}.md`);
  writeFileSync(out, lines.join('\n'));
  console.log(
    `→ ${out}: проверок ${findings.length}, FAIL ${fails.length}, пропущено ${skips.length}`,
  );
  return fails.length;
}

async function main() {
  const browser = await chromium.launch({
    ...(process.env['CHROMIUM_PATH'] ? { executablePath: process.env['CHROMIUM_PATH'] } : {}),
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
  const failedRequests: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 500 && r.url().startsWith(WEB))
      failedRequests.push(`${r.status()} ${r.url().replace(WEB, '')}`);
  });

  // Замок входа (ADR-053): без сессии стойка уводит на `/login`, и обходить нечего.
  const credentials = deskCredentials(process.env);
  if (credentials) {
    await page.goto(`${WEB}/auth/fallback`, { waitUntil: 'load', timeout: NAV_TIMEOUT });
    const form = page.locator('main').first();
    await form.getByLabel('Email', { exact: true }).fill(credentials.email);
    await form.getByLabel('Пароль', { exact: true }).fill(credentials.password);
    await form.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((u) => !locked(u.toString()), { timeout: NAV_TIMEOUT }).catch(() => {});
    if (locked(page.url())) {
      note('/login', 'вход в стойку', 'FAIL', SIGN_IN_FAILED);
      await browser.close();
      report(failedRequests);
      process.exit(1);
    }
    note('/login', 'вход в стойку', 'ok', `как ${credentials.email}`);
  } else {
    await page.goto(`${WEB}/today`, { waitUntil: 'load', timeout: NAV_TIMEOUT });
    // Next уводит на вход потоком: на `load` адрес ещё прежний, замок виден секундой позже
    await page.waitForURL((u) => locked(u.toString()), { timeout: 15_000 }).catch(() => {});
    if (locked(page.url())) {
      note('/today', 'обход экранов', 'skip', LOCKED_DETAIL);
      await browser.close();
      report(failedRequests);
      return;
    }
  }

  // динамические экраны — из живых данных
  const day = await json<{
    arrivals: Array<{ confirmationNumber: string }>;
    inHouse: Array<{ confirmationNumber: string }>;
  }>('/desk/today');
  const number = (day.inHouse[0] ?? day.arrivals[0])?.confirmationNumber;
  const card = number
    ? await json<{ primaryGuest: { id: string } | null }>(
        `/reservations/${encodeURIComponent(number)}`,
      )
    : null;
  const units = await json<Array<{ code: string; kind: 'ROOM' | 'BED' }>>('/inventory/units');
  const events = await json<{ rows: Array<{ externalEventId: string }> }>(
    '/channels/channex/events?limit=1',
  ).catch(() => ({ rows: [] }));
  const dynamic = [
    number && `/reservations/${encodeURIComponent(number)}`,
    card?.primaryGuest && `/guests/${card.primaryGuest.id}`,
    units.find((u) => u.kind === 'ROOM') && `/units/${units.find((u) => u.kind === 'ROOM')!.code}`,
    units.find((u) => u.kind === 'BED') && `/units/${units.find((u) => u.kind === 'BED')!.code}`,
    events.rows[0] && `/channels/events/${encodeURIComponent(events.rows[0].externalEventId)}`,
  ].filter((r): r is string => typeof r === 'string');

  await walkDashboard(page);
  await walkPeriodPages(page);
  await walkAnalytics(page);

  const visited = new Set<string>();
  for (const route of [...STATIC, ...dynamic]) {
    const { status, errors } = await open(page, route);
    const h1 = (
      await page
        .locator('main h1')
        .first()
        .innerText()
        .catch(() => '')
    )
      .replace(/\s+/g, ' ')
      .trim();
    const notFound = h1 === 'Страница не найдена';
    // `/design-system` собирается только в `next dev` (DESIGN.md §8) — на собранной стойке её нет намеренно
    const verdict: Verdict =
      notFound && route === '/design-system'
        ? 'skip'
        : status === 200 && !errors.length && !notFound
          ? 'ok'
          : 'FAIL';
    note(
      route,
      'экран открывается',
      verdict,
      `HTTP ${status}, «${h1}»${errors.length ? '; ' + errors.join('; ') : ''}${notFound && route === '/design-system' ? ' — только в next dev' : ''}`,
    );
    if (status !== 200 || notFound) continue;
    // вкладки карточки — открываем каждую, потом кнопки на ней
    const tabs = page.locator('main').first().getByRole('tab');
    const tabCount = await tabs.count();
    if (tabCount) {
      for (let i = 0; i < tabCount; i++) {
        const t = tabs.nth(i);
        const name = await nameOf(t);
        await t.click();
        await page.waitForTimeout(300);
        note(
          route,
          `вкладка «${name}»`,
          (await t.getAttribute('aria-selected')) === 'true' ? 'ok' : 'FAIL',
        );
        await pressButtons(page, route);
      }
    } else await pressButtons(page, route);
    await submitGetForms(page, route);
    await followLinks(page, route, visited);
  }
  // Телефон: экран обязан открыться и поместиться по ширине — горизонтальной прокрутки быть не должно
  await page.setViewportSize(PHONE);
  for (const route of [...STATIC, ...dynamic]) {
    const { status, errors } = await open(page, route);
    const h1 = (
      await page
        .locator('main h1')
        .first()
        .innerText()
        .catch(() => '')
    )
      .replace(/\s+/g, ' ')
      .trim();
    if (h1 === 'Страница не найдена') continue;
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      wide: [...document.querySelectorAll('main *')]
        .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 2)
        .map((e) => `${e.tagName}.${(e.className || '').toString().slice(0, 40)}`)
        .slice(0, 2),
    }));
    const ok = status === 200 && !errors.length && overflow.doc <= 2;
    note(
      `${route} (телефон 390)`,
      'экран открывается и помещается по ширине',
      ok ? 'ok' : 'FAIL',
      ok
        ? `«${h1}»`
        : `HTTP ${status}; вылет вправо ${overflow.doc} px${overflow.wide.length ? `: ${overflow.wide.join(', ')}` : ''}${errors.length ? '; ' + errors.join('; ') : ''}`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // меню слева: каждый пункт ведёт на свой экран
  await open(page, '/today');
  const navLinks = await page.locator('nav[aria-label="Разделы"] a[href]').evaluateAll((as) =>
    as.map((a) => ({
      href: (a as HTMLAnchorElement).getAttribute('href') ?? '',
      label: (a.textContent ?? '').trim(),
    })),
  );
  for (const { href, label } of navLinks) {
    if (!href.startsWith('/')) continue;
    const { status, errors } = await open(page, href);
    note(
      'меню',
      `«${label}» → ${href}`,
      status === 200 && !errors.length ? 'ok' : 'FAIL',
      errors.join('; '),
    );
  }
  await browser.close();

  const fails = report(failedRequests);
  process.exit(fails ? 1 : 0);
}

await main();
