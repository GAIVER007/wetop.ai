import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';

for (const technicalFailure of [false, true]) {
  test(`guest chat: reply, reload, quota and retry=${technicalFailure}`, async ({ page }) => {
    let used = 0;
    let revision = 1;
    let lastStep = 'generating';
    let pending = false;
    const failed: string[] = [];
    const messages: Array<{
      requestId: string;
      role: string;
      text: string;
      state: string;
      sources: string[];
    }> = [];
    const requests = new Set<string>();
    const config = {
      businessName: 'Синтетический ресторан',
      niche: 'Ресторан',
      description: 'Обеды',
      botType: 'support',
    };
    await page.route('https://challenges.cloudflare.com/**', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `window.turnstile={render:(el,o)=>{o.callback('synthetic');return 'x'},remove:()=>{}};`,
      }),
    );
    await page.route('**/api/wizard', async (route) => {
      const body = route.request().postDataJSON();
      if (body.operation === 'message') {
        expect(requests.has(body.requestId)).toBe(false);
        requests.add(body.requestId);
        used++;
        messages.push({
          requestId: body.requestId,
          role: 'user',
          text: body.text,
          state: 'queued',
          sources: [],
        });
        pending = true;
        return route.fulfill({ json: { requestId: body.requestId, state: 'queued' } });
      }
      if (body.operation === 'scan-status' && pending) {
        pending = false;
        const m = messages[messages.length - 1]!;
        if (technicalFailure && requests.size === 1) {
          m.state = 'failed';
          failed.push(m.requestId);
          used--;
        } else {
          m.state = 'succeeded';
          messages.push({
            requestId: m.requestId,
            role: 'assistant',
            text: 'В меню есть обеды.',
            state: 'succeeded',
            sources: ['Меню'],
          });
        }
      }
      if (body.operation === 'save') {
        revision++;
        lastStep = body.step;
      }
      return route.fulfill({
        json: {
          guestToken: 'wz_' + 'b'.repeat(64),
          guestSessionId: 'synthetic',
          lastStep,
          generateSiteKey: 'synthetic',
          chatSiteKey: 'synthetic',
          generation: { id: 'g1', state: 'succeeded', error: null },
          generated: {
            prompt: 'Отвечай по меню ресторана.',
            knowledge: [{ title: 'Меню', content: 'Обеды' }],
          },
          chat: {
            enabled: true,
            used,
            limit: 5,
            messages: messages.filter((m) => m.state !== 'failed'),
            failed,
          },
          draft: {
            ...config,
            wizardData: config,
            revision,
            hasGenerated: true,
            testMessagesUsed: used,
          },
        },
      });
    });
    await page.goto('/create');
    await expect(
      page.getByRole('heading', { name: 'Проверьте помощника в разговоре' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Какие услуги вы предлагаете?' }).click();
    await page.getByRole('button', { name: 'Отправить сообщение' }).click();
    if (technicalFailure) {
      await expect(
        page.getByText(
          'Один из запросов не выполнен. Квота возвращена, можно отправить вопрос ещё раз.',
        ),
      ).toBeVisible();
      await expect(page.getByText('Осталось 5 из 5 сообщений', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Какие услуги вы предлагаете?' }).click();
      await page.getByRole('button', { name: 'Отправить сообщение' }).click();
    }

    await expect(page.getByText('В меню есть обеды.', { exact: true })).toBeVisible();
    await expect(page.getByText('Осталось 4 из 5 сообщений', { exact: true })).toBeVisible();
    await page.getByText('Ответ построен по разделам', { exact: true }).click();
    await expect(page.getByRole('log').getByText('Меню', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('В меню есть обеды.', { exact: true })).toBeVisible();
    expect(requests.size).toBe(technicalFailure ? 2 : 1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    mkdirSync('reports/ai-seller-wizard-chat-2026-10-11/screens', { recursive: true });
    await page.screenshot({
      path: `reports/ai-seller-wizard-chat-2026-10-11/screens/chat-${technicalFailure ? 'retry' : 'success'}-${test.info().project.name}.png`,
      fullPage: true,
    });
    used = 5;
    await page.getByRole('button', { name: 'Обновить разговор' }).click();
    await expect(page.getByText('Осталось 0 из 5 сообщений', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Отправить сообщение' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Поправить данные', exact: true }).click();
    await expect(page.getByLabel('Название компании')).toHaveValue('Синтетический ресторан');
  });
}
