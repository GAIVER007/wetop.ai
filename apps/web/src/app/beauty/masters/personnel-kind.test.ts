import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyDay, BeautyEmployeeRow, BeautySchedule } from '../../../lib/api';

// Экран «Специалисты»: вкладки по назначению (DATA_MODEL.md, решения 18.10 и 20.10.2026) и выбор назначения у строки
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement('a', { href }, children),
}));
vi.mock('../../../components/ui', () => ({
  Alert: ({ children }: { children: ReactNode }) =>
    createElement('div', { role: 'alert' }, children),
  Badge: ({ children }: { children: ReactNode }) =>
    createElement('span', { 'data-badge': '' }, children),
  Button: ({ children, ...props }: { children: ReactNode }) =>
    createElement('button', props, children),
  Select: ({ children, ...props }: { children: ReactNode }) =>
    createElement('select', props, children),
}));
vi.mock('../../../components/overlay', () => ({ Overlay: () => null }));
vi.mock('../../../components/employee-workspace/workspace', () => ({
  EmployeeProfile: () => null,
  EmployeeTransitionGuard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../actions', () => ({ assignBeautyPersonnelKind: vi.fn() }));
vi.mock('../../../components/tabs', () => ({
  Tabs: ({ panels }: { panels: Array<{ id: string; label: string; content: ReactNode }> }) =>
    createElement(
      'div',
      null,
      createElement(
        'nav',
        null,
        panels.map((p) => createElement('span', { key: p.id, 'data-tab': p.id }, p.label)),
      ),
      panels.map((p) => createElement('section', { key: p.id, 'data-panel': p.id }, p.content)),
    ),
}));

import { MastersBoard } from './board';

const person = (
  id: string,
  name: string,
  personnelKind: 'SPECIALIST' | 'OTHER_EMPLOYEE' | 'BOTH' | null,
): BeautyEmployeeRow => ({
  id: `11111111-1111-4111-8111-11111111111${id}`,
  name,
  phone: null,
  email: null,
  active: true,
  serviceIds: [],
  locationIds: [],
  profileRevision: '2026-10-20T10:00:00.000000Z',
  personnelKind,
});
const today = { columns: [], appointments: [] } as unknown as BeautyDay;
const render = (items: BeautyEmployeeRow[], canAssignPersonnelKind: boolean) =>
  renderToStaticMarkup(
    createElement(MastersBoard, {
      items,
      services: [],
      today,
      locations: [] as BeautySchedule['locations'],
      canCreate: true,
      canAssignPersonnelKind,
    }),
  );
const panel = (html: string, id: string) =>
  html.split(`data-panel="${id}"`)[1]!.split('</section>')[0]!;

describe('экран «Специалисты»: назначение', () => {
  const items = [
    person('1', 'Анна Специалист', 'SPECIALIST'),
    person('2', 'Борис Администратор', 'OTHER_EMPLOYEE'),
    person('3', 'Вера Оба', 'BOTH'),
    person('4', 'Глеб Старый', null),
  ];

  it('вкладки: «Не назначено (N)» первой, «оба» в обеих группах', () => {
    const html = render(items, true);
    expect([...html.matchAll(/data-tab="(\w+)">([^<]+)</g)].map((m) => [m[1], m[2]])).toEqual([
      ['unassigned', 'Не назначено (1)'],
      ['specialists', 'Специалисты'],
      ['employees', 'Другие сотрудники'],
    ]);
    expect(panel(html, 'unassigned')).toContain('Укажите, кто это');
    expect(panel(html, 'unassigned')).toContain('Глеб Старый');
    const specialists = panel(html, 'specialists');
    expect(specialists).toContain('Анна Специалист');
    expect(specialists).toContain('Вера Оба');
    expect(specialists).not.toContain('Борис Администратор');
    const employees = panel(html, 'employees');
    expect(employees).toContain('Борис Администратор');
    expect(employees).toContain('Вера Оба');
    expect(employees).not.toContain('Анна Специалист');
  });

  it('без старых записей вкладки «Не назначено» нет', () => {
    const html = render(items.slice(0, 3), true);
    expect(html).not.toContain('data-tab="unassigned"');
  });

  it('руководитель видит выбор назначения у каждой строки', () => {
    const html = render(items, true);
    expect(html).toContain('aria-label="Назначение: Анна Специалист"');
    expect(html).toContain('aria-label="Назначение: Глеб Старый"');
    for (const label of ['Специалист', 'Другой сотрудник', 'Оба'])
      expect(html).toContain(`>${label}</option>`);
    expect(panel(html, 'unassigned')).toContain('>Не назначено</option>');
  });

  it('без права только метка, без выбора', () => {
    const html = render(items, false);
    expect(html).not.toContain('<select');
    expect(panel(html, 'specialists')).toContain('data-badge="">Специалист<');
    expect(panel(html, 'unassigned')).toContain('data-badge="">Не назначено<');
  });
});
