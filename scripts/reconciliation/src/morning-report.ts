/**
 * Утренний отчёт — чистые функции (без файлов, git и процессов; это в cli-morning-report.ts).
 * Сутки считаются по часам объекта (Asia/Almaty, UTC+05:00), а не по UTC и не по часам машины.
 */
const ALMATY_OFFSET_MS = 5 * 3600 * 1000;

/** Дата по Алматы для момента времени. */
export function almatyDate(now: Date): string {
  return new Date(now.getTime() + ALMATY_OFFSET_MS).toISOString().slice(0, 10);
}

/** Сдвиг даты YYYY-MM-DD на n дней (через UTC, чтобы переход на летнее время не мешал). */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface CommitGroup {
  group: string;
  items: string[];
}
const KNOWN_PREFIXES = ['feat', 'fix', 'docs', 'test', 'chore'];
const OTHER = 'прочее';

/** Строки subject из git log, сгруппированные по префиксу conventional commits; пустые группы опускаются. */
export function groupSubjects(subjects: string[]): CommitGroup[] {
  const byGroup = new Map<string, string[]>();
  for (const s of subjects) {
    const m = /^([a-z]+)(\([^)]*\))?!?:/i.exec(s.trim());
    const key = m ? m[1]!.toLowerCase() : OTHER;
    byGroup.set(key, [...(byGroup.get(key) ?? []), s]);
  }
  const rest = [...byGroup.keys()].filter((k) => !KNOWN_PREFIXES.includes(k) && k !== OTHER).sort();
  const order = [...KNOWN_PREFIXES, ...rest, OTHER];
  return order.filter((k) => byGroup.has(k)).map((k) => ({ group: k, items: byGroup.get(k)! }));
}

/** Последний по имени файл вида <prefix>-YYYY-MM-DD.md; чужие файлы с тем же началом не считаются. */
export function latestReport(files: string[], prefix: string): string | null {
  const re = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{4}-\\d{2}-\\d{2})\\.md$`,
  );
  let best: string | null = null;
  for (const f of files) {
    if (!re.test(f)) continue;
    if (best === null || f > best) best = f;
  }
  return best;
}

/** Первая строка отчёта, где есть RESULT, как есть (со звёздочками markdown, если они там были). */
export function resultLine(md: string): string | null {
  for (const line of md.split('\n')) {
    if (/RESULT/.test(line)) return line.trim();
  }
  return null;
}

export interface VitestSummary {
  testFiles: string | null;
  tests: string | null;
}

/** Из вывода vitest берутся только итоговые строки «Test Files» и «Tests»; цвета терминала снимаются. */
export function parseVitestSummary(out: string): VitestSummary {
  // eslint-disable-next-line no-control-regex
  const plain = out.replace(/\u001b\[[0-9;]*m/g, '');
  let testFiles: string | null = null;
  let tests: string | null = null;
  for (const line of plain.split('\n')) {
    const f = /^\s*Test Files\s+(.+?)\s*$/.exec(line);
    if (f) testFiles = f[1]!;
    const t = /^\s*Tests\s+(.+?)\s*$/.exec(line);
    if (t) tests = t[1]!;
  }
  return { testFiles, tests };
}

export interface OwnerQuestion {
  id: string;
  /** Первые 60 символов вопроса */
  question: string;
}

/** Строки таблиц QUESTIONS.md со статусом OPEN и пометкой ВЛАДЕЛЕЦ где угодно в строке. */
export function ownerOpenQuestions(md: string): OwnerQuestion[] {
  const out: OwnerQuestion[] = [];
  for (const line of md.split('\n')) {
    if (!line.trimStart().startsWith('|')) continue;
    const cells = line
      .trim()
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    const id = (cells[0] ?? '').replace(/[~*`\s]/g, '');
    if (!/^Q-\d+[a-z]?$/i.test(id)) continue;
    const status = cells[2] ?? '';
    if (!/\bOPEN\b/.test(status)) continue;
    if (!line.includes('ВЛАДЕЛЕЦ')) continue;
    out.push({ id, question: (cells[1] ?? '').slice(0, 60) });
  }
  return out;
}

export interface ReconciliationRow {
  kind: string;
  file: string | null;
  result: string | null;
}
export interface TestsRow extends VitestSummary {
  timedOut: boolean;
  durationMs: number;
}
export interface MorningReportInput {
  date: string;
  yesterday: string;
  commits: CommitGroup[];
  reconciliations: ReconciliationRow[];
  tests: TestsRow;
  questions: OwnerQuestion[];
}

/** Простой markdown по-русски; коды — только в списке вопросов. */
export function renderMorningReport(input: MorningReportInput): string {
  const lines: string[] = [];
  lines.push(`# Утренний отчёт — ${input.date}`, '');
  lines.push(
    'Собран автоматически перед началом работы. Два последних раздела заполняются вручную.',
    '',
  );

  lines.push(`## Сделано вчера (${input.yesterday}, сутки по Алматы)`, '');
  const total = input.commits.reduce((n, g) => n + g.items.length, 0);
  if (total === 0) lines.push('Коммитов за сутки нет.', '');
  else {
    lines.push(`Коммитов: ${total}.`, '');
    for (const g of input.commits) {
      lines.push(`### ${g.group}`, '');
      for (const s of g.items) lines.push(`- ${s}`);
      lines.push('');
    }
  }

  lines.push(
    '## Сверки',
    '',
    'Последний отчёт каждого вида по имени файла и его строка RESULT:',
    '',
  );
  for (const r of input.reconciliations) {
    if (!r.file) lines.push(`- ${r.kind}: отчётов нет`);
    else lines.push(`- ${r.kind}: ${r.file} — ${r.result ?? 'строки RESULT нет'}`);
  }
  lines.push('');

  lines.push('## Тесты', '');
  const seconds = Math.round(input.tests.durationMs / 1000);
  if (input.tests.timedOut)
    lines.push(
      `Запуск vitest не завершился за 5 минут — таймаут (${seconds} с), итоговых строк нет.`,
    );
  else if (!input.tests.testFiles && !input.tests.tests)
    lines.push(`Запуск vitest завершился за ${seconds} с, но итоговых строк в выводе не найдено.`);
  else {
    lines.push(`Запуск vitest, ${seconds} с:`, '');
    lines.push(`- Test Files: ${input.tests.testFiles ?? '—'}`);
    lines.push(`- Tests: ${input.tests.tests ?? '—'}`);
  }
  lines.push('');

  lines.push('## Вопросы владельцу', '');
  lines.push(
    `Вопросов владельцу: ${input.questions.length} (строки QUESTIONS.md со статусом OPEN и пометкой ВЛАДЕЛЕЦ).`,
    '',
  );
  for (const q of input.questions) lines.push(`- \`${q.id}\` — ${q.question}`);
  if (input.questions.length) lines.push('');

  lines.push('## Не сделано / перенесено', '', '- (заполнить руками)', '');
  lines.push('## План на сегодня', '', '- (заполнить руками)', '');
  return lines.join('\n');
}
