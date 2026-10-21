import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Единый экран персонала (вариант A, решение владельца 20.10.2026, docs/decisions/2026-10-20-unified-staff-screen.md)
vi.mock('./tabs', () => ({
  Tabs: ({ panels }: { panels: Array<{ id: string; label: string; count?: number; content: ReactNode }> }) =>
    createElement('div', null,
      createElement('nav', null, panels.map((p) => createElement('span', { key: p.id, 'data-tab': p.id }, `${p.label}${p.count ?? ''}`))),
      panels.map((p) => createElement('section', { key: p.id, 'data-panel': p.id }, p.content))),
}));

import { StaffBoard, type StaffColumn } from './staff-board';

type Row = { id: string; name: string; earned: string | null };
const rows: Row[] = [
  { id: 'a', name: 'Анна', earned: '9 000 ₸' },
  { id: 'b', name: 'Борис', earned: null },
];
const columns: StaffColumn<Row>[] = [
  { key: 'name', label: 'Сотрудник', cell: (r) => r.name },
  { key: 'earned', label: 'Принёс сегодня', align: 'end', cell: (r) => r.earned },
  { key: 'rating', label: 'Рейтинг', cell: () => null, hidden: true },
];
const render = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(StaffBoard<Row>, {
    caption: 'Сотрудники ресторана',
    tabs: [{ id: 'all', label: 'Все', rows }, { id: 'un', label: 'Не назначено', rows: rows.slice(1) }],
    columns,
    search: (r: Row) => r.name,
    period: createElement('nav', { 'data-period': '' }),
    footer: 'Заказы без официанта: 2 000 ₸',
    actions: createElement('button', null, '+ Добавить сотрудника'),
    ...extra,
  }));

describe('StaffBoard: один вид для всех направлений', () => {
  it('без плиток сводки (владелец 20.10.2026: «убери вообще»); вкладки с числами, период и итог под таблицей', () => {
    const html = render();
    expect(html).not.toContain('staff-board__stats');
    expect(html).not.toContain('В персонале');
    expect(html).toMatch(/data-tab="all">Все2/);
    expect(html).toMatch(/data-tab="un">Не назначено1/);
    expect(html).toContain('data-period');
    expect(html).toContain('Заказы без официанта: 2 000 ₸');
    expect(html).toContain('Показано 2 из 2');
    expect(html).toContain('+ Добавить сотрудника');
  });
  it('таблица в одну строку, пустая ячейка = прочерк, скрытая колонка не рисуется', () => {
    const html = render();
    expect(html).toContain('tbl--nowrap');
    expect(html).not.toContain('Рейтинг');
    const boris = html.split('data-panel="all"')[1]!.split('Борис')[1]!.split('</tr>')[0]!;
    expect(boris).toContain('—');
  });
  it('пустая вкладка: понятный текст вместо пустой таблицы', () => {
    const html = render({ tabs: [{ id: 'all', label: 'Все', rows: [], empty: 'Сотрудников пока нет' }] });
    expect(html).toContain('Сотрудников пока нет');
    expect(html).not.toContain('<table');
  });
});
