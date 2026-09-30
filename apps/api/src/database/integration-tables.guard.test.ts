import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SEC-1b, стадия B (Q-222, решение владельца 30.09.2026): к `external_events`, `system_incidents` и `channel_outbox` код ходит
 * только через `integrationTables(db)` (служебная роль); `wetop_app` оставляют один `INSERT` в очередь. Сканер не даёт
 * появиться новому обращению мимо ворот: любое `.externalEvent.` / `.systemIncident.` / `.channelOutbox.` должно стоять
 * сразу за `integrationTables(...)` или за переменной, полученной оттуда, а сырой SQL по этим таблицам — внутри
 * `onIntegrationTables(...)`. Исключения перечислены здесь поимённо и с причиной.
 */
const ROOT = join(import.meta.dirname, '..');
const MODELS = 'externalEvent|systemIncident|channelOutbox';

/** Разрешённые прямые обращения: файл → сколько раз и почему */
const DIRECT_ALLOWED: Record<string, { count: number; why: string }> = {
  'database/integration-tables.ts': { count: 3, why: 'сами ворота оборачивают три модели' },
  'channels/channels.repository.ts': {
    count: 1,
    why: 'enqueueOutbox: INSERT (createMany) обязан остаться в транзакции команды, у wetop_app на очередь только INSERT',
  },
  'reservations/reservations.repository.ts': {
    count: 4,
    why: 'Q-225: обработка входящих ревизий идёт в транзакциях, начатых под организацией, ворота там не переключают соединение; решение владельца',
  },
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : sources(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
  });
}

const files = sources(ROOT).map((p) => ({ rel: relative(ROOT, p), text: readFileSync(p, 'utf8') }));

describe('ворота к данным интеграции: обращений мимо них нет', () => {
  it('каждое обращение к трём моделям — через integrationTables, кроме поимённых исключений', () => {
    const direct: Record<string, number> = {};
    for (const f of files) {
      const lines = f.text.split('\n');
      lines.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        const re = new RegExp(`\\.(${MODELS})\\b`, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(code))) {
          const before = code.slice(0, m.index);
          const gated = /integrationTables\([^)]*\)$/.test(before) || /\btables$/.test(before);
          if (gated) {
            if (/\btables$/.test(before))
              expect(f.text, `${f.rel}:${i + 1} tables.* без integrationTables`).toMatch(
                /const tables = integrationTables\(/,
              );
            continue;
          }
          direct[f.rel] = (direct[f.rel] ?? 0) + 1;
        }
      });
    }
    const unexpected = Object.entries(direct)
      .filter(([rel, n]) => DIRECT_ALLOWED[rel]?.count !== n)
      .map(
        ([rel, n]) => `${rel}: ${n} прямых обращений, разрешено ${DIRECT_ALLOWED[rel]?.count ?? 0}`,
      );
    expect(unexpected, unexpected.join('\n')).toEqual([]);
    // и обратно: исключение не должно пережить своё обращение
    const stale = Object.keys(DIRECT_ALLOWED).filter((rel) => !(rel in direct));
    expect(stale, `исключение больше не нужно: ${stale.join(', ')}`).toEqual([]);
  });

  it('сырой SQL по трём таблицам — внутри onIntegrationTables', () => {
    const table =
      /\b(?:FROM|INTO|UPDATE|JOIN)\s+"?(external_events|system_incidents|channel_outbox)"?/;
    const bad: string[] = [];
    for (const f of files) {
      const lines = f.text.split('\n');
      lines.forEach((line, i) => {
        if (!table.test(line) || /^\s*(\/\/|\*|\/\*)/.test(line)) return;
        const near = lines.slice(Math.max(0, i - 25), i + 1).join('\n');
        if (!/onIntegrationTables\(/.test(near)) bad.push(`${f.rel}:${i + 1}`);
      });
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('исключения перечислены с причиной', () => {
    for (const [rel, e] of Object.entries(DIRECT_ALLOWED))
      expect(e.why.length, rel).toBeGreaterThan(20);
  });
});
