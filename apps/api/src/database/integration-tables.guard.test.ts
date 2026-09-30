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
    why: 'Q-225 (а*): обработка входящих ревизий идёт в транзакциях; их начинает InboundBookingsService, а запрос организации переводит на служебную роль runIntegrationCommand до начала транзакции (см. проверки ниже)',
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

  it('чтение и правка external_events и channel_outbox ограничены объектом (propertyId в аргументах), system_incidents — вне правила', () => {
    // B1.5 (Q-222): служебная роль не различает объекты; фильтра по провайдеру мало. Объект выбирает сервер.
    // `system_incidents` колонки property_id не имеет (инциденты сторожа на всю установку) — правило к ней не применяется.
    // Исключение — комментарий `property-scope: причина` в аргументах или в двух строках выше вызова.
    const call =
      /(?:integrationTables\([^)]*\)|\btables)\.(externalEvent|channelOutbox)\.(findMany|findFirst|findUnique|count|updateMany|update|deleteMany|delete)\(/g;
    /** Текст до парной закрывающей скобки/фигурной, начиная с открывающей в позиции `open` */
    const balanced = (text: string, open: number): string => {
      const pair: Record<string, string> = { '(': ')', '{': '}' };
      const start = text[open]!;
      let depth = 0;
      for (let k = open; k < text.length; k++) {
        if (text[k] === start) depth++;
        else if (text[k] === pair[start]) {
          depth--;
          if (depth === 0) return text.slice(open, k + 1);
        }
      }
      return text.slice(open);
    };
    const bad: string[] = [];
    for (const f of files) {
      const text = f.text.replace(/\/\/[^\n]*/g, (c) => (/property-scope:/.test(c) ? c : ''));
      const re = new RegExp(call.source, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const open = m.index + m[0].length - 1;
        const args = balanced(text, open);
        const line = text.slice(0, m.index).split('\n').length;
        const before = text.slice(Math.max(0, m.index - 200), m.index);
        if (
          /propertyId/.test(args) ||
          /property-scope:/.test(args) ||
          /property-scope:/.test(before)
        )
          continue;
        // сокращённая запись `{ where }`: условие объявлено выше как `const where = { ... }`
        if (/\{\s*where\s*[,}]/.test(args)) {
          const decl = text.slice(0, m.index).lastIndexOf('const where');
          if (decl >= 0 && /propertyId/.test(balanced(text, text.indexOf('{', decl)))) continue;
        }
        bad.push(`${f.rel}:${line}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('Q-225: запись событий в транзакциях брони вызывает только InboundBookingsService, и pull/retryEvent идут через команду', () => {
    const callers = files
      .filter((f) => /\.(recordExternalEvent|updateExternalEvent|resetExternalEventAttempts)\(/.test(f.text))
      .map((f) => f.rel)
      .sort();
    expect(callers).toEqual(['channels/inbound.service.ts']);

    const inbound = files.find((f) => f.rel === 'channels/inbound.service.ts')!.text;
    // pull и retryEvent — единственные входы из запроса организации; без команды транзакция начнётся на wetop_app
    const body = (header: RegExp): string => {
      const m = header.exec(inbound);
      expect(m, String(header)).not.toBeNull();
      const open = inbound.indexOf('{', m!.index + m![0].length - 1);
      let depth = 0;
      for (let i = open; i < inbound.length; i += 1) {
        if (inbound[i] === '{') depth += 1;
        if (inbound[i] === '}' && (depth -= 1) === 0) return inbound.slice(open, i + 1);
      }
      throw new Error(`не закрыта скобка метода ${header}`);
    };
    for (const header of [/\n {2}pull\(/, /\n {2}async retryEvent\(/]) {
      const method = body(header);
      const at = method.indexOf('runIntegrationCommand(');
      expect(at, `${header}: нет runIntegrationCommand`).toBeGreaterThanOrEqual(0);
      // команда стоит раньше первого обращения к репозиторию брони в этом методе
      const firstRepo = method.search(/\buow\.(run|read)\(/);
      if (firstRepo >= 0) expect(at, `${header}: uow до команды`).toBeLessThan(firstRepo);
    }
  });

  it('исключения перечислены с причиной', () => {
    for (const [rel, e] of Object.entries(DIRECT_ALLOWED))
      expect(e.why.length, rel).toBeGreaterThan(20);
  });
});
