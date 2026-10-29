import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// владелец 29.10.2026 (скрин зарплаты салона): строки стали высокими, «30 % от записей» в две строки,
// «Выплатить» и «…» друг под другом. Строка сотрудника одной строкой: условия и кнопки без переноса.
const css = readFileSync(new URL('./restaurant.css', import.meta.url), 'utf8');
const rule = (selector: string) => {
  const at = css.indexOf(selector + ' {');
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};
describe('зарплата: компактная строка сотрудника', () => {
  it('условия оплаты не переносятся', () => {
    expect(rule('.tbl.payroll-table .rest-pay-model')).toContain('white-space: nowrap');
  });
  it('«Выплатить» и меню в одну строку', () => {
    const r = rule('.tbl.payroll-table td:last-child .food-inline-actions');
    expect(r).toContain('flex-wrap: nowrap');
    expect(r).toContain('gap: var(--space-2)');
  });
});
