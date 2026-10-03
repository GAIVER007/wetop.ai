/**
 * scripts/ops/shift-check.sh: обёртка сверки смены на сервере (двойная смена, plans/double-shift-2026-10-06.md).
 *
 * Настоящий compose не трогается: COMPOSE подменён скриптом, который пишет, с какими аргументами его позвали и что
 * пришло на вход, и отвечает как CLI сверки (строки журнала в stdout, сводка в stderr, код выхода). Держится то, что
 * видно смене: таблица и журнал уходят в контейнер одним входом через разделитель, новые строки дописываются в
 * журнал вне клона, повторный срез получает журнал целиком, таблица не остаётся на диске, файлы закрыты от чужих.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = resolve(import.meta.dirname, '../../scripts/ops/shift-check.sh');
const MARKER = '#=== журнал расхождений ===';
const HEADER =
  '\uFEFF№;когда (Алматы);список;ключ;WETOP;источник;в источнике;что не так;статус;причина и исправление;кто разобрал\r\n';
const ROW =
  'Д-a1b2c3;06.10.2026 14:05;деньги;A оплата;12 000 ₸, Наличные, 09:12;таблица;12 000 ₸, Kaspi (строка 3);способ оплаты разный;открыто;;\r\n';

function sandbox(reply: { rows?: string; code?: number } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'shift-check-'));
  const shiftDir = join(dir, 'shift');
  const tmp = join(dir, 'tmp');
  mkdirSync(tmp);
  const fake = join(dir, 'compose.sh');
  writeFileSync(join(dir, 'rows'), reply.rows ?? '');
  writeFileSync(
    fake,
    [
      '#!/bin/bash',
      `echo "$*" >> "${dir}/calls"`,
      `cat > "${dir}/stdin"`,
      `cat "${dir}/rows"`,
      'echo "Сверка смены: сводка" >&2',
      `exit ${reply.code ?? 0}`,
    ].join('\n'),
    { mode: 0o755 },
  );
  const run = (args: string[], input?: string) => {
    const r = spawnSync('bash', [SCRIPT, ...args], {
      encoding: 'utf8',
      timeout: 15_000,
      input: input ?? '',
      env: { ...process.env, COMPOSE: fake, SHIFT_DIR: shiftDir, TMPDIR: tmp },
    });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const read = (name: string) =>
    existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : '';
  return { dir, shiftDir, tmp, run, read };
}

describe('scripts/ops/shift-check.sh', () => {
  it('таблица из файла: один вход в контейнер, аргументы как есть, новые строки в журнал вне клона', () => {
    const s = sandbox({ rows: HEADER + ROW, code: 1 });
    const table = join(s.dir, 'table.tsv');
    writeFileSync(table, 'время\tсобытие\tбронь\n09:10\tновая бронь\tA\n');
    const r = s.run([table, '--date', '2026-10-06', '--to', '14:05']);
    expect(r.code).toBe(1);
    expect(s.read('calls').trim()).toBe(
      'exec -T -w /app api node --import tsx scripts/reconciliation/src/cli-shift-check.ts --date 2026-10-06 --to 14:05',
    );
    expect(s.read('stdin')).toBe(`время\tсобытие\tбронь\n09:10\tновая бронь\tA\n\n${MARKER}\n`);
    const log = join(s.shiftDir, '2026-10-06', 'discrepancies.csv');
    expect(readFileSync(log, 'utf8')).toBe(HEADER + ROW);
    // в журнале номера броней и суммы: файл только для владельца сервера
    expect(statSync(log).mode & 0o077).toBe(0);
    expect(r.err).toContain('Сверка смены: сводка');
    expect(r.err).toContain('журнал расхождений дописан');
    // таблица (в ней могут быть имена гостей) на диске не остаётся
    expect(readdirSync(s.tmp)).toEqual([]);
  });

  it('повторный срез: журнал целиком уходит в контейнер после разделителя, без новых строк файл не меняется', () => {
    const s = sandbox({ rows: '', code: 0 });
    const day = join(s.shiftDir, '2026-10-06');
    mkdirSync(day, { recursive: true });
    writeFileSync(join(day, 'discrepancies.csv'), HEADER + ROW);
    const r = s.run(['--date', '2026-10-06'], 'событие\tбронь\nзаезд\tA\n');
    expect(r.code).toBe(0);
    expect(s.read('stdin')).toBe(`событие\tбронь\nзаезд\tA\n\n${MARKER}\n${HEADER}${ROW}`);
    expect(readFileSync(join(day, 'discrepancies.csv'), 'utf8')).toBe(HEADER + ROW);
    expect(r.err).toContain('новых строк нет');
  });

  it('пустая таблица и незнакомый ключ: код 2, контейнер не зовётся', () => {
    const s = sandbox();
    expect(s.run(['--date', '2026-10-06'], '  \n\n').code).toBe(2);
    expect(s.run(['--force'], 'событие\tбронь\n').code).toBe(2);
    expect(s.run(['--date', '06.10.2026'], 'событие\tбронь\n').err).toContain('нужно ГГГГ-ММ-ДД');
    expect(s.read('calls')).toBe('');
  });

  it('без --date день смены сегодняшний по Алматы', () => {
    const s = sandbox();
    expect(s.run([], 'событие\tбронь\nзаезд\tA\n').code).toBe(0);
    const almaty = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    expect(existsSync(join(s.shiftDir, almaty))).toBe(true);
  });
});
