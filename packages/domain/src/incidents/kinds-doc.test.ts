import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POLICY } from './incidents';

/**
 * v1.7 §12 (ADR-082): список видов неисправностей в `DATA_MODEL.md` разъехался с кодом — в документе не было
 * `webhook.misrouted`, `ari.delta.lost` и `backup.stale`, а `exely.stale` остался после снятия его проверки
 * (ADR-073). Источник правды — `POLICY` здесь; этот тест держит документ в сверке: разъехались — красный
 * с именами видов, а не тихое устаревание.
 */
describe('DATA_MODEL §12: виды неисправностей — по POLICY', () => {
  it('kind в SystemIncident перечисляет ровно виды из POLICY', () => {
    const doc = readFileSync(resolve(import.meta.dirname, '../../../../DATA_MODEL.md'), 'utf-8');
    // Блок «kind …» до следующего поля (class): в нём виды через « | », с переносами строк
    const block = /\nkind\s+вид неисправности([\s\S]*?)\nclass\s/.exec(doc);
    expect(block, 'в §12 не нашёлся блок «kind … вид неисправности …»').not.toBeNull();
    const documented = new Set(block![1]!.match(/[a-z]+(?:\.[a-z]+)+/g) ?? []);
    const inCode = new Set(Object.keys(POLICY));
    const missing = [...inCode].filter((k) => !documented.has(k)).sort();
    const stale = [...documented].filter((k) => !inCode.has(k)).sort();
    expect(missing, 'виды есть в POLICY, но не в DATA_MODEL §12').toEqual([]);
    expect(stale, 'виды есть в DATA_MODEL §12, но их нет в POLICY').toEqual([]);
  });
});
