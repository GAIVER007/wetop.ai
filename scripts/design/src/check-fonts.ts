/**
 * Проверка шрифтов-кандидатов для стойки (план дизайн-системы, шаг 2; DESIGN.md §6).
 *
 * Для каждого файла TTF/OTF читаем таблицы шрифта напрямую (без библиотек):
 *   - `cmap` (форматы 4 и 12): есть ли казахские буквы ә ғ қ ң ө ұ ү һ і в обоих регистрах, латиница, кириллица;
 *   - `hmtx`/`hhea`/`head`: одинакова ли ширина цифр 0–9 (табличные цифры по умолчанию);
 *   - `GSUB`: есть ли возможность `tnum` (табличные цифры включаются свойством font-variant-numeric).
 * Затем Chromium рисует лист «1 l I 0 O» и цифры в 12 и 13 px — снимок в design/reference/fonts/,
 * и измеряет ширину «1111» и «0000» в браузере (та же проверка живьём).
 *
 * Запуск: `npm run design:fonts -- <путь к шрифту> [ещё пути]`. Пути с именем: `Inter=/path/Inter.ttf`.
 * Браузер: установленный Chrome или `UI_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium`.
 * Отчёт: design/reference/fonts/report.md. Сеть не нужна.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { chromium } from '@playwright/test';

export const KAZAKH = 'әғқңөұүһіӘҒҚҢӨҰҮҺІ';
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CYRILLIC = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const DIGITS = '0123456789';

interface Tables {
  [tag: string]: { offset: number; length: number };
}
function tables(buf: Buffer): Tables {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let base = 0;
  const tag = buf.toString('latin1', 0, 4);
  if (tag === 'ttcf') base = view.getUint32(12); // первая гарнитура коллекции
  const numTables = view.getUint16(base + 4);
  const out: Tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = base + 12 + i * 16;
    out[buf.toString('latin1', rec, rec + 4)] = { offset: view.getUint32(rec + 8), length: view.getUint32(rec + 12) };
  }
  return out;
}

/** Код символа → индекс глифа по cmap (Unicode, форматы 4 и 12). */
export function cmapLookup(buf: Buffer): (cp: number) => number {
  const t = tables(buf)['cmap'];
  if (!t) throw new Error('Нет таблицы cmap');
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = view.getUint16(t.offset + 2);
  const subtables: Array<{ format: number; offset: number }> = [];
  for (let i = 0; i < n; i++) {
    const rec = t.offset + 4 + i * 8;
    const platform = view.getUint16(rec);
    const encoding = view.getUint16(rec + 2);
    const offset = t.offset + view.getUint32(rec + 4);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (unicode) subtables.push({ format: view.getUint16(offset), offset });
  }
  const f12 = subtables.find((s) => s.format === 12);
  const f4 = subtables.find((s) => s.format === 4);
  return (cp: number) => {
    if (f12) {
      const groups = view.getUint32(f12.offset + 12);
      for (let g = 0; g < groups; g++) {
        const rec = f12.offset + 16 + g * 12;
        const start = view.getUint32(rec);
        const end = view.getUint32(rec + 4);
        if (cp >= start && cp <= end) return view.getUint32(rec + 8) + (cp - start);
      }
    }
    if (f4 && cp <= 0xffff) {
      const segX2 = view.getUint16(f4.offset + 6);
      const ends = f4.offset + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const ranges = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = view.getUint16(ends + s * 2);
        if (cp > end) continue;
        const start = view.getUint16(starts + s * 2);
        if (cp < start) return 0;
        const delta = view.getInt16(deltas + s * 2);
        const rangeOffset = view.getUint16(ranges + s * 2);
        if (rangeOffset === 0) return (cp + delta) & 0xffff;
        const glyphAddr = ranges + s * 2 + rangeOffset + (cp - start) * 2;
        const glyph = view.getUint16(glyphAddr);
        return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
      }
    }
    return 0;
  };
}

/** Ширина глифа в единицах em (hmtx; у переменных шрифтов — экземпляр по умолчанию). */
export function advance(buf: Buffer): (glyph: number) => number {
  const t = tables(buf);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const hhea = t['hhea'];
  const hmtx = t['hmtx'];
  const head = t['head'];
  if (!hhea || !hmtx || !head) throw new Error('Нет hhea/hmtx/head');
  const numH = view.getUint16(hhea.offset + 34);
  const upem = view.getUint16(head.offset + 18);
  return (glyph: number) => view.getUint16(hmtx.offset + Math.min(glyph, numH - 1) * 4) / upem;
}

/** Теги возможностей GSUB (`tnum`, `kern`, `liga` …). */
export function gsubFeatures(buf: Buffer): string[] {
  const t = tables(buf)['GSUB'];
  if (!t) return [];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const featureList = t.offset + view.getUint16(t.offset + 6);
  const count = view.getUint16(featureList);
  const tags = new Set<string>();
  for (let i = 0; i < count; i++) tags.add(buf.toString('latin1', featureList + 2 + i * 6, featureList + 6 + i * 6));
  return [...tags].sort();
}

/** Имя семейства (name ID 1, Windows Unicode или Macintosh Roman). */
export function familyName(buf: Buffer): string | null {
  const t = tables(buf)['name'];
  if (!t) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const count = view.getUint16(t.offset + 2);
  const strings = t.offset + view.getUint16(t.offset + 4);
  let fallback: string | null = null;
  for (let i = 0; i < count; i++) {
    const rec = t.offset + 6 + i * 12;
    const platform = view.getUint16(rec);
    const nameId = view.getUint16(rec + 6);
    const length = view.getUint16(rec + 8);
    const offset = strings + view.getUint16(rec + 10);
    if (nameId !== 1) continue;
    if (platform === 3) return buf.subarray(offset, offset + length).swap16().toString('utf16le');
    if (platform === 1 && !fallback) fallback = buf.toString('latin1', offset, offset + length);
  }
  return fallback;
}

export interface FontReport {
  name: string;
  file: string;
  family: string | null;
  kazakhMissing: string[];
  latinMissing: number;
  cyrillicMissing: number;
  digitWidths: number[];
  tabularByDefault: boolean;
  hasTnum: boolean;
  features: string[];
  rendered?: { w1111: number; w0000: number; tabularInBrowser: boolean; snapshots: string[] };
}

export function inspect(name: string, file: string): FontReport {
  const buf = readFileSync(file);
  const glyph = cmapLookup(buf);
  const adv = advance(buf);
  const missing = (chars: string) => [...chars].filter((c) => glyph(c.codePointAt(0)!) === 0);
  const digitWidths = [...DIGITS].map((d) => Number(adv(glyph(d.codePointAt(0)!)).toFixed(4)));
  const features = gsubFeatures(buf);
  return {
    name,
    file,
    family: familyName(buf),
    kazakhMissing: missing(KAZAKH),
    latinMissing: missing(LATIN).length,
    cyrillicMissing: missing(CYRILLIC).length,
    digitWidths,
    tabularByDefault: new Set(digitWidths).size === 1,
    hasTnum: features.includes('tnum'),
    features,
  };
}

const mime = (file: string) =>
  file.endsWith('.otf') ? 'font/otf' : file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.woff') ? 'font/woff' : 'font/ttf';

export async function render(reports: FontReport[], outDir: string) {
  const executablePath = process.env['UI_BROWSER_EXECUTABLE'];
  const browser = await chromium.launch(executablePath ? { executablePath } : { channel: process.env['UI_BROWSER_CHANNEL'] || 'chrome' });
  const page = await browser.newPage({ viewport: { width: 720, height: 240 }, deviceScaleFactor: 2 });
  mkdirSync(outDir, { recursive: true });
  for (const r of reports) {
    const data = readFileSync(r.file).toString('base64');
    const face = `wetop-probe-${r.name.replace(/[^a-z0-9]/gi, '')}`;
    r.rendered = { w1111: 0, w0000: 0, tabularInBrowser: false, snapshots: [] };
    for (const px of [12, 13]) {
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>
        @font-face { font-family: '${face}'; src: url(data:${mime(r.file)};base64,${data}); }
        body { margin: 16px; font-family: '${face}', sans-serif; color: #101827; background: #fff; }
        p { margin: 0 0 6px; font-size: ${px}px; line-height: 1.45; }
        .t { font-variant-numeric: tabular-nums; }
        .h { font-size: 11px; color: #596a80; }
      </style>
      <p class="h">${r.name} · ${px} px</p>
      <p>1 l I 0 O — Il1 O0 — Заезд 14.09.2026, 12 500 ₸, №20260913-SHOWTN</p>
      <p>${KAZAKH} Әбдірахманова Гүлнұр Қайратқызы · Müller-Lüdenscheidt</p>
      <p class="t">0000 1111 2222 · 12 500 ₸ · 9 145 ₸ · 15 688 018 ₸</p>`);
      // tsconfig корня без lib dom: страница — это globalThis браузера, как в tests/ui/workspace.spec.ts
      await page.evaluate(() => (globalThis as unknown as { document: { fonts: { ready: Promise<unknown> } } }).document.fonts.ready);
      const shot = resolve(outDir, `${r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${px}px.png`);
      await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 720, height: 120 } });
      r.rendered.snapshots.push(shot);
      if (px === 12) {
        const widths = await page.evaluate((fontFace: string) => {
          type Ctx = { font: string; measureText: (s: string) => { width: number } };
          const doc = (globalThis as unknown as { document: { createElement: (t: string) => { getContext: (k: string) => Ctx } } }).document;
          const canvas = doc.createElement('canvas').getContext('2d');
          canvas.font = `12px '${fontFace}'`;
          return [canvas.measureText('1111').width, canvas.measureText('0000').width];
        }, face);
        r.rendered.w1111 = Number(widths[0]!.toFixed(3));
        r.rendered.w0000 = Number(widths[1]!.toFixed(3));
        r.rendered.tabularInBrowser = Math.abs(widths[0]! - widths[1]!) < 0.01;
      }
    }
  }
  await browser.close();
}

export function renderReport(reports: FontReport[]): string {
  const yes = (b: boolean) => (b ? 'да' : '**нет**');
  const lines = [
    '# Проверка шрифтов-кандидатов (сгенерировано `scripts/design/src/check-fonts.ts`)',
    '',
    `Дата: ${new Date().toISOString().slice(0, 10)}. Проверяются файлы шрифтов, переданные скрипту; системный стек macOS/Windows`,
    '(SF, Segoe UI) файлами не доступен, на него отвечает Q-133. Снимки листа «1 l I 0 O» в 12 и 13 px — рядом, `*-12px.png`, `*-13px.png`.',
    '',
    '| Шрифт | Семейство | Казахские буквы | Латиница | Кириллица | Цифры одной ширины | `tnum` | В браузере «1111» = «0000» |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const r of reports)
    lines.push(
      `| ${r.name} | ${r.family ?? '—'} | ${r.kazakhMissing.length ? `**нет ${r.kazakhMissing.join('')}**` : 'все 18'} | ${r.latinMissing ? `**нет ${r.latinMissing}**` : 'да'} | ${r.cyrillicMissing ? `**нет ${r.cyrillicMissing}**` : 'да'} | ${yes(r.tabularByDefault)} | ${yes(r.hasTnum)} | ${r.rendered ? `${yes(r.rendered.tabularInBrowser)} (${r.rendered.w1111} / ${r.rendered.w0000})` : 'не рисовали'} |`,
    );
  lines.push('', 'Ширины цифр 0–9 в долях em и возможности GSUB:', '');
  for (const r of reports) lines.push(`- **${r.name}**: ${r.digitWidths.join(', ')}; ${r.features.join(' ') || 'GSUB нет'}`);
  lines.push('');
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Укажите файлы шрифтов: npm run design:fonts -- Inter=/path/Inter.ttf /path/PT_Sans.ttf');
    process.exit(2);
  }
  const reports = args.map((a) => {
    const [name, file] = a.includes('=') ? (a.split('=') as [string, string]) : [basename(a).replace(/\.[a-z0-9]+$/i, ''), a];
    return inspect(name!, resolve(file!));
  });
  const outDir = resolve(import.meta.dirname, '../../../design/reference/fonts');
  await render(reports, outDir);
  const md = renderReport(reports);
  writeFileSync(resolve(outDir, 'report.md'), md);
  console.log(md);
}
