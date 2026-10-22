import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, menuSectionsFor } from './navigation';

/**
 * Верхнее меню одно у всех направлений (решение владельца 17.10.2026: «у всех одинаково»). Разделы и пункты идут в
 * одном порядке под одними подписями, у направления свой экран за пунктом; нет экрана, нет пункта.
 */
const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
const VERTICALS = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const;
const SECTIONS = [
  'Главная',
  'Журнал',
  'Персонал',
  'Клиенты',
  'Услуги',
  'Статистика',
  'Склад',
  'Финансы',
  'Настройки',
  'Продвижение',
  'Помощь',
];
const row = (v: (typeof VERTICALS)[number]) =>
  menuSectionsFor(owner, v).map((s) => [s.label, s.items.map((i) => [i.label, i.href])] as const);

describe('одно меню для всех направлений', () => {
  it('у владельца все одиннадцать разделов в одном порядке у каждого направления', () => {
    for (const v of VERTICALS)
      expect(
        row(v).map(([label]) => label),
        v,
      ).toEqual(SECTIONS);
  });

  it('вид раздела общий: Главная, Журнал и Помощь прямые ссылки, остальные открывают список', () => {
    for (const v of VERTICALS)
      expect(
        menuSectionsFor(owner, v)
          .filter((s) => s.direct)
          .map((s) => s.label),
        v,
      ).toEqual(['Главная', 'Журнал', 'Помощь']);
  });

  it('одинаковые пункты стоят в одном порядке: подпись пункта одна для всех направлений', () => {
    // у любых двух направлений общие пункты раздела идут в одном порядке
    for (const a of VERTICALS)
      for (const b of VERTICALS)
        for (const [section, items] of row(a)) {
          const mine = items.map(([label]) => label);
          const theirs = (row(b).find(([label]) => label === section)?.[1] ?? []).map(
            ([label]) => label,
          );
          expect(
            mine.filter((l) => theirs.includes(l)),
            `${a}/${b} ${section}`,
          ).toEqual(theirs.filter((l) => mine.includes(l)));
        }
  });

  it('за пунктом свой экран направления', () => {
    const screen = (v: (typeof VERTICALS)[number], section: string, item: string) =>
      row(v)
        .find(([label]) => label === section)?.[1]
        .find(([label]) => label === item)?.[1];
    expect(VERTICALS.map((v) => screen(v, 'Журнал', 'Журнал'))).toEqual([
      '/chessboard',
      '/calendar',
      '/floor-plan',
    ]);
    expect(VERTICALS.map((v) => screen(v, 'Клиенты', 'Клиенты'))).toEqual([
      '/guests',
      '/customers',
      '/customers',
    ]);
    // слово пункта своё у направления (аудит 22.10.2026): у ресторана брони столов, меню и доступ
    const word = (v: (typeof VERTICALS)[number], common: string, food: string) => (v === 'FOOD_SERVICE' ? food : common);
    expect(VERTICALS.map((v) => screen(v, 'Клиенты', word(v, 'Записи', 'Брони столов')))).toEqual([
      '/reservations',
      '/appointments',
      '/table-reservations',
    ]);
    expect(VERTICALS.map((v) => screen(v, 'Услуги', word(v, 'Каталог', 'Меню')))).toEqual([
      '/inventory',
      '/services',
      '/menu',
    ]);
    expect(VERTICALS.map((v) => screen(v, 'Персонал', word(v, 'Сотрудники', 'Доступ и роли')))).toEqual([
      '/team',
      '/team',
      '/team',
    ]);
    // гостиница: «График работы» и «Зарплата» как у салона и ресторана (решение 22.10.2026, кабинет горничной)
    expect(VERTICALS.map((v) => screen(v, 'Персонал', 'График работы'))).toEqual([
      '/staff-schedule',
      '/beauty/schedule',
      '/employees/shifts',
    ]);
    expect(VERTICALS.map((v) => screen(v, 'Персонал', 'Зарплата'))).toEqual(['/payroll', '/payroll', '/payroll']);
    expect(VERTICALS.map((v) => screen(v, 'Финансы', 'Касса'))).toEqual([
      undefined,
      '/cashbox',
      '/cashbox',
    ]);
    expect(VERTICALS.map((v) => screen(v, 'Финансы', 'Обзор финансов'))).toEqual([
      '/finance',
      '/finance',
      '/restaurant-finance',
    ]);
  });

  it('в «Финансах» обзор стоит первым, отчёты последними, у всех направлений', () => {
    for (const v of VERTICALS) {
      const labels = (row(v).find(([label]) => label === 'Финансы')?.[1] ?? []).map(
        ([label]) => label,
      );
      expect(labels[0], v).toBe('Обзор финансов');
      expect(labels.filter((l) => l === 'Отчёты').length ? labels.at(-1) : 'Отчёты', v).toBe(
        'Отчёты',
      );
    }
  });
});
