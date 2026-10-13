import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';

test('site scan returns restaurant fields and preserves them on reload', async ({ page }) => {
  let revision = 0;
  let config: Record<string, string> = {};
  let scanned = false;
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.turnstile = { render: (el, opts) => { opts.callback('synthetic-captcha'); return 'widget'; }, remove: () => {} };`,
    }),
  );
  await page.route('**/api/wizard', async (route) => {
    const body = route.request().postDataJSON();
    if (body.operation === 'save') {
      config = body.config;
      revision++;
    }
    if (body.operation === 'scan') {
      scanned = true;
      return route.fulfill({ json: { id: 'job1', state: 'queued' } });
    }
    if (body.operation === 'scan-status' && scanned) {
      config = {
        ...config,
        businessName: 'Тестовый ресторан',
        niche: 'Ресторан',
        description: 'Обеды',
        foundFields: 'businessName,niche,description',
      };
      revision = 2;
    }
    return route.fulfill({
      json: {
        scanSiteKey: 'synthetic-site-key',
        guestSessionId: 'session1',
        guestToken: 'wz_' + 'a'.repeat(64),
        lastStep: scanned ? 'review' : 'source',
        scan: scanned ? { id: 'job1', state: 'succeeded', error: null } : null,
        draft: {
          businessName: config.businessName ?? '',
          niche: config.niche ?? '',
          description: config.description ?? '',
          wizardData: config,
          revision,
          hasGenerated: false,
          testMessagesUsed: 0,
        },
      },
    });
  });
  await page.goto('/create');
  await page.getByLabel('Адрес сайта').fill('https://example.test');
  await page.getByRole('button', { name: 'Создать бота по сайту', exact: true }).click();
  await expect(page.getByLabel('Название компании')).toHaveValue('Тестовый ресторан');
  await expect(page.getByText('найдено на сайте').first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  mkdirSync('reports/ai-seller-wizard-scan-2026-10-11/screens', { recursive: true });
  await page.screenshot({
    path: `reports/ai-seller-wizard-scan-2026-10-11/screens/${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel('Название компании')).toHaveValue('Тестовый ресторан');
});

for (const outcome of ['failed', 'running'] as const) {
  test(`scan ${outcome} allows manual entry without losing input`, async ({ page }) => {
    let scanning = false;
    let revision = 0;
    let config: Record<string, string> = {};
    await page.route('https://challenges.cloudflare.com/**', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `window.turnstile={render:(el,o)=>{o.callback('synthetic');return 'x'},remove:()=>{}};`,
      }),
    );
    await page.route('**/api/wizard', async (route) => {
      const body = route.request().postDataJSON();
      if (body.operation === 'save') {
        config = body.config;
        revision++;
      }
      if (body.operation === 'scan') {
        scanning = true;
        return route.fulfill({ json: { id: 'job1', state: 'queued' } });
      }
      return route.fulfill({
        json: {
          scanSiteKey: 'synthetic',
          guestSessionId: 'session1',
          guestToken: 'wz_' + 'a'.repeat(64),
          lastStep: 'review',
          scan: scanning
            ? {
                id: 'job1',
                state: outcome,
                error:
                  outcome === 'failed'
                    ? 'Не удалось прочитать сайт. Заполните данные вручную'
                    : null,
              }
            : null,
          draft: {
            wizardData: config,
            businessName: '',
            niche: '',
            description: '',
            revision,
            hasGenerated: false,
            testMessagesUsed: 0,
          },
        },
      });
    });
    // The mock starts at review so explicitly visit the source step.
    await page.goto('/create');
    await page.getByRole('button', { name: 'Назад', exact: true }).click();
    await page.getByLabel('Адрес сайта').fill('https://example.test');
    await page.getByRole('button', { name: 'Создать бота по сайту', exact: true }).click();
    if (outcome === 'running')
      await page.getByRole('button', { name: 'Заполнить вручную, пока ждём' }).click();
    else await expect(page.locator('.guest-wizard__error[role=alert]')).toContainText('Не удалось прочитать сайт');
    await page.getByLabel('Название компании').fill('Мой синтетический салон');
    await expect(page.getByLabel('Название компании')).toHaveValue('Мой синтетический салон');
  });
}
