import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Зарплата: одни подписи у всех направлений (решение владельца 23.10.2026,
 * docs/decisions/2026-10-23-vertical-unification-owner-yes.md п. 2): «Удержания», «Начислено»,
 * «Выплачено», «Осталось»; слово «Штраф» в зарплате не используется. Расчёт не меняется.
 */
const food = readFileSync('apps/web/src/app/food/payroll-board.tsx', 'utf8');
const hotel = readFileSync('apps/web/src/app/payroll/hotel-payroll.tsx', 'utf8');

describe('подписи зарплаты одинаковые у гостиницы, салона и ресторана', () => {
  it('салон и ресторан: колонки «Премии, Удержания, Начислено, Выплачено, Осталось»', () => {
    // KK3: колонки через перевод, тот же порядок слов
    expect(food).toContain("msg('Премии'), msg('Удержания'), msg('Начислено'), msg('Выплачено'), msg('Осталось')");
    expect(food).toContain("'Премия или удержание'");
    expect(food).not.toMatch(/['«]Штраф/);
  });
  it('гостиница: база оплаты первой («Уборок», «За уборки», как «Доход» салона), затем «Модель» и те же «Премии, Удержания, Начислено»', () => {
    // владелец 26.10.2026: первым столбцом то, с чего считается оплата; у гостиницы это уборки
    expect(hotel).toContain("'Сотрудник', 'Уборок', 'За уборки', 'Модель',");
    expect(hotel).toContain('data-testid="payroll-piece-total"');
    expect(hotel).toContain("'Премии', 'Удержания', 'Начислено'");
    expect(hotel).toContain("'Премия или удержание'");
    expect(hotel).not.toMatch(/['«]Штраф/);
  });
});
