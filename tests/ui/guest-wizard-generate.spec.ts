import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';

for (const outcome of ['succeeded', 'failed'] as const) {
  test(`support generation ${outcome}, reload and edit`, async ({ page }) => {
    let revision = 1;
    let step = 'source';
    let started = false;
    let count = 0;
    let config: Record<string, string> = {
      businessName: 'Синтетический салон',
      niche: 'Салон красоты',
      description: 'Стрижка 5000 KZT',
      botType: 'sales',
    };
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
        step = body.step;
        started = false;
      }
      if (body.operation === 'generate') {
        expect(config.botType).toBe('support');
        expect(body.challenge).toBe('synthetic');
        started = true;
        count++;
        return route.fulfill({ json: { id: 'generation1', state: 'queued' } });
      }
      return route.fulfill({
        json: {
          generateSiteKey: 'synthetic',
          guestSessionId: 'session1',
          guestToken: 'wz_' + 'a'.repeat(64),
          lastStep: step,
          generationsUsed: count,
          generation: started
            ? {
                id: 'generation1',
                state: outcome,
                error: outcome === 'failed' ? 'Не удалось собрать помощника' : null,
              }
            : null,
          generated:
            started && outcome === 'succeeded'
              ? {
                  prompt: 'Ты помощник поддержки салона. Не навязывай продажу.',
                  knowledge: [{ title: 'Услуги', content: 'Стрижка 5000 KZT' }],
                }
              : null,
          draft: {
            ...config,
            wizardData: config,
            revision,
            hasGenerated: started && outcome === 'succeeded',
            testMessagesUsed: 0,
          },
        },
      });
    });
    await page.goto('/create');
    await page.getByRole('radio', { name: 'Поддержка сайта', exact: true }).click();
    await page.getByRole('button', { name: 'или заполнить вручную, без сайта' }).click();
    await page.getByRole('button', { name: 'Далее', exact: true }).click();
    await page.getByRole('button', { name: 'Собрать помощника', exact: true }).click();
    if (outcome === 'succeeded') {
      await expect(page.getByRole('heading', { name: 'Инструкция и знания готовы' })).toBeVisible();
      await page.getByText('Инструкция помощника', { exact: true }).click();
      await expect(
        page.getByText('Ты помощник поддержки салона. Не навязывай продажу.', { exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Инструкция и знания готовы' })).toBeVisible();
      expect(count).toBe(1);
    } else {
      await expect(page.getByText('Не удалось собрать помощника', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Повторить сборку' })).toBeVisible();
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    mkdirSync('reports/ai-seller-wizard-generation-2026-10-11/screens', { recursive: true });
    await page.screenshot({
      path: `reports/ai-seller-wizard-generation-2026-10-11/screens/${outcome}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Поправить данные', exact: true }).click();
    await expect(page.getByLabel('Название компании')).toHaveValue('Синтетический салон');
    await expect(page.getByRole('heading', { name: 'Инструкция и знания готовы' })).toHaveCount(0);
  });
}
