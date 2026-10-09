import { FIXTURE_API, expect, test, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

/**
 * «Настройки объекта» по верстке владельца (ADR-158, DATA_MODEL §32): описание, сайт, правила проживания, удобства,
 * предпросмотр карточки. Схема не используется: стенд тот же подставной API, разбор ввода тот же, что у настоящего.
 */
const API = FIXTURE_API;
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/finance');
}

test('карточка объекта: все поля сохраняются и читаются обратно', async ({ page }) => {
  await signIn(page);
  await page.goto('/hotel-settings');
  const main = page.getByRole('main');
  const form = main.getByTestId('hotel-settings-form');
  const save = main.locator('.page__actions').getByRole('button', { name: 'Сохранить изменения' });
  await expect(save).toBeDisabled();
  // умолчания: с детьми да, с питомцами нет, курение запрещено, возраст 18, оплата, отмена, залог
  await expect(form.getByRole('switch', { name: 'Можно с детьми' })).toBeChecked();
  await expect(form.getByRole('switch', { name: 'Можно с питомцами' })).not.toBeChecked();
  await expect(form.getByRole('switch', { name: 'Курение запрещено' })).toBeChecked();
  await expect(form.getByLabel('Минимальный возраст гостя')).toHaveValue('18');

  await form.getByLabel('Краткое описание').fill('Уютный хостел\nв центре города');
  await expect(form.getByText('29/500')).toBeVisible();
  await form.getByLabel('Сайт', { exact: true }).fill('luxxaparts.kz');
  await form.getByLabel('Публичное имя для документов').fill('Luxx Aparts Центр');
  await form.getByRole('switch', { name: 'Ранний заезд' }).check();
  await form.getByRole('switch', { name: 'Можно с питомцами' }).check();
  await form.getByRole('switch', { name: 'Курение запрещено' }).uncheck();
  await form.getByLabel('Способ оплаты на месте').selectOption('CARD');
  await form.getByLabel('Отмена брони').selectOption('FREE_3D');
  await form.getByLabel('Залог').selectOption('FIRST_NIGHT');
  await form.getByLabel('Минимальный возраст гостя').fill('21');
  await form.getByLabel('Тихие часы, начало').fill('23:00');
  await form.getByLabel('Тихие часы, конец').fill('7:30');
  await form.getByLabel('Дополнительные комментарии').fill('Просим соблюдать тишину.');
  await form.getByRole('checkbox', { name: 'Wi-Fi' }).check();
  await form.getByRole('checkbox', { name: 'Кухня' }).check();
  await save.click();
  await expect(main.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');
  await expect(main.getByRole('alert')).toHaveCount(0);

  await page.reload();
  await expect(form.getByLabel('Краткое описание')).toHaveValue('Уютный хостел\nв центре города');
  await expect(form.getByLabel('Сайт', { exact: true })).toHaveValue('https://luxxaparts.kz');
  await expect(form.getByLabel('Публичное имя для документов')).toHaveValue('Luxx Aparts Центр');
  await expect(form.getByRole('switch', { name: 'Ранний заезд' })).toBeChecked();
  await expect(form.getByRole('switch', { name: 'Поздний выезд' })).not.toBeChecked();
  await expect(form.getByRole('switch', { name: 'Можно с питомцами' })).toBeChecked();
  await expect(form.getByRole('switch', { name: 'Курение запрещено' })).not.toBeChecked();
  await expect(form.getByLabel('Способ оплаты на месте')).toHaveValue('CARD');
  await expect(form.getByLabel('Отмена брони')).toHaveValue('FREE_3D');
  await expect(form.getByLabel('Залог')).toHaveValue('FIRST_NIGHT');
  await expect(form.getByLabel('Минимальный возраст гостя')).toHaveValue('21');
  await expect(form.getByLabel('Тихие часы, конец')).toHaveValue('07:30');
  await expect(form.getByRole('checkbox', { name: 'Wi-Fi' })).toBeChecked();
  await expect(form.getByRole('checkbox', { name: 'Кухня' })).toBeChecked();
  await expect(form.getByRole('checkbox', { name: 'Парковка' })).not.toBeChecked();
  await expect(save).toBeDisabled();
});

test('карточка объекта: снятие всех удобств и возврат значения гасят «есть изменения»', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/hotel-settings');
  const main = page.getByRole('main');
  const form = main.getByTestId('hotel-settings-form');
  const save = main.locator('.page__actions').getByRole('button', { name: 'Сохранить изменения' });
  const wifi = form.getByRole('checkbox', { name: 'Wi-Fi' });
  await wifi.check();
  await expect(save).toBeEnabled();
  await wifi.uncheck();
  await expect(save).toBeDisabled();
  await form.getByRole('switch', { name: 'Поздний выезд' }).check();
  await expect(save).toBeEnabled();
  await form.getByRole('switch', { name: 'Поздний выезд' }).uncheck();
  await expect(save).toBeDisabled();
  await wifi.check();
  await save.click();
  await expect(main.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');
  await wifi.uncheck();
  await save.click();
  await expect(main.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');
  await page.reload();
  await expect(wifi).not.toBeChecked();
});

test('карточка объекта: ошибки словами у поля и от API, ввод не пропадает', async ({ page }) => {
  await signIn(page);
  await page.goto('/hotel-settings');
  const main = page.getByRole('main');
  const form = main.getByTestId('hotel-settings-form');
  const save = main.locator('.page__actions').getByRole('button', { name: 'Сохранить изменения' });
  await form.getByLabel('Сайт', { exact: true }).fill('javascript:alert(1)');
  await form.getByLabel('Минимальный возраст гостя').fill('150');
  await save.click();
  await expect(form.getByText('Адрес сайта в виде https://example.kz')).toBeVisible();
  await expect(form.getByText('Возраст — целое число от 0 до 99')).toBeVisible();
  // подпись поля теперь содержит и текст ошибки, поэтому поле ищем по имени
  await expect(form.locator('input[name=website]')).toHaveValue('javascript:alert(1)');
  await form.locator('input[name=website]').fill('');
  await form.getByLabel('Минимальный возраст гостя').fill('16');
  // одно время из пары тихих часов: отказ API словами, ввод остаётся
  await form.getByLabel('Тихие часы, начало').fill('22:00');
  await form.getByLabel('Тихие часы, конец').fill('');
  await save.click();
  await expect(main.getByRole('alert')).toContainText('Тихие часы задаются парой');
  await expect(form.getByLabel('Тихие часы, начало')).toHaveValue('22:00');
});

test('предпросмотр карточки показывает ещё не сохранённые правки', async ({ page }) => {
  await signIn(page);
  await page.goto('/hotel-settings');
  const main = page.getByRole('main');
  const form = main.getByTestId('hotel-settings-form');
  await form.getByLabel('Название объекта').fill('Хостел Вымысел');
  await form.getByLabel('Краткое описание').fill('Тихое место у парка');
  await form.getByRole('checkbox', { name: 'Парковка' }).check();
  const preview = main.getByTestId('object-preview');
  await expect(preview).toContainText('Хостел Вымысел');
  await expect(preview).toContainText('Заезд с 14:00');
  await expect(preview.getByRole('list', { name: 'Удобства' })).toContainText('Парковка');
  await main.getByTestId('preview-open').click();
  const dialog = page.getByRole('dialog', { name: 'Предпросмотр карточки' });
  await expect(dialog).toContainText('Хостел Вымысел');
  await expect(dialog).toContainText('Тихое место у парка');
  await expect(dialog).toContainText('Курение');
  await expect(dialog).toContainText('запрещено');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('«Добавить услугу» раскрывает остальные удобства, номера и места считаются по фонду', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/hotel-settings');
  const main = page.getByRole('main');
  const form = main.getByTestId('hotel-settings-form');
  await expect(form.getByRole('checkbox', { name: 'Сауна' })).toHaveCount(0);
  await form.getByTestId('amenities-more').click();
  await expect(form.getByRole('checkbox', { name: 'Сауна' })).toHaveCount(1);
  await expect(form.getByTestId('amenities-more')).toHaveCount(0);
  await expect(form.getByLabel('Количество номеров')).toHaveAttribute('readonly', '');
  await expect(form.getByLabel('Количество номеров')).toHaveValue(/^\d+$/);
  await expect(form.getByLabel('Количество мест')).toHaveValue(/^\d+$/);
});

test('«Проживание» шлёт свои поля и не затирает «Основное»', async ({ page }) => {
  await signIn(page);
  await page.goto('/hotel-settings');
  const main = page.getByRole('main');
  await main
    .getByTestId('hotel-settings-form')
    .getByRole('checkbox', { name: 'Wi-Fi' })
    .check();
  await main.locator('.page__actions').getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(main.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');
  await page.goto('/hotel-settings/stay');
  const stay = main.getByTestId('stay-form');
  await stay.getByRole('switch', { name: 'Можно с питомцами' }).check();
  await stay.getByLabel('Залог').selectOption('HALF');
  await main.locator('.page__actions').getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(main.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');
  await page.goto('/hotel-settings');
  const general = main.getByTestId('hotel-settings-form');
  await expect(general.getByRole('checkbox', { name: 'Wi-Fi' })).toBeChecked();
  await expect(general.getByRole('switch', { name: 'Можно с питомцами' })).toBeChecked();
  await expect(general.getByLabel('Залог')).toHaveValue('HALF');
});

test('фото объекта: загрузка, показ в карточке справа, удаление', async ({ page }) => {
  await signIn(page);
  await page.goto('/hotel-settings');
  const main = page.getByRole('main');
  const photos = main.getByTestId('photos-block');
  await expect(photos.getByRole('img')).toHaveCount(0);
  await photos.getByLabel('Файл фото').setInputFiles({
    name: 'номер.png',
    mimeType: 'image/png',
    buffer: Buffer.from('вымышленная картинка'),
  });
  await expect(photos.getByRole('img', { name: 'Фото объекта' })).toHaveCount(1);
  await expect(main.getByTestId('object-preview').getByRole('img')).toHaveCount(1);
  // загрузка не делает форму сведений «изменённой»
  await expect(
    main.locator('.page__actions').getByRole('button', { name: 'Сохранить изменения' }),
  ).toBeDisabled();
  await photos.getByRole('button', { name: 'Удалить фото' }).click();
  await expect(photos.getByRole('img')).toHaveCount(0);
});

test('договор объекта: только PDF, новый заменяет прежний, удаление', async ({ page }) => {
  await signIn(page);
  await page.goto('/hotel-settings');
  const contract = page.getByRole('main').getByTestId('contract-block');
  await expect(contract).toContainText('Файл договора не загружен');
  await contract.getByLabel('Файл договора').setInputFiles({
    name: 'скан.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('MZ не договор'),
  });
  await expect(contract.getByRole('alert').filter({ hasText: 'только в формате PDF' })).toBeVisible();
  await contract.getByLabel('Файл договора').setInputFiles({
    name: 'Договор_Luxx.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 вымышленный договор'),
  });
  await expect(contract.getByRole('link', { name: 'Договор_Luxx.pdf' })).toBeVisible();
  await contract.getByLabel('Файл договора').setInputFiles({
    name: 'Договор_2.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 новая редакция'),
  });
  await expect(contract.getByRole('link', { name: 'Договор_2.pdf' })).toBeVisible();
  await expect(contract.getByRole('link', { name: 'Договор_Luxx.pdf' })).toHaveCount(0);
  await contract.getByRole('button', { name: 'Удалить договор' }).click();
  await expect(contract).toContainText('Файл договора не загружен');
});

test('хранилище файлов выключено: загрузки нет, причина сказана словами', async ({
  page,
  request,
}) => {
  await signIn(page);
  await request.post(`${API}/__test/control`, { data: { mediaStorageOff: true } });
  await page.goto('/hotel-settings');
  const main = page.getByRole('main');
  await expect(main.getByTestId('photos-block')).toContainText('Хранилище файлов не включено');
  await expect(main.getByRole('button', { name: 'Добавить фото' })).toHaveCount(0);
  await expect(main.getByTestId('contract-block').getByRole('button', { name: /договор/i })).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`карточка объекта: доступность и 390 px без горизонтальной прокрутки: ${theme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await signIn(page);
    for (const path of [
      '/hotel-settings',
      '/hotel-settings/stay',
      '/hotel-settings/sales',
      '/hotel-settings/documents',
    ]) {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.goto(path);
        await expect(page.getByRole('main')).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        const audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(audit.violations, `${path} ${width}`).toEqual([]);
      }
    }
  });
}
