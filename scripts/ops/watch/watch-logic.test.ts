import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  authorized,
  initialState,
  onBeat,
  onTimer,
  parseBeat,
  SILENCE_MS,
  REALERT_MS,
} from './watch-logic.ts';

/**
 * «Сторож сторожа» на сервере (plans/slice-12-guard-server.md, шаг 12.1). Сторож в API на Mac раз в минуту шлёт
 * сигнал; пропал сигнал на 5 минут — тревога в Telegram, повтор раз в 30 минут, вернулся — «снова на связи».
 * В сигнале только числа: персональных данных на сервере в Малайзии быть не должно.
 */
const T0 = new Date('2026-09-13T21:00:00Z'); // 03:00 Алматы
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const beat = { at: T0.toISOString(), open: 2, critical: 0, escalated: 2, checksFailed: 0 };

describe('parseBeat', () => {
  it('берёт только числа и время; любые строки, заголовки, ФИО отбрасываются', () => {
    expect(
      parseBeat({ ...beat, title: 'Проживание без ячейки: Тестов Тест', guest: { name: 'x' } }),
    ).toEqual(beat);
  });

  it('мусор — не сигнал', () => {
    expect(parseBeat(null)).toBeNull();
    expect(parseBeat({ open: 'много' })).toBeNull();
    expect(parseBeat({ ...beat, at: 'вчера' })).toBeNull();
    expect(parseBeat({ ...beat, open: -1 })).toBeNull();
  });
});

describe('authorized', () => {
  it('Bearer с верным секретом — да; без секрета на сервере — никогда', () => {
    expect(authorized('Bearer s3cret-value-long-enough', 's3cret-value-long-enough')).toBe(true);
    expect(authorized('Bearer wrong', 's3cret-value-long-enough')).toBe(false);
    expect(authorized(undefined, 's3cret-value-long-enough')).toBe(false);
    expect(authorized('Bearer ', '')).toBe(false);
  });
});

describe('onTimer / onBeat', () => {
  it('сигналы идут — тишина; пропал на 5 минут — одна тревога, повтор через 30 минут', () => {
    let s = onBeat(initialState(at(0)), beat, at(0)).state;
    expect(onTimer(s, at(4)).messages).toEqual([]);
    const first = onTimer(s, at(0 + SILENCE_MS / 60_000));
    expect(first.messages).toHaveLength(1);
    expect(first.messages[0]).toMatch(/молчит 5 мин/);
    s = first.state;
    expect(onTimer(s, at(10)).messages).toEqual([]);
    expect(onTimer(s, at(5 + REALERT_MS / 60_000)).messages).toHaveLength(1);
  });

  it('сигнал вернулся после тревоги — «снова на связи» с длительностью тишины; без тревоги — молча', () => {
    let s = onBeat(initialState(at(0)), beat, at(0)).state;
    s = onTimer(s, at(7)).state;
    const back = onBeat(s, beat, at(12));
    expect(back.messages).toHaveLength(1);
    expect(back.messages[0]).toMatch(/снова на связи/);
    expect(back.messages[0]).toMatch(/12 мин/);
    expect(onBeat(back.state, beat, at(13)).messages).toEqual([]);
  });

  it('с запуска сервера ни одного сигнала — тревога тоже, но не раньше 5 минут', () => {
    const s = initialState(at(0));
    expect(onTimer(s, at(3)).messages).toEqual([]);
    expect(onTimer(s, at(5)).messages[0]).toMatch(/ни одного сигнала/);
  });

  it('в сигнале есть срочные неисправности — сервер сообщает сам, раз в 30 минут (на случай, если Telegram с Mac не уходит)', () => {
    let r = onBeat(initialState(at(0)), { ...beat, critical: 1 }, at(0));
    expect(r.messages[0]).toMatch(/срочных: 1/);
    r = onBeat(r.state, { ...beat, critical: 1 }, at(10));
    expect(r.messages).toEqual([]);
    r = onBeat(r.state, { ...beat, critical: 1 }, at(31));
    expect(r.messages).toHaveLength(1);
    r = onBeat(r.state, beat, at(32));
    expect(r.messages).toEqual([]);
  });
});

describe('запуск без сборки', () => {
  it('Node 24 загружает модуль как есть (в контейнер едут .ts файлы без компиляции)', () => {
    const file = resolve(import.meta.dirname, 'watch-logic.ts');
    const out = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const m = await import(${JSON.stringify(file)}); console.log(typeof m.onTimer)`,
      ],
      { encoding: 'utf8' },
    );
    expect(out.trim()).toBe('function');
  });
});
