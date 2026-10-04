import type { Locator } from '@playwright/test';

/**
 * Компактная форма «Новая бронь» (решение 01.10.2026, DECISIONS «Компактное создание брони»): источник, промокод,
 * заметки и добавление размещения лежат под раскрытием «Дополнительно». Скрытый `select` Playwright не выбирает,
 * поэтому сначала раскрываем блок, если он свёрнут.
 */
export async function openExtras(form: Locator): Promise<void> {
  const extras = form.locator('details.booking-create__extras');
  // у формы правки существующей брони раскрытия нет: источник виден сразу
  if ((await extras.count()) === 0) return;
  if (!(await extras.evaluate((d) => (d as HTMLDetailsElement).open))) {
    await extras.locator('summary').click();
  }
}

/** Выбрать источник брони: раскрывает «Дополнительно» и ставит значение в `select[name="source"]` */
export async function chooseSource(form: Locator, value: string): Promise<void> {
  await openExtras(form);
  await form.locator('select[name="source"]').selectOption(value);
}
