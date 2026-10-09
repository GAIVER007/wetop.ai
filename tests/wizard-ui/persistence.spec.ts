import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { wizardStandDatabaseUrl } from '../tools/seed-local';

test('анонимный браузер → Next proxy → Nest → PostgreSQL → reload', async ({ page }) => {
  const db = createPrismaClient(wizardStandDatabaseUrl(), 'public');
  let token: string | null = null;
  try {
    await page.goto('/create?ref=loopback-e2e');
    await page.getByRole('button', { name: 'Начать создание' }).click();
    token = await page.evaluate(() => localStorage.getItem('wetop.wizard.token'));
    await page.getByRole('button', { name: 'Настроить вручную' }).click();
    await page.getByLabel('Название компании').fill('Синтетический хостел');
    await page.getByLabel('Ниша').fill('Тестовый объект');
    await page.getByLabel('Имя ассистента').fill('Тестовый помощник');
    await page.getByRole('button', { name: 'Сохранить черновик' }).click();
    await expect(page.getByRole('status')).toContainText('Черновик сохранён');
    const session = await db.wizardSession.findUnique({
      where: { tokenHash: createHash('sha256').update(token!).digest('hex') },
      include: { draft: true },
    });
    expect(session?.draft?.businessName).toBe('Синтетический хостел');
    expect(session?.tokenHash).not.toBe(token);
    await page.reload();
    await expect(page.getByLabel('Название компании')).toHaveValue('Синтетический хостел');
    await page.getByLabel('Описание').fill('Автоматически сохранённое описание');
    await expect(page.getByRole('status')).toContainText('Черновик сохранён');
    await page.reload();
    await expect(page.getByLabel('Описание')).toHaveValue('Автоматически сохранённое описание');
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: `reports/guest-wizard-2026-09-26/${colorScheme}-${width}.png`,
          fullPage: true,
        });
      }
    }
  } finally {
    token ??= await page
      .evaluate(() => localStorage.getItem('wetop.wizard.token'))
      .catch(() => null);
    if (token)
      await db.wizardSession.deleteMany({
        where: { tokenHash: createHash('sha256').update(token).digest('hex') },
      });
    await db.$disconnect();
  }
});

test('прокси не принимает чужой Origin, неизвестные команды и неверный токен', async ({
  request,
}) => {
  const foreign = await request.post('/api/wizard', {
    headers: { origin: 'https://other.example.invalid' },
    data: { operation: 'open' },
  });
  expect(foreign.status()).toBe(403);
  expect((await request.post('/api/wizard', { data: { operation: 'arbitrary' } })).status()).toBe(
    400,
  );
  expect(
    (await request.post('/api/wizard', { data: { operation: 'open', token: 123 } })).status(),
  ).toBe(401);
  expect(
    (
      // потолок прокси считается в БАЙТАХ (48 000, SEC-4: 24 000 знаков русского текста дают до 48 000
      // байт) и проверяется до чтения тела. Прежние 25 000 ASCII-знаков в него укладывались, и тест
      // ждал отказа от запроса, который по правилу законен
      await request.post('/api/wizard', { data: { operation: 'open', ref: 'a'.repeat(60_000) } })
    ).status(),
  ).toBe(413);
});
