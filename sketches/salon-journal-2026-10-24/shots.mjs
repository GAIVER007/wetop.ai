import { chromium } from '@playwright/test';
const base = 'file:///home/hermes/wt-book/sketches/salon-journal-2026-10-24/index.html';
const out = '/home/hermes/wt-book/sketches/salon-journal-2026-10-24';
const shots = [['A-desk', 1440, 1100, 'v=A'], ['B-desk', 1440, 1100, 'v=B'], ['C-desk', 1440, 820, 'v=C'], ['A-phone', 390, 844, 'v=A&d=phone'], ['B-phone', 390, 844, 'v=B&d=phone'], ['C-phone', 390, 844, 'v=C&d=phone']];
const b = await chromium.launch();
for (const [n, w, h, q] of shots) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 });
  await p.goto(`${base}?${q}`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${out}/${n}.png` });
  console.log(n, await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await p.close();
}
await b.close();
