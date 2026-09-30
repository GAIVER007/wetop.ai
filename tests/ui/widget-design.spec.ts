import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
const script = readFileSync(
  process.env.WIDGET_TEST_SCRIPT || 'apps/ai-seller/src/site/widget.js',
  'utf8',
);
let sent: unknown[];
test.beforeEach(async ({ page }) => {
  sent = [];
  await page.route('https://widget.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/widget.js')
      return route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: script });
    if (path === '/session') return route.fulfill({ json: { visitor_key: 'synthetic-visitor' } });
    if (path === '/messages') return route.fulfill({ json: { messages: [] } });
    if (path === '/message') {
      sent.push(route.request().postDataJSON());
      return route.fulfill({ status: 500, json: {} });
    }
    if (path === '/attachment') return route.fulfill({ json: { attachment_id: 'synthetic-file' } });
    return route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<html data-theme="dark"><body><script src="/widget.js"></script></body></html>',
    });
  });
  await page.goto('https://widget.test/');
  await page.getByRole('button', { name: 'Открыть чат', exact: true }).click();
});
test('welcome, draft suggestions, close and focus return', async ({ page }) => {
  await expect(page.getByText('Поддержка WETOP', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Как создать бронь?' }).click();
  await expect(page.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('Как создать бронь?');
  expect(sent).toHaveLength(0);
  await page.getByRole('button', { name: 'Закрыть чат' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Открыть чат', exact: true })).toBeFocused();
});
test('multiline, failure retains draft and attachment, no duplicate sends', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Сообщение' });
  await input.fill('Тестовый вопрос');
  await input.press('Shift+Enter');
  await expect(input).toHaveValue('Тестовый вопрос\n');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('synthetic') });
  await expect(page.getByText('test.png', { exact: true })).toBeVisible();
  await input.press('Enter');
  await expect(
    page.getByText('Не отправилось. Текст сохранён — попробуйте ещё раз.'),
  ).toBeVisible();
  await expect(input).toHaveValue('Тестовый вопрос\n');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ attachment_id: 'synthetic-file' });
});
test('themes and mobile layout', async ({ page }) => {
  await expect(page.locator('.pmsw-p')).toHaveCSS('background-color', 'rgb(14, 23, 38)');
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
  await expect(page.locator('.pmsw-p')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.setViewportSize({ width: 390, height: 680 });
  const box = await page.getByRole('dialog').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(680);
});
test('successful send, deduplication, safe message rendering and Escape', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route('https://widget.test/message', async (route) => {
    calls++;
    await pending;
    await route.fulfill({ json: {} });
  });
  const input = page.getByRole('textbox', { name: 'Сообщение' });
  await input.fill('Синтетический вопрос');
  await input.press('Enter');
  await expect(input).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Отправить сообщение' })).toBeDisabled();
  await input.press('Enter');
  expect(calls).toBe(1);
  await page.route('https://widget.test/messages?**', (route) =>
    route.fulfill({
      json: {
        messages: [{ id: 'test-1', role: 'assistant', text: '<img src=x onerror=alert(1)>' }],
      },
    }),
  );
  release();
  await expect(input).toHaveValue('');
  await expect(page.locator('.pmsw-m')).toHaveCount(1);
  await expect(page.locator('.pmsw-text')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.pmsw-m img')).toHaveCount(0);
  await expect(page.locator('.pmsw-empty')).toBeHidden();
  await input.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('regression: failed request preserves original draft', async ({ page }) => {
  await page.locator('.pmsw-i').fill('Синтетический черновик');
  await page.locator('.pmsw-f .pmsw-s').click();
  await expect(page.locator('.pmsw-chip')).toContainText('Не отправилось');
  await expect(page.locator('.pmsw-i')).toHaveValue('Синтетический черновик');
});

test('support distinguishes queue, operator and unknown state', async ({ page }) => {
  let mode = 'needs_human';
  await page.route('https://widget.test/messages?**', route => route.fulfill({json:{mode,messages:[]}}));
  await expect(page.locator('.pmsw-note')).toHaveText('Ожидаем сотрудника · ИИ продолжает помогать');
  mode = 'owner_takeover';
  await expect(page.locator('.pmsw-note')).toHaveText('Диалог принят сотрудником');
  mode = 'unexpected';
  await expect(page.locator('.pmsw-note')).toHaveText('Уточняем статус поддержки');
});

test('human request preserves draft and messages identify their author', async ({ page }) => {
  await page.route('https://widget.test/message', route => {sent.push(route.request().postDataJSON());return route.fulfill({json:{status:'accepted'}});});
  await page.getByRole('textbox',{name:'Сообщение',exact:true}).fill('Несохранённые подробности');
  await page.getByRole('button',{name:'Позвать сотрудника',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Сообщение',exact:true})).toHaveValue('Несохранённые подробности');
  expect(sent[0]).toMatchObject({text:'Прошу подключить сотрудника технической поддержки к этому диалогу.'});
  await page.route('https://widget.test/messages?**', route => route.fulfill({json:{mode:'owner_takeover',messages:[
    {id:'ai',role:'assistant',text:'Помогу разобраться.',at:'2026-09-30T10:00:00Z'},
    {id:'human',role:'assistant',from_operator:true,text:'Проверяю обращение.',at:'2026-09-30T10:01:00Z'}
  ]}}));
  await expect(page.locator('.pmsw-bot .pmsw-author')).toHaveText('ИИ-помощник');
  await expect(page.locator('.pmsw-op .pmsw-author')).toHaveText('Сотрудник поддержки');
});


test('support accessibility and visual evidence', async ({ page }) => {
  const folder = 'reports/support-chat-2026-09-30';
  mkdirSync(folder,{recursive:true});
  await page.route('https://widget.test/messages?**', route => route.fulfill({json:{mode:'needs_human',messages:[
    {id:'u',role:'user',text:'Где посмотреть заезды на завтра?',at:'2026-09-30T10:00:00Z'},
    {id:'a',role:'assistant',text:'Откройте «Главная» и выберите «Завтра». Там будут заезды на выбранный день.',at:'2026-09-30T10:00:05Z'}
  ]}}));
  await expect(page.locator('.pmsw-author')).toHaveCount(2);
  for (const theme of ['dark','light']) {
    await page.evaluate(theme => {document.documentElement.dataset.theme=theme;},theme);
    expect((await new AxeBuilder({page}).include('.pmsw-p').analyze()).violations).toEqual([]);
    await page.getByRole('dialog').screenshot({path:`${folder}/${theme}.png`});
  }
  await page.setViewportSize({width:320,height:568});
  const box=await page.getByRole('dialog').boundingBox();
  expect(box!.x+box!.width).toBeLessThanOrEqual(320);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  await page.getByRole('dialog').screenshot({path:`${folder}/mobile.png`});
});
