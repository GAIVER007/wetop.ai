import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { FoodEmployee } from '../../lib/food-types';

// «Сотрудники» ресторана: вкладки по назначению (решение владельца 20.10.2026) и выбор назначения у строки
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('./restaurant-actions', () => ({ mutateStaff: vi.fn(), assignFoodPersonnelKind: vi.fn() }));
vi.mock('../../components/use-confirm', () => ({ useConfirm: () => ({ ask: vi.fn(), dialog: null }) }));
vi.mock('../../components/tabs', () => ({
  Tabs: ({ panels }: { panels: Array<{ id: string; label: string; content: ReactNode }> }) =>
    createElement(
      'div',
      null,
      createElement('nav', null, panels.map((p) => createElement('span', { key: p.id, 'data-tab': p.id }, p.label))),
      panels.map((p) => createElement('section', { key: p.id, 'data-panel': p.id }, p.content)),
    ),
}));

import { EmployeesBoard } from './employees-board';

const person = (id: string, name: string, personnelKind: 'SPECIALIST' | 'OTHER_EMPLOYEE' | 'BOTH' | null): FoodEmployee => ({
  id: `22222222-2222-4222-8222-22222222222${id}`,
  profileRevision: '2026-10-20T10:00:00.000000Z',
  name, phone: null, email: null, status: 'ACTIVE', shift: null, onShift: false, salesTodayMinor: '0',
  personnelKind,
});
const items = [
  person('1', 'Айгерим Повар', 'SPECIALIST'),
  person('2', 'Бауыржан Кассир', 'OTHER_EMPLOYEE'),
  person('3', 'Вика Оба', 'BOTH'),
  person('4', 'Гани Старый', null),
];
const render = (canAssignPersonnelKind: boolean, list = items) =>
  renderToStaticMarkup(createElement(EmployeesBoard, {
    scopeKey: 'b:l', write: true, employees: list, branchName: 'Зал', canAssignPersonnelKind,
  }));
const panel = (html: string, id: string) => html.split(`data-panel="${id}"`)[1]!.split('</section>')[0]!;

describe('ресторан: назначение в «Сотрудниках»', () => {
  it('вкладки: «Не назначено (N)» первой, «оба» в обеих группах', () => {
    const html = render(true);
    expect([...html.matchAll(/data-tab="(\w+)">([^<]+)</g)].map((m) => m[2])).toEqual([
      'Не назначено (1)', 'Специалисты', 'Другие сотрудники',
    ]);
    expect(panel(html, 'specialists')).toContain('Вика Оба');
    expect(panel(html, 'specialists')).not.toContain('Бауыржан Кассир');
    expect(panel(html, 'employees')).toContain('Вика Оба');
    expect(panel(html, 'employees')).not.toContain('Айгерим Повар');
    expect(panel(html, 'unassigned')).toContain('Гани Старый');
  });
  it('руководитель выбирает назначение, без права только метка', () => {
    expect(render(true)).toContain('aria-label="Назначение: Гани Старый"');
    const readonly = render(false);
    expect(readonly).not.toContain('aria-label="Назначение:');
    expect(panel(readonly, 'specialists')).toContain('Специалист');
  });
  it('без старых записей вкладки «Не назначено» нет', () => {
    expect(render(true, items.slice(0, 3))).not.toContain('data-tab="unassigned"');
  });

  // замечание владельца 20.10.2026 «кривые переносы»: строка в одну линию, филиал один раз над таблицей
  it('строка без переносов: филиал над таблицей, а не колонкой; действия одной группой', () => {
    const html = render(true);
    expect(html).toContain('Филиал: Зал');
    expect(html).not.toContain('>Филиал</th>');
    expect(html).toMatch(/class="[^"]*\brest-staff-table\b/);
    expect(html).toContain('class="rest-staff-actions"');
  });
});
