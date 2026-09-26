import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * С-13 из ТЗ аудита 25.09.2026: «сегодня» и границы суток объекта были захардкожены как UTC+5
 * (`Date.now() + 5 * 3600 * 1000`, `'+05:00'`) — от них зависят штрафы, досрочный выезд, отмены каналов,
 * умолчания дат и даты печати. Платформа мультитенантна (§16): первый объект не в Алматы получил бы
 * штрафы в чужой час, а стойка — чужое «сегодня». Теперь день объекта считается от `Property.timezone`:
 * в API — `todayAt`/`localDate`/`zonedStartOfDay` домена (PR #80), на стойке — `lib/property-time.ts`
 * с поясом из `/hotel/settings` (26.09). Этот тест не даёт копиям вернуться ни в API, ни на стойку.
 *
 * Зашитое имя пояса — тот же дефект, что и сдвиг: `Intl` с `'Asia/Almaty'` верен только для одного объекта.
 * Пояс платформы (сроки расширений, запасной пояс стойки) один — `PLATFORM_TIMEZONE` в домене.
 *
 * Разрешено только помеченное в той же строке `tz-allow: <причина>` (как `slop-allow` у сторожа слопа):
 * значение по умолчанию для новой записи — не вычисление времени. Тесты и подделки для тестов (`fake-*.ts`)
 * не проверяются. Намеренно живёт `confirmationNumber` в домене (домен сюда не входит): дата в НОМЕРЕ брони —
 * неизменный префикс, так задокументировано в самой функции.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const PATTERNS = [
  String.raw`5 \* 3_?600`, // сдвиг на пять часов руками
  String.raw`\+05:00`, // строка смещения
  String.raw`['"]Asia/Almaty['"]`, // зашитое имя пояса
];

function hardcodedTimezone(dir: string): string[] {
  const args = ['--line-number', '-E', '-r', '--include=*.ts', '--include=*.tsx'];
  for (const p of PATTERNS) args.push('-e', p);
  args.push(dir);
  let out: string;
  try {
    out = execFileSync('grep', args, { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    // grep: код 1 — совпадений нет, это и есть зелёный
    const err = e as { status?: number; stdout?: string };
    if (err.status !== 1) throw e;
    out = err.stdout ?? '';
  }
  return (
    out
      .split('\n')
      .filter(Boolean)
      // тесты пусть проверяют что угодно; подделки для тестов — тоже тестовый код
      .filter((line) => !/\.(test|spec)\.tsx?:/.test(line) && !/\/fake-[^/:]*\.ts:/.test(line))
      // «(Asia/Almaty, UTC+5)» в человеческом комментарии — не вычисление
      .filter((line) => !/^\s*(\/\/|\*|\/\*\*)/.test(line.split(':').slice(2).join(':')))
      .filter((line) => !line.includes('tz-allow:'))
  );
}

describe('С-13: жёсткого UTC+5 и зашитого пояса в коде API и стойки нет', () => {
  it('API: ни сдвига на пять часов, ни строки +05:00, ни зашитого Asia/Almaty', () => {
    expect(hardcodedTimezone('apps/api/src'), 'день объекта — от Property.timezone').toEqual([]);
  });

  it('стойка: даты и моменты — по поясу объекта из /hotel/settings, а не по UTC+5', () => {
    expect(hardcodedTimezone('apps/web/src'), 'часы объекта — lib/property-time.ts').toEqual([]);
  });
});
