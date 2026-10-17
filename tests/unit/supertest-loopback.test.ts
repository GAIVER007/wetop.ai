import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Флейк 16.10.2026 (`docs/status/2026-10-16-modest-lovelace-429ae7.md`): приложение Nest в тесте не слушало порт,
 * supertest на каждый запрос делал `listen(0)` на `::` и стучался на `127.0.0.1:порт`. macOS пускает чужой явный bind
 * `127.0.0.1:тот же порт`, и запрос уходил чужому серверу: 403/405/400 в полном прогоне. Сторож держит правило для
 * всех тестов API: приложение, в которое ходит supertest, само занимает 127.0.0.1 через `listen(0, '127.0.0.1')`.
 */
const ROOT = resolve(import.meta.dirname, '../..');

function sources(dir: string): string[] {
  return readdirSync(resolve(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') && !f.includes('node_modules'))
    .map((f) => `${dir}/${f}`);
}

describe('supertest ходит в приложение, которое само слушает 127.0.0.1', () => {
  it('ни один тест с supertest или getHttpServer() не поднимает приложение без listen на 127.0.0.1', () => {
    const files = [...sources('apps/api/src'), ...sources('tests/integration')].filter((f) => {
      const text = readFileSync(resolve(ROOT, f), 'utf8');
      return text.includes('getHttpServer()') || text.includes("from 'supertest'");
    });
    expect(files.length).toBeGreaterThan(40);
    const bad = files.filter((f) => {
      const text = readFileSync(resolve(ROOT, f), 'utf8');
      return /\.init\(\)/.test(text) || !text.includes("listen(0, '127.0.0.1')");
    });
    expect(bad, "замените await app.init() на await app.listen(0, '127.0.0.1')").toEqual([]);
  });
});
