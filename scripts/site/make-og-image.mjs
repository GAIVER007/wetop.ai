/**
 * Картинка ссылки (og:image) для wetop.ai: 1200×630, `apps/site/public/og.png`. Вариант «А» владельца 29.10.2026:
 * гостиницы, салоны красоты и рестораны (раньше «хостел и мини-отель»). После перерисовки поднять `?v=` в
 * `apps/site/src/lib/metadata.ts` (OG_IMAGE): мессенджеры кэшируют картинку по адресу.
 * Её показывают WhatsApp, Telegram и соцсети, когда кто-то делится адресом сайта. Без неё ссылка приходит
 * голой строкой — для рынка, где ссылками делятся в мессенджерах, это потеря.
 *
 * Картинка не рисуется от руки: страница собирается из настоящих стилей сайта (`apps/site/out`), поэтому
 * шрифты и цвета те же, что на самом сайте. Перерисовать после смены токенов или названия:
 *   npm run site:build && node scripts/site/make-og-image.mjs
 * Chromium берётся из Playwright; на машине без него скрипт честно об этом скажет.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { serve } from './static-server.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(ROOT, 'apps/site/out');
const TARGET = resolve(ROOT, 'apps/site/public/og.png');

if (!existsSync(resolve(OUT, 'index.html'))) {
  console.error('Сборки нет: сначала npm run site:build');
  process.exit(2);
}

// Стили и шрифты берём из собранной страницы — не повторяем их здесь
const index = await readFile(resolve(OUT, 'index.html'), 'utf-8');
const styles = [...index.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
const fontVars = index.match(/<html[^>]*class="([^"]*)"/)?.[1] ?? '';

const html = `<!doctype html>
<html lang="ru" class="${fontVars}">
<head><meta charset="utf-8">${styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}
<style>
  html, body { margin: 0; padding: 0; background: var(--bg); }
  .card { width: 1200px; height: 630px; box-sizing: border-box; padding: 64px 80px;
          display: flex; flex-direction: column; justify-content: space-between;
          font-family: var(--font-head); background: var(--surface); }
  .brand { display: flex; align-items: center; gap: 18px; }
  .brand svg { width: 60px; height: 60px; }
  .brand rect { fill: var(--primary); }
  .brand path { fill: var(--on-primary); }
  .brand span { font-size: 42px; font-weight: 800; letter-spacing: 0.02em; color: var(--text); }
  h1 { margin: 0; font-size: 62px; line-height: 1.1; font-weight: 800; color: var(--text); max-width: 20ch; }
  p { margin: 18px 0 0; font-size: 28px; color: var(--text-2); font-family: var(--font-plex-sans); }
  .foot { display: flex; align-items: center; justify-content: space-between; }
  .chips { display: flex; gap: 14px; }
  .chips b { font-size: 28px; font-weight: 700; padding: 14px 26px; border-radius: 16px; color: var(--text); }
  .addr { font-size: 28px; color: var(--muted); font-family: var(--font-plex-mono); }
</style></head>
<body><div class="card">
  <div class="brand">
    <svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="13"></rect>
      <path d="m10 14 5 21h5l4-13 4 13h5l5-21h-5l-3 14-4-14h-4l-4 14-3-14Z"></path></svg>
    <span>WETOP</span>
  </div>
  <div>
    <h1>Одна система для сервисного бизнеса</h1>
    <p>Брони, записи, заказы, команда и деньги в одном окне.</p>
  </div>
  <div class="foot">
    <span class="chips">
      <b style="background: var(--st-confirmed)">Гостиницы</b>
      <b style="background: var(--st-tentative)">Салоны красоты</b>
      <b style="background: var(--st-checked-in)">Рестораны</b>
    </span>
    <span class="addr">wetop.ai</span>
  </div>
</div></body></html>`;

const site = await serve({ root: OUT, port: 4322, routes: { '/__og.html': html } });
let browser;
try {
  browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
} catch (e) {
  console.error(`Chromium не запустился: ${e.message}`);
  console.error('Поставьте браузеры Playwright (npx playwright install chromium) или задайте CHROMIUM_PATH.');
  await site.close();
  process.exit(2);
}
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`${site.url}/__og.html`, { waitUntil: 'networkidle' });
await page.evaluate('document.fonts.ready');
await page.screenshot({ path: TARGET });
await browser.close();
await site.close();
console.log(`Готово: ${TARGET}`);
