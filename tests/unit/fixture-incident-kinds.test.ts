import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POLICY } from '../../packages/domain/src/incidents/incidents';

/**
 * План дизайн-системы §10 п. 5: синтетический API стойки засевал неисправность вида
 * `booking.unassigned`, которого в домене нет (там `stay.unassigned`). Экран «Неисправности» и
 * UI-набор её показывали, но подсказка смене и класс брались бы по несуществующему виду.
 * Сторож: каждый `kind` в засевах фикстуры — вид из `POLICY` домена.
 */
const FIXTURE = resolve(__dirname, '../../scripts/preview/fixture-api.ts');

describe('фикстура UI: виды неисправностей — только из домена', () => {
  it('каждый kind у Incident в fixture-api.ts есть в POLICY', () => {
    const text = readFileSync(FIXTURE, 'utf8');
    // берём только объекты, объявленные как Incident (засев и то, что создаётся по ходу)
    const incidentBlocks = [...text.matchAll(/:\s*Incident\s*=\s*\{([\s\S]*?)\n\};/g)];
    expect(incidentBlocks.length).toBeGreaterThan(0);
    const kinds = incidentBlocks.flatMap(([, body]) =>
      [...body!.matchAll(/\bkind:\s*'([^']+)'/g)].map((m) => m[1]!),
    );
    expect(kinds.length).toBeGreaterThan(0);
    const unknown = kinds.filter((k) => !(k in POLICY));
    expect(unknown).toEqual([]);
  });
});
