/**
 * Картинка ссылки (og:image) для wetop.ai: 1200×630, `apps/site/public/og.png`.
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
  .card { width: 1200px; height: 630px; box-sizing: border-box; padding: 72px 88px;
          display: flex; flex-direction: column; justify-content: space-between;
          font-family: var(--font-head); background: var(--surface);
          background-image: radial-gradient(1100px 520px at 88% -12%, var(--primary-soft), transparent 70%); }
  .brand { display: flex; align-items: center; gap: 20px; }
  .brand svg { width: 68px; height: 68px; }
  .brand rect { fill: var(--primary); }
  .brand path { fill: var(--on-primary); }
  .brand span { font-size: 46px; font-weight: 800; letter-spacing: 0.02em; color: var(--text); }
  h1 { margin: 0; font-size: 58px; line-height: 1.12; font-weight: 700; color: var(--text); max-width: 21ch; }
  p { margin: 18px 0 0; font-size: 29px; line-height: 1.45; color: var(--text-2); max-width: 44ch;
      font-family: var(--font-plex-sans); }
  .foot { display: flex; align-items: center; justify-content: space-between; }
  .addr { font-size: 30px; color: var(--muted); font-family: var(--font-plex-mono); }
  .cells { display: flex; gap: 10px; }
  .cells i { width: 58px; height: 34px; border-radius: 9px; display: block; }
</style></head>
<body><div class="card">
  <div class="brand">
    <svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="13"></rect>
      <path d="m10 14 5 21h5l4-13 4 13h5l5-21h-5l-3 14-4-14h-4l-4 14-3-14Z"></path></svg>
    <span>WETOP</span>
  </div>
  <div>
    <h1>Система управления хостелом и мини-отелем</h1>
    <p>Брони, каналы продаж, счета и стойка — в одном окне.</p>
  </div>
  <div class="foot">
    <span class="addr">wetop.ai</span>
    <span class="cells">
      <i style="background: var(--st-confirmed)"></i><i style="background: var(--st-checked-in)"></i>
      <i style="background: var(--st-tentative)"></i><i style="background: var(--surface-muted); border: 1px solid var(--border)"></i>
      <i style="background: var(--st-confirmed)"></i>
    </span>
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
