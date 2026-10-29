import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Владелец 29.10.2026: «под телефон и комп сделали, теперь планшет и складной iPhone Duo; чётко, ровно, без кривого».
// Раскрытый Duo 626, iPad mini 744, iPad 820, Duo боком 890: таблица записей в одну строку не влезала (клиент «NO…»,
// кнопка «Открыть» за краем). На планшете 601–960 записи карточками в две ровные колонки, строка таблицы с 961.
// На сенсоре любой ширины кнопки, поля, вкладки и чипы не ниже 44 px (pointer: coarse), мышь не трогаем.
const beauty = readFileSync(new URL('../beauty/beauty.css', import.meta.url), 'utf8');
const components = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
const owner = readFileSync(new URL('../today/unified-owner.css', import.meta.url), 'utf8');
const block = (css: string, head: string) => {
  const at = css.indexOf(head);
  expect(at, head).toBeGreaterThan(-1);
  return css.slice(at, at + 4000);
};

describe('планшет и складной iPhone: записи и касания', () => {
  it('строка записей в одну линию только с 961 px, на ноутбуке до 1279 без «Автора»', () => {
    expect(beauty).toContain('@media (min-width: 961px) {\n    /* записи в одну строку');
    expect(beauty).toContain('@media (min-width: 961px) and (max-width: 1279px) {');
    expect(beauty).not.toContain('@media (min-width: 601px) {\n    /* записи в одну строку');
  });
  it('601–960: карточки в две колонки одной ширины, подписи слева, кнопка внутри карточки', () => {
    const b = block(beauty, '@media (min-width: 601px) and (max-width: 960px) {\n    /* планшет: записи карточками');
    expect(b).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(b).toContain('grid-auto-rows: 1fr');
    expect(b).toContain('margin-top: auto');
    expect(b).toContain('.beauty-appointments-table thead');
    expect(b).toContain('content: attr(data-label)');
    expect(b).toMatch(/td\[data-col='actions'\][^}]*\.btn[^}]*width: 100%/);
  });
  it('сенсор: кнопки, поля, вкладки и чипы не ниже 44 px', () => {
    const b = block(components, '@media (pointer: coarse) {\n    /* сенсор (планшет, складной телефон)');
    for (const sel of ['.btn', '.inp', '.tabs__item', '.chip', '.seg__item', 'details.date-range > summary']) expect(b).toContain(sel);
    expect(b).toContain('min-height: var(--touch-target)');
  });
  it('главная: «Расходов за период пока нет» переносится, не вылезает на узком экране', () => {
    expect(owner).toMatch(/@media \(max-width: 600px\) \{[^}]*\.owner-home \.owner-expense-panel \{[^}]*flex-wrap: wrap/);
  });
});
