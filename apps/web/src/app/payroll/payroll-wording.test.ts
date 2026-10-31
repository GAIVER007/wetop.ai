import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Зарплата: одни подписи у всех направлений (решение владельца 23.10.2026,
 * docs/decisions/2026-10-23-vertical-unification-owner-yes.md п. 2): «Удержания», «Начислено»,
 * «Выплачено», «Осталось»; слово «Штраф» в зарплате не используется. Расчёт не меняется.
 */
const food = readFileSync('apps/web/src/app/food/payroll-board.tsx', 'utf8');
const hotel = readFileSync('apps/web/src/app/payroll/hotel-payroll.tsx', 'utf8') + readFileSync('apps/web/src/app/payroll/hotel-page.tsx', 'utf8');

describe('подписи зарплаты одинаковые у гостиницы, салона и ресторана', () => {
  it('салон и ресторан: колонки «Премии, Удержания, Начислено, Выплачено, Осталось»', () => {
    // KK3: колонки через перевод, тот же порядок слов
    expect(food).toContain("msg('Премии'), msg('Удержания'), msg('Начислено'), msg('Выплачено'), msg('Осталось')");
    expect(food).toContain("'Премия или удержание'");
    expect(food).not.toMatch(/['«]Штраф/);
  });
  // владелец 31.10.2026: «Зарплата в гостиницах должна быть ровно так же, как в салонах»
  it('гостиница: те же колонки, итоги месяца, вкладки и «Выплатить», что у салона', () => {
    // база оплаты первой (уборки вместо «Выручки»), дальше как у салона
    expect(hotel).toContain("msg('Сотрудник'), msg('Уборок'), msg('Как платим'), msg('Оклад'), msg('За уборки')");
    expect(hotel).toContain("msg('Премии'), msg('Удержания'), msg('Начислено'), msg('Выплачено'), msg('Осталось')");
    expect(hotel).toContain('<PayrollTotals');
    expect(hotel).toContain("label: t('Начисления')");
    // выплата из кассы гостиницы отдельным срезом (касса объекта без сотрудника в операции, нужна миграция)
    expect(hotel).toContain("'Премия или удержание'");
    expect(hotel).not.toMatch(/['«]Штраф/);
  });
});
