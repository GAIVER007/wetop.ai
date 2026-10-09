import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Гостевой мастер `/create` (ТЗ-O1, план `guest-onboarding-ai-seller-2026-10-09`): адрес сайта и сценарий на одном
 * экране, проверка данных, опрос на шаге сборки. Бэкенд мастера подменён (`page.route`): сервер сканирования появится
 * срезом O2, здесь проверяется только поведение страницы.
 */
const report = 'reports/guest-onboarding-o1-2026-10-09';

interface Mock {
  state: { lastStep: string; revision: number; wizardData: Record<string, string> };
  calls: Array<Record<string, unknown>>;
}

async function mockWizard(page: Page, initial?: Partial<Mock['state']>): Promise<Mock> {
  const mock: Mock = {
    state: { lastStep: 'intro', revision: 0, wizardData: {}, ...initial },
    calls: [],
  };
  await page.route('**/api/wizard', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    mock.calls.push(body);
    if (body.operation === 'save') {
      mock.state = {
        lastStep: String(body.step),
        revision: mock.state.revision + 1,
        wizardData: { ...(body.config as Record<string, string>) },
      };
    }
    if (body.operation === 'survey' || body.operation === 'event')
      return route.fulfill({ json: { ok: true } });
    await route.fulfill({
      json: {
        guestSessionId: 'test-session',
        lastStep: mock.state.lastStep,
        draft: {
          businessName: '',
          niche: '',
          description: '',
          wizardData: mock.state.wizardData,
          revision: mock.state.revision,
          hasGenerated: false,
          testMessagesUsed: 0,
        },
        ...(body.token ? {} : { guestToken: `wz_${'a'.repeat(64)}` }),
      },
    });
  });
  return mock;
}

const saves = (mock: Mock) => mock.calls.filter((c) => c.operation === 'save');

test('первый экран один: сценарий (поддержка «скоро»), адрес, «Продолжить»; шага «Начать создание» нет', async ({
  page,
}) => {
  const mock = await mockWizard(page);
  await page.goto('/create?ref=test');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Создайте ИИ-продавца за 3 минуты',
  );
  await expect(page.getByRole('button', { name: 'Начать создание' })).toHaveCount(0);
  // «Поддержка сайта» показана, но пока не выбирается (O3 даст ей свой промпт): в черновик пишется только продавец
  const support = page.getByRole('radio', { name: /Поддержка сайта/ });
  await expect(support).toBeDisabled();
  await expect(support).toContainText('скоро');
  await expect(page.getByRole('radio', { name: 'ИИ-продавец' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Продолжить', exact: true })).toBeDisabled();
  await page.getByLabel('Адрес сайта').fill('hostel.kz');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByLabel('Название компании')).toBeVisible();
  const first = saves(mock)[0]!;
  expect((first.config as Record<string, string>).siteUrl).toBe('https://hostel.kz');
  expect((first.config as Record<string, string>).botType).toBe('sales');
  // домен .kz подставил тенге и пояс Алматы
  expect((first.config as Record<string, string>).currency).toBe('KZT');
  expect(mock.calls.some((c) => c.operation === 'event' && c.type === 'source_submitted')).toBe(true);
});

test('неверный адрес: ошибка у поля, мастер не уходит дальше и ввод на месте', async ({ page }) => {
  const mock = await mockWizard(page);
  await page.goto('/create');
  await page.getByLabel('Адрес сайта').fill('это не адрес');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.locator('#site-url-error')).toContainText('корректный адрес сайта');
  await expect(page.getByLabel('Адрес сайта')).toHaveValue('это не адрес');
  await expect(page.getByLabel('Адрес сайта')).toHaveAttribute('aria-invalid', 'true');
  expect(saves(mock)).toHaveLength(0);
});

test('без сайта: ссылка ведёт на проверку, ниша выбором и «Другое», «Далее» ждёт название и нишу', async ({
  page,
}) => {
  const mock = await mockWizard(page);
  await page.goto('/create');
  await page.getByRole('button', { name: 'или заполнить вручную, без сайта' }).click();
  const next = page.getByRole('button', { name: 'Далее', exact: true });
  await expect(next).toBeDisabled();
  await expect(page.getByText('Заполните название и нишу')).toBeVisible();
  await page.getByLabel('Название компании').fill('Тестовый хостел');
  await expect(next).toBeDisabled();
  await page.getByRole('combobox', { name: /Ниша/ }).selectOption('Хостел');
  await expect(next).toBeEnabled();
  // «Другое» открывает свободный ввод
  await page.getByRole('combobox', { name: /Ниша/ }).selectOption({ label: 'Другое' });
  await expect(next).toBeDisabled();
  await page.getByLabel('Ваша ниша').fill('Стоматология');
  await expect(next).toBeEnabled();
  await page.getByLabel('Имя ассистента').fill('Алина');
  await expect(page.getByRole('complementary', { name: 'Превью агента' })).toContainText('Алина');
  await next.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Пока мы готовим бота');
  const last = saves(mock).at(-1)!;
  expect(last.step).toBe('generating');
  expect((last.config as Record<string, string>).niche).toBe('Стоматология');
});

test('найденное по сайту помечено, правка человека снимает пометку', async ({ page }) => {
  await mockWizard(page, {
    lastStep: 'review',
    wizardData: {
      businessName: 'Хостел «Тест»',
      niche: 'Хостел',
      foundFields: 'businessName,niche',
      siteUrl: 'https://hostel.example.invalid',
    },
  });
  await page.goto('/create');
  await expect(page.getByText('найдено на сайте')).toHaveCount(2);
  await page.getByLabel('Название компании').fill('Хостел «Другой»');
  await expect(page.getByText('найдено на сайте')).toHaveCount(1);
});

test('опрос: ответы уходят, «Пропустить» закрывает одним нажатием, тест бота пока «Скоро»', async ({
  page,
}) => {
  const mock = await mockWizard(page, {
    lastStep: 'generating',
    wizardData: { businessName: 'Хостел', niche: 'Хостел' },
  });
  await page.goto('/create');
  await page.getByRole('textbox', { name: 'Чего хотите достичь с ботом?' }).fill('Больше броней');
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await page.getByRole('radio', { name: '10-50' }).click();
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await page.getByRole('radio', { name: 'Google' }).click();
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Спасибо, данные сохранены');
  const survey = mock.calls.find((c) => c.operation === 'survey')!;
  expect(survey.answers).toEqual({ goal: 'Больше броней', leadsPerDay: '10-50', source: 'Google' });
  await expect(page.getByRole('button', { name: 'Протестировать бота' })).toBeDisabled();

  // второй заход: пропустить сразу, ответов не отправляем
  const again = await mockWizard(page, { lastStep: 'generating' });
  await page.reload();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Спасибо, данные сохранены');
  expect(again.calls.some((c) => c.operation === 'survey')).toBe(false);
});

test('возврат: баннер с шагом, «В начало» ведёт на первый экран без потери данных', async ({
  page,
}) => {
  await mockWizard(page, {
    lastStep: 'review',
    wizardData: { businessName: 'Хостел «Тест»', niche: 'Хостел' },
  });
  await page.goto('/create');
  await expect(page.getByRole('status').first()).toContainText('Мы вернули вас на шаг «Проверка»');
  await page.getByRole('button', { name: 'Скрыть' }).click();
  await expect(page.getByText('Мы вернули вас')).toHaveCount(0);
  await page.getByRole('button', { name: '← В начало' }).click();
  await expect(page.getByLabel('Адрес сайта')).toBeVisible();
  await expect(page.getByRole('button', { name: '← В начало' })).toHaveCount(0);
});

test('отказ сохранения не теряет ввод и не показывает успешный результат', async ({ page }) => {
  await page.route('**/api/wizard', async (route) => {
    const body = route.request().postDataJSON();
    if (body.operation === 'save')
      return route.fulfill({
        status: 409,
        json: { message: 'Черновик изменился. Обновите страницу' },
      });
    await route.fulfill({
      json: {
        guestSessionId: 'test',
        guestToken: `wz_${'b'.repeat(64)}`,
        lastStep: 'review',
        draft: { wizardData: {}, revision: 0 },
      },
    });
  });
  await page.goto('/create');
  await page.getByLabel('Название компании').fill('Вымышленный объект');
  await page.getByRole('combobox', { name: /Ниша/ }).selectOption('Хостел');
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Черновик изменился');
  await expect(page.getByLabel('Название компании')).toHaveValue('Вымышленный объект');
});

test('истёкшая сессия: явный новый черновик вместо бесконечного повтора', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('wetop.wizard.token', `wz_${'c'.repeat(64)}`),
  );
  await page.route('**/api/wizard', async (route) => {
    const body = route.request().postDataJSON();
    if (body.token)
      return route.fulfill({ status: 401, json: { message: 'Сессия мастера истекла' } });
    await route.fulfill({
      json: {
        guestSessionId: 'new',
        guestToken: `wz_${'d'.repeat(64)}`,
        lastStep: 'intro',
        draft: { wizardData: {}, revision: 0 },
      },
    });
  });
  await page.goto('/create');
  await page.getByRole('button', { name: 'Начать новый черновик' }).click();
  await expect(page.getByLabel('Адрес сайта')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    test(`доступность и снимки: ${theme}, ${width}px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 900 });
      const shots: Array<[string, Partial<Mock['state']>]> = [
        ['source', { lastStep: 'intro' }],
        [
          'review',
          {
            lastStep: 'review',
            wizardData: { businessName: 'Хостел «Тест»', niche: 'Хостел', foundFields: 'businessName' },
          },
        ],
        ['build', { lastStep: 'generating' }],
      ];
      for (const [name, state] of shots) {
        await page.unroute('**/api/wizard').catch(() => undefined);
        await mockWizard(page, state);
        await page.goto('/create');
        await expect(page.getByRole('main')).toBeVisible();
        await page.getByRole('button', { name: 'Скрыть' }).click({ timeout: 1000 }).catch(() => undefined);
        const scan = await new AxeBuilder({ page }).analyze();
        expect(scan.violations.map((v) => `${name}: ${v.id}`)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        mkdirSync(report, { recursive: true });
        await page.screenshot({ path: `${report}/${name}-${theme}-${width}.png`, caret: 'initial' });
      }
    });
  }
}
