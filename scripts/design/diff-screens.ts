/**
 * Попиксельное сравнение снимков экранов «до» и «после» правки токенов (DESIGN.md §18, п. 2).
 * В проекте нет pixelmatch, поэтому картинки сравнивает Chromium через canvas. Пиксель считается
 * изменённым, если сумма разниц по каналам больше 24 — так не учитывается сглаживание шрифта.
 *
 * Запуск: npm run design:diff -- <папка-до> [<папка-после>=design/reference/current]
 * Порядок: скопировать design/reference/current в сторону → править токены → снять снимки заново
 * (tests/ui/design-reference.spec.ts) → сравнить. Часы и «время гостиницы» на снимках живые —
 * доли процента на главной ожидаемы; изменённая плашка или кнопка даёт единицы процентов.
 */
import { chromium } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

async function main() {
  const [before, after = 'design/reference/current'] = process.argv.slice(2);
  if (!before) {
    console.error('Укажите папку со снимками «до»: npm run design:diff -- <папка-до>');
    process.exit(2);
  }
  const executablePath = process.env['UI_BROWSER_EXECUTABLE'];
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  const files = readdirSync(resolve(before)).filter((f) => f.endsWith('.png'));
  let changed = 0;
  for (const f of files) {
    const a = readFileSync(resolve(before, f)).toString('base64');
    let b: string;
    try {
      b = readFileSync(resolve(after, f)).toString('base64');
    } catch {
      console.log(`${f.padEnd(44)} нет в «после»`);
      continue;
    }
    // функция строкой: tsx вписывает в стрелки помощник __name, которого в браузере нет
    const r = (await page.evaluate(`(async ([a, b]) => {
      const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
      const draw = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
      const da = draw(ia), db = draw(ib); let diff = 0;
      let x0 = ia.width, y0 = ia.height, x1 = -1, y1 = -1;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2]) > 24) {
        diff++; const p = i / 4, x = p % ia.width, y = (p - x) / ia.width;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return { total: da.length / 4, diff, box: diff ? [x0, y0, x1, y1] : null };
    })(${JSON.stringify([a, b])})`)) as {
      size?: number[];
      total?: number;
      diff?: number;
      box?: number[] | null;
    };
    if (r.size) {
      changed++;
      console.log(`${f.padEnd(44)} размер ${r.size[0]}×${r.size[1]} → ${r.size[2]}×${r.size[3]}`);
      continue;
    }
    const pct = (100 * r.diff!) / r.total!;
    if (r.diff! > 0) changed++;
    const box = r.box ? `  область x ${r.box[0]}–${r.box[2]}, y ${r.box[1]}–${r.box[3]}` : '';
    console.log(
      `${f.padEnd(44)} ${String(r.diff).padStart(8)} / ${r.total} px  ${pct.toFixed(3).padStart(7)} %${box}`,
    );
  }
  await browser.close();
  console.log(`\nснимков: ${files.length}, с отличиями: ${changed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
