/**
 * Сторож сценария 11 сертификации Channex — «Booking receiving»
 * (docs/channex/site/api-v.1-documentation/pms-certification-tests.md; bookings-collection.md, «Booking Revisions
 * Feed»: «This should be your primary way to get bookings from Channex»). Брони PMS берёт только из ленты
 * неподтверждённых ревизий (`/booking_revisions/feed` — по webhook и опросом раз в 5 минут) и подтверждает
 * (`/booking_revisions/:id/ack`).
 *
 * 24.09.2026 Channex не принял сценарий 11: «Found 3 booking_revision_received_via_list event(s); bookings must be
 * received via webhook/feed, not list-polling or by-id fetching». Три события дал один вызов списка ревизий в
 * скрипте цикла брони (reports/channex-cert-review-2026-09-24.md). Сторож держит три запрета в коде, который ходит
 * в Channex (`apps/api/src`, `packages/integrations/src`, `scripts`):
 *  1. список ревизий — `/booking_revisions` с запросом или без продолжения пути;
 *  2. ревизия по ID — `/booking_revisions/<id>` без `/ack`;
 *  3. `GET /bookings…` — документ сертификации запрещает прямо.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const DIRS = ['apps/api/src', 'packages/integrations/src', 'scripts'];

/** Исключения — с причиной. Это не путь приёма брони; на объекте сертификации во время проверки не запускать. */
const ALLOWED_LIST: Record<string, string> = {
  'scripts/reconciliation/src/cli-rollback-window.ts':
    'сверка окна отката (CUTOVER.md, шаг 6): нужны и подтверждённые ревизии за окно, а лента отдаёт только неподтверждённые',
};

/** Только исполняемое: в пояснениях те же пути стоят намеренно. `https://` не комментарий. */
const withoutComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ''))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const RULES: Array<{
  name: string;
  re: RegExp;
  allowed?: Record<string, string>;
  onlyChannex?: boolean;
}> = [
  {
    name: 'список ревизий Channex (GET /booking_revisions?…)',
    re: /\/booking_revisions(?=[?'"`])/,
    allowed: ALLOWED_LIST,
  },
  {
    name: 'ревизия Channex по ID (GET /booking_revisions/:id)',
    re: /\/booking_revisions\/(?:\$\{[^}]*\}(?!\/ack)|['"`]\s*\+)/,
  },
  {
    name: 'GET /bookings Channex',
    re: /['"`]GET['"`]\s*,\s*['"`]\/bookings|listAll(?:<[^>]*>)?\(\s*['"`]\/bookings/,
    onlyChannex: true,
  },
];

describe('Channex: брони только из ленты и webhook (сценарий 11 сертификации)', () => {
  const files = DIRS.flatMap((d) => sources(join(ROOT, d)));

  it('в дереве есть что проверять: клиент Channex и приём брони на месте', () => {
    const rel = files.map((f) => relative(ROOT, f));
    expect(rel).toContain('packages/integrations/src/channex/client.ts');
    expect(rel).toContain('apps/api/src/channels/inbound.service.ts');
  });

  for (const rule of RULES)
    it(`нет вызова: ${rule.name}`, () => {
      const offenders: string[] = [];
      for (const f of files) {
        const rel = relative(ROOT, f);
        if (rule.allowed?.[rel]) continue;
        const src = readFileSync(f, 'utf8');
        if (rule.onlyChannex && !/channex/i.test(src)) continue;
        const code = withoutComments(src);
        code.split('\n').forEach((line, i) => {
          if (rule.re.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
      }
      expect(offenders).toEqual([]);
    });

  it('исключения живы и названы: файл существует и действительно зовёт список', () => {
    for (const rel of Object.keys(ALLOWED_LIST)) {
      const code = withoutComments(readFileSync(join(ROOT, rel), 'utf8'));
      expect(code).toMatch(RULES[0]!.re);
    }
  });

  it('webhook брони читает ленту, а не ревизию по ID', () => {
    const code = withoutComments(
      readFileSync(join(ROOT, 'apps/api/src/channels/inbound.service.ts'), 'utf8'),
    );
    expect(code).toContain('bookingRevisionsFeed');
    expect(code).not.toContain('getBookingRevision');
  });
});
