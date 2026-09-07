/**
 * Чтение таблиц из markdown-выгрузок аудита Exely.
 * Таблица ищется ПОД конкретным заголовком — первая попавшаяся таблица не берётся.
 */
export interface MarkdownTable {
  headers: string[];
  rows: Record<string, string>[];
}

const BOLD = /\*\*/g;

function splitRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((c) => c.replace(BOLD, '').trim());
}

function isSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

/** Разбирает подряд идущие строки таблицы (первая — заголовок, вторая — разделитель). */
export function parseMarkdownTable(lines: string[]): MarkdownTable {
  const [headerLine, ...rest] = lines;
  if (headerLine === undefined) {
    return { headers: [], rows: [] };
  }
  const headers = splitRow(headerLine);
  const rows: Record<string, string>[] = [];
  for (const line of rest) {
    const cells = splitRow(line);
    if (isSeparator(cells)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

/** Первая таблица после строки, совпадающей с `heading`. Нет заголовка — undefined. */
export function findMarkdownTable(markdown: string, heading: RegExp): MarkdownTable | undefined {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => heading.test(l));
  if (start === -1) return undefined;

  const tableLines: string[] = [];
  let i = start + 1;
  while (i < lines.length && !lines[i]!.trim().startsWith('|')) {
    if (/^#{1,6}\s/.test(lines[i]!)) return undefined; // следующий заголовок раньше таблицы
    i += 1;
  }
  while (i < lines.length && lines[i]!.trim().startsWith('|')) {
    tableLines.push(lines[i]!);
    i += 1;
  }
  if (tableLines.length === 0) return undefined;
  return parseMarkdownTable(tableLines);
}
