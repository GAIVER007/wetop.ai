import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Записи о сделанной работе живут файлами в `docs/status/`, а не абзацами в `CLAUDE.md` §2 (11.10.2026): каждая
 * сессия вставляла абзац в одно и то же место, и любые два PR конфликтовали в `CLAUDE.md` (11 из 19 конфликтных PR
 * в тот день). Сторож держит раздел без записей дня и имена файлов статуса в одном виде.
 */
const ROOT = resolve(import.meta.dirname, '../..');

describe('записи статуса: файлами в docs/status, не абзацами в CLAUDE.md и AGENTS.md', () => {
  it('CLAUDE.md подключает AGENTS.md первой строкой: Codex и Hermes читают только AGENTS.md (19.10.2026)', () => {
    expect(readFileSync(resolve(ROOT, 'CLAUDE.md'), 'utf8').split('\n')[0]).toBe('@AGENTS.md');
  });

  it('в CLAUDE.md и AGENTS.md нет записей дня (абзацев, начинающихся с даты)', () => {
    const entries = ['CLAUDE.md', 'AGENTS.md']
      .flatMap((f) => readFileSync(resolve(ROOT, f), 'utf8').split('\n'))
      .filter((l) => /^\*\*\d\d\.\d\d\.\d{4}/.test(l))
      .map((l) => l.slice(0, 80));
    expect(entries, 'перенесите запись в docs/status/ГГГГ-ММ-ДД-<ветка>.md').toEqual([]);
  });

  // решения тем же приёмом с 19.10.2026 (AGENTS.md §21): DECISIONS.md менялся 365 раз и стал архивом
  it.each(['docs/status', 'docs/decisions'])('файлы %s называются ГГГГ-ММ-ДД-<ветка>.md и не пустые', (folder) => {
    const dir = resolve(ROOT, folder);
    const files = readdirSync(dir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => !/^\d{4}-\d\d-\d\d-[a-z0-9-]+\.md$/.test(f))).toEqual([]);
    for (const f of files) expect(readFileSync(resolve(dir, f), 'utf8').trim(), f).not.toBe('');
  });
});
