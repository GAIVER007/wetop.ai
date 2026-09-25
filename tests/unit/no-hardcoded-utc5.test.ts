import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * С-13 из ТЗ аудита 25.09.2026: «сегодня» и границы суток объекта были захардкожены как UTC+5
 * (`Date.now() + 5 * 3600 * 1000`, `'+05:00'`) в одиннадцати местах — от них зависят штрафы,
 * досрочный выезд и отмены каналов. Платформа мультитенантна (§16): первый объект не в Алматы
 * получил бы штрафы в чужой час. Теперь день объекта считается от `Property.timezone`
 * (`todayAt`/`localDate`/`zonedStartOfDay` в домене), а этот тест не даёт копиям вернуться.
 *
 * Намеренно живёт только `confirmationNumber` в домене: дата в НОМЕРЕ брони — не бизнес-дата,
 * а неизменный префикс без перехода на летнее время, так задокументировано в самой функции.
 */
describe('С-13: жёсткого UTC+5 в коде API и стойки нет', () => {
  it('ни «5 * 3600», ни строки смещения +05:00 вне домена и тестов', () => {
    const root = resolve(import.meta.dirname, '../..');
    // Охват — API: находка ТЗ названа по apps/api (штрафы, выезд, отмены, ARI). Умолчания форм стойки
    // (apps/web) — отдельное касание вместе с настройками объекта в интерфейсе, отмечено в журнале плана.
    const args = [
      '--line-number',
      '-E',
      '-e',
      String.raw`5 \* 3_?600`,
      '-e',
      String.raw`\+05:00`,
      '--include=*.ts',
      '-r',
      'apps/api/src',
    ];
    let out: string;
    try {
      out = execFileSync('grep', args, { cwd: root, encoding: 'utf8' });
    } catch (e) {
      // grep: код 1 — совпадений нет, это и есть зелёный
      const err = e as { status?: number; stdout?: string };
      if (err.status !== 1) throw e;
      out = err.stdout ?? '';
    }
    const hits = out
      .split('\n')
      .filter(Boolean)
      // тесты пусть проверяют что угодно; строка «(UTC+5)» в человеческом комментарии — не смещение
      .filter((line) => !/\.test\.tsx?:/.test(line))
      .filter((line) => !/^\s*(\/\/|\*|\/\*\*)/.test(line.split(':').slice(2).join(':')));
    expect(hits, 'жёсткий UTC+5 вне домена — день объекта считается от Property.timezone').toEqual(
      [],
    );
  });
});
