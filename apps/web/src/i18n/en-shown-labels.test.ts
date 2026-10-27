import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { beautyStatus } from '../lib/status/beauty';
import { STAFF_REVENUE_PERIODS } from '../lib/staff-revenue';
import { translator } from './index';

/**
 * Справочники показываются через t(…) (английский салон Lashes by Kyial, 27.10.2026): обход стенда на English нашёл
 * русские статусы записи в фильтре журнала и «День / Неделя / Месяц» у «Принёс» в «Сотрудниках».
 */
const src = (p: string) => readFileSync(`apps/web/src/${p}`, 'utf8');
describe('справочники на экране переводятся', () => {
  it('статусы записи салона: перевод есть, фильтр журнала показывает t(label)', () => {
    const en = translator('en');
    for (const st of Object.values(beautyStatus)) expect(en(st.label), st.label).not.toBe(st.label);
    expect(src('app/beauty/journal.tsx')).toContain('label: t(st.label)');
  });
  it('период «Принёс»: День, Неделя, Месяц через перевод', () => {
    const en = translator('en');
    for (const p of STAFF_REVENUE_PERIODS) expect(en(p.label)).not.toBe(p.label);
    const nav = src('lib/staff-revenue-load.tsx');
    expect(nav).toContain('t(p.label)');
    expect(nav).not.toContain('{p.label}');
  });
});
