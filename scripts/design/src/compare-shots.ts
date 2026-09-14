/**
 * Сравнение двух папок со скриншотами попиксельно — через Chromium, без библиотек декодирования PNG.
 * Для каждого одноимённого файла печатает число отличающихся пикселей и прямоугольник, где они лежат,
 * чтобы отличить «поменялась минута в строке свежести» от «поехал экран».
 *
 * Запуск: `npx tsx scripts/design/src/compare-shots.ts <до> <после> [--threshold=0] [--out=<папка картинок отличий>] [--ignore=x,y,w,h …]`
 * Браузер: установленный Chrome или `UI_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium`.
 * Код выхода 1, если у какого-то файла отличий больше порога (пикселей).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

export interface ShotDiff {
  file: string;
  width: number;
  height: number;
  differing: number;
  box: { x: number; y: number; w: number; h: number } | null;
  sizeMismatch: boolean;
}

const DIFF_BODY = `
  const [dataA, dataB, wantImage, ignore] = args;
  const load = (src) => new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error('png'));
    img.src = 'data:image/png;base64,' + src;
  });
  return Promise.all([load(dataA), load(dataB)]).then(([ia, ib]) => {
    if (ia.width !== ib.width || ia.height !== ib.height)
      return { width: ib.width, height: ib.height, differing: -1, box: null };
    const draw = (id, img) => {
      const c = document.getElementById(id);
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, img.width, img.height).data;
    };
    const pa = draw('a', ia), pb = draw('b', ib);
    let differing = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    const ignored = (x, y) => ignore.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    for (let i = 0; i < pa.length; i += 4) {
      if (pa[i] === pb[i] && pa[i+1] === pb[i+1] && pa[i+2] === pb[i+2] && pa[i+3] === pb[i+3]) continue;
      const p = i / 4, x = p % ia.width, y = Math.floor(p / ia.width);
      if (ignored(x, y)) continue;
      differing++;
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    let image = null;
    if (differing && wantImage) {
      // картинка отличий: «после» в полтона, отличающиеся пиксели — красным
      const c = document.getElementById('a');
      const ctx = c.getContext('2d');
      const out = ctx.createImageData(ia.width, ia.height);
      for (let i = 0; i < pb.length; i += 4) {
        const q = i / 4;
        const same = (pa[i] === pb[i] && pa[i+1] === pb[i+1] && pa[i+2] === pb[i+2] && pa[i+3] === pb[i+3]) || ignored(q % ia.width, Math.floor(q / ia.width));
        out.data[i] = same ? 128 + pb[i] / 2 : 255;
        out.data[i+1] = same ? 128 + pb[i+1] / 2 : 0;
        out.data[i+2] = same ? 128 + pb[i+2] / 2 : 0;
        out.data[i+3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      image = c.toDataURL('image/png');
    }
    return { width: ia.width, height: ia.height, differing, box: differing ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null, image };
  });
`;

export interface Rect { x: number; y: number; w: number; h: number }
/** `--ignore=x,y,w,h` — область, которую не сравниваем (строка свежести данных с минутами в углу меню). */
export async function compareDirs(before: string, after: string, diffDir?: string, ignore: Rect[] = []): Promise<ShotDiff[]> {
  if (diffDir) mkdirSync(diffDir, { recursive: true });
  const files = readdirSync(after).filter((f) => f.endsWith('.png') && readdirSync(before).includes(f));
  const executablePath = process.env['UI_BROWSER_EXECUTABLE'];
  const browser = await chromium.launch(executablePath ? { executablePath } : { channel: process.env['UI_BROWSER_CHANNEL'] || 'chrome' });
  const page = await browser.newPage();
  await page.setContent('<!doctype html><canvas id="a"></canvas><canvas id="b"></canvas>');
  const out: ShotDiff[] = [];
  for (const file of files) {
    const a = readFileSync(resolve(before, file)).toString('base64');
    const b = readFileSync(resolve(after, file)).toString('base64');
    // Тело — строкой через new Function: tsx подставляет в функции помощник __name, которого в браузере нет,
    // а строку-выражение Playwright вызывает без аргументов. new Function сериализуется как обычная функция.
    const diff = new Function('args', DIFF_BODY) as (
      args: [string, string, boolean, Rect[]],
    ) => Promise<Omit<ShotDiff, 'file' | 'sizeMismatch'> & { image: string | null }>;
    const { image, ...result } = await page.evaluate(diff, [a, b, Boolean(diffDir), ignore] as [string, string, boolean, Rect[]]);
    if (image && diffDir) writeFileSync(resolve(diffDir, file.replace(/\.png$/, '.diff.png')), Buffer.from(image.split(',')[1]!, 'base64'));
    out.push({ file, ...result, sizeMismatch: result.differing < 0 });
  }
  await browser.close();
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [before, after] = process.argv.slice(2).filter((a) => !a.startsWith('--')) as [string, string];
  const threshold = Number(process.argv.find((a) => a.startsWith('--threshold='))?.split('=')[1] ?? 0);
  if (!before || !after) {
    console.error('Укажите две папки: compare-shots.ts <до> <после>');
    process.exit(2);
  }
  const outDir = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];
  const ignore = process.argv
    .filter((a) => a.startsWith('--ignore='))
    .map((a) => {
      const [x, y, w, h] = a.slice('--ignore='.length).split(',').map(Number) as [number, number, number, number];
      return { x, y, w, h };
    });
  const diffs = await compareDirs(resolve(before), resolve(after), outDir ? resolve(outDir) : undefined, ignore);
  let bad = 0;
  for (const d of diffs) {
    const where = d.sizeMismatch ? 'размер отличается' : d.box ? `${d.differing} px в области x=${d.box.x} y=${d.box.y} ${d.box.w}×${d.box.h}` : 'совпадает';
    if (d.sizeMismatch || d.differing > threshold) bad++;
    console.log(`${d.sizeMismatch || d.differing > threshold ? 'DIFF ' : 'ok   '} ${d.file}: ${where}`);
  }
  process.exit(bad ? 1 : 0);
}
