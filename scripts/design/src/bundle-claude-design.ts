/**
 * Пакет для Claude Design (план дизайн-системы, шаг 5; список утверждён владельцем 14.09.2026 —
 * design/claude-design-upload.md). Раскладывает файлы репозитория в design/claude-design-bundle/ ровно по списку:
 * оттуда их загружает DesignSync с основного Mac (после /design-login) или владелец руками через настройки
 * организации в Claude Design. Папка в git не идёт (.gitignore). Ничего лишнего: скриншоты Exely, .env,
 * отчёты и данные объекта в пакет не попадают.
 *
 * Запуск: `npm run design:bundle` (или `npx tsx scripts/design/src/bundle-claude-design.ts [--out=<папка>]`).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const outArg = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];
const OUT = resolve(ROOT, outArg ?? 'design/claude-design-bundle');

/** [путь в проекте Claude Design, путь в репозитории]. Папки копируются целиком по расширениям. */
const FILES: Array<[string, string]> = [
  ['DESIGN.md', 'DESIGN.md'],
  ['design/tokens.json', 'design/tokens.json'],
  ['design/tokens.css', 'apps/web/src/app/tokens.css'],
  ['design/contrast.md', 'design/contrast.md'],
  ['design-system/page.tsx', 'apps/web/src/app/design-system/page.tsx'],
  ['design-system/showcase.tsx', 'apps/web/src/app/design-system/showcase.tsx'],
  ['components/css/globals.css', 'apps/web/src/app/globals.css'],
  ['components/css/premium.css', 'apps/web/src/app/premium.css'],
  ['components/css/workspace.css', 'apps/web/src/app/workspace.css'],
  ['components/css/components.css', 'apps/web/src/app/components.css'],
];
const DIRS: Array<[string, string, RegExp]> = [
  ['components', 'apps/web/src/components', /\.tsx$/],
  ['components/shell', 'apps/web/src/components/shell', /\.tsx$/],
  ['reference/kit', 'design/reference/kit', /\.png$/],
  ['reference/current', 'design/reference/current', /\.png$/],
  ['reference/fonts', 'design/reference/fonts', /\.(png|md)$/],
  ['brand', 'design/brand', /\.(svg|png|jpg|jpeg|pdf|md|json)$/],
  ['prompts', 'design/prompts', /\.md$/],
];
const FORBIDDEN = [/reference\/exely/, /\.env/, /node_modules/, /project-input/, /\.git\//];

const copied: string[] = [];
const put = (target: string, source: string) => {
  if (FORBIDDEN.some((re) => re.test(source))) throw new Error(`В пакет нельзя: ${source}`);
  const dest = join(OUT, target);
  mkdirSync(resolve(dest, '..'), { recursive: true });
  copyFileSync(resolve(ROOT, source), dest);
  copied.push(`${target} (${statSync(dest).size} байт)`);
};

rmSync(OUT, { recursive: true, force: true });
for (const [target, source] of FILES) put(target, source);
for (const [target, source, re] of DIRS) {
  const dir = resolve(ROOT, source);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (!re.test(name) || name.startsWith('.')) continue;
    if (statSync(join(dir, name)).isDirectory()) continue; // components/shell идёт отдельной строкой
    put(`${target}/${name}`, `${source}/${name}`);
  }
}
const list = [
  '# Пакет для Claude Design — «WETOP — стойка»',
  '',
  `Собрано ${new Date().toISOString().slice(0, 10)} командой npm run design:bundle из design/claude-design-upload.md.`,
  'Скриншотов Exely, .env, отчётов и данных объекта здесь нет; имена в снимках вымышленные (ADR-010).',
  '',
  ...copied.map((c) => `- ${c}`),
  '',
].join('\n');
writeFileSync(join(OUT, 'MANIFEST.md'), list);
console.log(`${copied.length} файлов → ${OUT}\n${copied.map((c) => `  ${basename(c.split(' (')[0]!)}`).join('\n')}`);
