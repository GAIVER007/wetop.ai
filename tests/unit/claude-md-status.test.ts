import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Записи о сделанной работе живут файлами в `docs/status/`, а не абзацами в `CLAUDE.md` §2 (11.10.2026): каждая
 * сессия вставляла абзац в одно и то же место, и любые два PR конфликтовали в `CLAUDE.md` (11 из 19 конфликтных PR
 * в тот день). Сторож держит раздел без записей дня и имена файлов статуса в одном виде.
 */
const ROOT = resolve(import.meta.dirname, '../..');

function section2(text: string): string {
  const start = text.indexOf('\n## 2. ');
  const end = text.indexOf('\n## 3. ', start);
  return text.slice(start, end);
}

describe('записи статуса: файлами в docs/status, не абзацами в CLAUDE.md', () => {
  it('в CLAUDE.md §2 нет записей дня (абзацев, начинающихся с даты)', () => {
    const entries = section2(readFileSync(resolve(ROOT, 'CLAUDE.md'), 'utf8'))
      .split('\n')
      .filter((l) => /^\*\*\d\d\.\d\d\.\d{4}/.test(l))
      .map((l) => l.slice(0, 80));
    expect(entries, 'перенесите запись в docs/status/ГГГГ-ММ-ДД-<ветка>.md').toEqual([]);
  });

  it('файлы docs/status называются ГГГГ-ММ-ДД-<ветка>.md и не пустые', () => {
    const dir = resolve(ROOT, 'docs/status');
    const files = readdirSync(dir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => !/^\d{4}-\d\d-\d\d-[a-z0-9-]+\.md$/.test(f))).toEqual([]);
    for (const f of files) expect(readFileSync(resolve(dir, f), 'utf8').trim(), f).not.toBe('');
  });
});
