import { describe, expect, it } from 'vitest';
import {
  almatyDate,
  groupSubjects,
  latestReport,
  ownerOpenQuestions,
  parseVitestSummary,
  renderMorningReport,
  resultLine,
  shiftDate,
} from './morning-report';

/** Утренний отчёт: чистые функции — сутки по Алматы, группировка коммитов, сверки, тесты, вопросы. */
describe('morning-report', () => {
  it('дата отчёта — по часам объекта (Asia/Almaty, +05:00), а не по UTC', () => {
    expect(almatyDate(new Date('2026-09-10T20:30:00Z'))).toBe('2026-09-11');
    expect(almatyDate(new Date('2026-09-10T18:59:00Z'))).toBe('2026-09-10');
    expect(shiftDate('2026-09-11', -1)).toBe('2026-09-10');
    expect(shiftDate('2026-08-31', 1)).toBe('2026-09-01');
  });
  it('коммиты группируются по префиксу: feat, fix, docs, test, chore, потом остальные', () => {
    const groups = groupSubjects([
      'chore: e',
      'feat(desk): a',
      'no prefix at all',
      'fix: b',
      'reports: f',
      'docs(ui): c',
      'test(e2e): d',
      'feat: g',
    ]);
    expect(groups.map((g) => g.group)).toEqual([
      'feat',
      'fix',
      'docs',
      'test',
      'chore',
      'reports',
      'прочее',
    ]);
    expect(groups[0]!.items).toEqual(['feat(desk): a', 'feat: g']);
    expect(groups[6]!.items).toEqual(['no prefix at all']);
    expect(groupSubjects([])).toEqual([]);
  });
  it('последняя сверка — по имени файла с датой, без чужих файлов', () => {
    const files = [
      'inventory-2026-09-08.md',
      'inventory-2026-09-10.md',
      'inventory-compare.ts',
      'double-entry-2026-09-10.md',
      'double-entry-2026-08-31.md',
    ];
    expect(latestReport(files, 'inventory')).toBe('inventory-2026-09-10.md');
    expect(latestReport(files, 'double-entry')).toBe('double-entry-2026-09-10.md');
    expect(latestReport(files, 'rates')).toBeNull();
  });
  it('строка RESULT берётся из отчёта как есть; без неё — null', () => {
    expect(resultLine('# x\n\n| a | b |\n\nRESULT: OK — сутки сходятся\n')).toBe(
      'RESULT: OK — сутки сходятся',
    );
    expect(resultLine('**RESULT: OK по овербукингу** — канал не продаёт лишнего\n')).toBe(
      '**RESULT: OK по овербукингу** — канал не продаёт лишнего',
    );
    expect(resultLine('# Балансы\n\n**Расхождения: 5.**\n')).toBeNull();
  });
  it('из вывода vitest берутся только итоговые строки, цвета терминала снимаются', () => {
    const esc = '\u001b';
    const out =
      ` RUN  v5.0.0 /x\n\n ${esc}[1mTest Files${esc}[22m  12 passed (12)\n` +
      `      ${esc}[1mTests${esc}[22m  80 passed | 1 skipped (81)\n   Start at  09:00:00\n`;
    expect(parseVitestSummary(out)).toEqual({
      testFiles: '12 passed (12)',
      tests: '80 passed | 1 skipped (81)',
    });
    expect(parseVitestSummary('')).toEqual({ testFiles: null, tests: null });
  });
  it('вопросы владельцу — только строки со статусом OPEN и пометкой ВЛАДЕЛЕЦ, вопрос до 60 знаков', () => {
    const md = [
      '| ID | Вопрос | Статус | Ответ |',
      '|---|---|---|---|',
      '| Q-001 | Точное число комнат? | **ЗАКРЫТ** | **20**. `ВЛАДЕЛЕЦ` 07.09.2026 |',
      '| ~~**Q-099**~~ | Почему единице-сутки августа по категориям расходятся с отчётом загрузки Exely, если всё остальное сошлось? | **OPEN** | нужен отчёт `ВЛАДЕЛЕЦ` |',
      '| Q-040 | Как получить production API key? | **OPEN** |',
      '| **Q-095** | Какие единицы входят в dorm-комнаты? | **OPEN** | список `ОПРОС` ВЛАДЕЛЕЦ |',
    ].join('\n');
    const rows = ownerOpenQuestions(md);
    expect(rows.map((r) => r.id)).toEqual(['Q-099', 'Q-095']);
    expect(rows[0]!.question).toHaveLength(60);
    expect(rows[0]!.question).toBe('Почему единице-сутки августа по категориям расходятся с отчё');
    expect(rows[1]!.question).toBe('Какие единицы входят в dorm-комнаты?');
  });
  it('отчёт содержит шесть разделов, пустые списки с подсказкой и пометку о таймауте тестов', () => {
    const md = renderMorningReport({
      date: '2026-09-11',
      yesterday: '2026-09-10',
      commits: groupSubjects(['feat(desk): перетаскивание']),
      reconciliations: [
        { kind: 'inventory', file: 'inventory-2026-09-10.md', result: 'RESULT: OK' },
        { kind: 'balances', file: 'balances-2026-09-08.md', result: null },
        { kind: 'rates', file: null, result: null },
      ],
      tests: { testFiles: null, tests: null, timedOut: true, durationMs: 300_000 },
      questions: [{ id: 'Q-099', question: 'Почему' }],
    });
    for (const h of [
      '## Сделано вчера',
      '## Сверки',
      '## Тесты',
      '## Вопросы владельцу',
      '## Не сделано / перенесено',
      '## План на сегодня',
    ])
      expect(md).toContain(h);
    expect(md).toContain('feat(desk): перетаскивание');
    expect(md).toContain('inventory-2026-09-10.md — RESULT: OK');
    expect(md).toContain('balances-2026-09-08.md — строки RESULT нет');
    expect(md).toMatch(/rates.*отчётов нет/);
    expect(md).toMatch(/таймаут/);
    expect(md).toContain('Вопросов владельцу: 1');
    expect(md).toContain('`Q-099` — Почему');
    expect(md.match(/заполнить руками/g)?.length).toBe(2);
  });
});
