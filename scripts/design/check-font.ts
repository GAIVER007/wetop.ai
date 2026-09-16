/**
 * Проверка шрифта стойки по списку документа ментора (DESIGN.md §6, план шаг 2):
 *  — казахские буквы ә ғ қ ң ө ұ ү һ і, строчные и заглавные, и латиница есть в самой гарнитуре,
 *    а не берутся из запасного шрифта;
 *  — табличные цифры: ширина «1111» равна ширине «0000»;
 *  — лист «1 l I 0 O» в 12 и 13 px — на снимок, различимость смотрят глазами.
 *
 * Гарнитуру, которой нет на машине, браузер молча подменяет, поэтому «установлен ли шрифт» и «есть ли
 * буква» проверяются одинаково: строка меряется с гарнитурой-кандидатом и с заведомо несуществующей
 * (`WetopNoSuchFont`), у обеих один и тот же запасной моноширинный шрифт. Ширины совпали — кандидата
 * или буквы нет, текст пришёл из запасного.
 *
 * Запуск на машине стойки (там стоят её системные шрифты): npm run design:font
 * Результат: design/font-check.md и design/font-check-<гарнитура>.png. Через Playwright, сеть не нужна.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { hostname, platform } from 'node:os';
import { resolve } from 'node:path';

const OUT_DIR = 'design';
const CANDIDATES: Array<{ name: string; family: string; why: string }> = [
  {
    name: 'system',
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
    why: 'текущий стек стойки: SF на macOS, Segoe UI на Windows',
  },
  { name: 'ibm-plex-sans', family: '"IBM Plex Sans"', why: 'записан в ADR-027, в код не попал' },
  { name: 'inter', family: 'Inter', why: 'указан в старом --font, не подключён' },
  { name: 'manrope', family: 'Manrope', why: 'заголовки главной wetop.ai' },
  { name: 'segoe-ui', family: '"Segoe UI"', why: 'системный на Windows' },
  {
    name: 'dejavu-sans',
    family: '"DejaVu Sans"',
    why: 'системный на Linux — что видно в контейнере',
  },
  {
    name: 'liberation-sans',
    family: '"Liberation Sans"',
    why: 'системный на Linux, метрики Arial',
  },
];
const KAZAKH = 'әғқңөұүһі ӘҒҚҢӨҰҮҺІ';
const LATIN = 'AaBbGgQq';

interface Result {
  name: string;
  family: string;
  why: string;
  installed: boolean;
  kazakhMissing: string[];
  latinMissing: string[];
  tabularDigits: boolean | null;
  png: string | null;
}

async function main() {
  const executablePath = process.env['UI_BROWSER_EXECUTABLE'];
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({
    viewport: { width: 700, height: 200 },
    deviceScaleFactor: 2,
  });
  await page.setContent(
    '<!doctype html><meta charset="utf-8"><body style="margin:16px;background:#fff;color:#101827"></body>',
  );
  mkdirSync(resolve(OUT_DIR), { recursive: true });
  const results: Result[] = [];
  for (const c of CANDIDATES) {
    // Функции переданы строкой: tsx (esbuild keepNames) вписывает в стрелки помощник __name, которого в браузере нет
    const r = (await page.evaluate(
      `(({ family, kazakh, latin }) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const width = (text, fam, size = 40) => {
          ctx.font = size + 'px ' + fam + ', monospace';
          return ctx.measureText(text).width;
        };
        const missingFont = 'WetopNoSuchFont';
        const probe = 'Abc 123 ' + latin;
        const installed = width(probe, family) !== width(probe, missingFont);
        const missing = (chars) =>
          [...chars.replace(/\\s/g, '')].filter((ch) => width(ch, family) === width(ch, missingFont));
        let tabular = null;
        if (installed) {
          const span = document.createElement('span');
          span.style.cssText = 'font-family:' + family + ';font-size:40px;font-variant-numeric:tabular-nums;white-space:pre';
          document.body.append(span);
          span.textContent = '1111';
          const w1 = span.getBoundingClientRect().width;
          span.textContent = '0000';
          const w0 = span.getBoundingClientRect().width;
          span.remove();
          tabular = Math.abs(w1 - w0) < 0.5;
        }
        return {
          installed,
          kazakhMissing: installed ? missing(kazakh) : [...kazakh.replace(/\\s/g, '')],
          latinMissing: installed ? missing(latin) : [...latin],
          tabularDigits: tabular,
        };
      })(${JSON.stringify({ family: c.family, kazakh: KAZAKH, latin: LATIN })})`,
    )) as {
      installed: boolean;
      kazakhMissing: string[];
      latinMissing: string[];
      tabularDigits: boolean | null;
    };
    let png: string | null = null;
    if (r.installed) {
      png = `font-check-${c.name}.png`;
      await page.evaluate(
        `(({ family, kazakh }) => {
          document.body.innerHTML = [12, 13, 16].map(
            (px) =>
              '<div style="font-family:' + family + ';font-size:' + px + 'px;line-height:1.5;font-variant-numeric:tabular-nums">' +
              px + ' px · 1 l I 0 O · 12 500 ₸ · 20.09.2026 · ' + kazakh + ' · Ақбота Әбдіғаппарова</div>',
          ).join('');
        })(${JSON.stringify({ family: c.family, kazakh: KAZAKH })})`,
      );
      await page.screenshot({ path: resolve(OUT_DIR, png) });
    }
    results.push({ ...c, ...r, png });
  }
  await browser.close();
  const md = [
    '# Проверка шрифта стойки',
    '',
    `Машина: ${hostname()} (${platform()}), ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Команда: \`npm run design:font\`.`,
    'Что проверяется и почему — заголовок `scripts/design/check-font.ts`; решение по шрифту — `DESIGN.md` §6.',
    '**Проверка имеет смысл только на машине стойки:** шрифты берутся из системы, и на другом компьютере',
    'результат другой (Q-138).',
    '',
    '| Кандидат | Зачем | Установлен | Казахские буквы | Латиница | Табличные цифры | Снимок |',
    '|---|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| \`${r.family}\` | ${r.why} | ${r.installed ? 'да' : 'нет'} | ${
          !r.installed
            ? '—'
            : r.kazakhMissing.length
              ? `нет: ${r.kazakhMissing.join(' ')}`
              : 'все есть'
        } | ${!r.installed ? '—' : r.latinMissing.length ? `нет: ${r.latinMissing.join(' ')}` : 'есть'} | ${
          r.tabularDigits === null ? '—' : r.tabularDigits ? 'да' : '**нет**'
        } | ${r.png ? `[${r.png}](${r.png})` : '—'} |`,
    ),
    '',
  ].join('\n');
  writeFileSync(resolve(OUT_DIR, 'font-check.md'), md);
  console.log(md);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
