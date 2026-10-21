import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BeautyDay, BeautyEmployeeRow } from '../../../lib/api';

/**
 * «Специалисты» салона, аудит живого сайта 21.10.2026: новый специалист сразу в списке (п. 1),
 * `/employees?new=1` открывает окно (п. 16), пустой список с кнопкой (п. 19), период только при строках (п. 18).
 */
const captured = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  onSaved: null as null | ((row: BeautyEmployeeRow) => void),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: captured.replace, refresh: captured.refresh }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement('a', { href }, children),
}));
vi.mock('../../../components/overlay', () => ({
  Overlay: ({ open, children, title }: { open: boolean; children: ReactNode; title: string }) =>
    open ? createElement('section', { role: 'dialog', 'aria-label': title }, children) : null,
}));
vi.mock('../../../components/employee-workspace/workspace', () => ({
  EmployeeProfile: ({ onSaved }: { onSaved: (row: BeautyEmployeeRow) => void }) => {
    captured.onSaved = onSaved;
    return createElement('div', { 'data-testid': 'create-profile' });
  },
  EmployeeTransitionGuard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../../../components/tabs', () => ({
  Tabs: ({ panels }: { panels: Array<{ id: string; content: ReactNode }> }) =>
    createElement('div', null, panels.map((p) => createElement('section', { key: p.id, 'data-panel': p.id }, p.content))),
}));
vi.mock('../actions', () => ({ assignBeautyPersonnelKind: vi.fn() }));

import { MastersBoard } from './board';

const row: BeautyEmployeeRow = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Тестовый Мастер',
  phone: null,
  email: null,
  active: true,
  serviceIds: [],
  locationIds: [],
};
const today = { columns: [], appointments: [] } as unknown as BeautyDay;
const nav = createElement('nav', { 'data-testid': 'period' }, 'День Неделя Месяц');
const revenue = { period: 'day' as const, fromDate: '2026-10-21', toDate: '2026-10-21', items: [] };

beforeEach(() => {
  captured.replace.mockClear();
  captured.refresh.mockClear();
  captured.onSaved = null;
});

describe('Специалисты: аудит 21.10.2026', () => {
  it('?new=1 сразу открывает окно нового специалиста', () => {
    const html = renderToStaticMarkup(
      createElement(MastersBoard, { items: [], services: [], today, locations: [], canCreate: true, openNew: true }),
    );
    expect(html).toContain('aria-label="Новый специалист"');
    expect(html).toContain('data-testid="create-profile"');
  });

  it('после создания список обновляется с сервера, без перезагрузки страницы', () => {
    renderToStaticMarkup(
      createElement(MastersBoard, { items: [], services: [], today, locations: [], canCreate: true, openNew: true }),
    );
    expect(captured.onSaved).toBeTypeOf('function');
    captured.onSaved!(row);
    expect(captured.refresh).toHaveBeenCalled();
    expect(captured.replace).toHaveBeenCalledWith('/employees/11111111-1111-4111-8111-111111111111/profile', { scroll: false });
  });

  it('пустой список: кнопка внутри пустого состояния, переключателя периода нет', () => {
    const html = renderToStaticMarkup(
      createElement(MastersBoard, { items: [], services: [], today, locations: [], canCreate: true, revenue, revenueNav: nav }),
    );
    expect(html).toContain('Добавьте первого специалиста');
    expect(html).toMatch(/<button[^>]*>Добавить первого специалиста<\/button>/);
    expect(html).not.toContain('data-testid="period"');
  });

  it('со строками период «Принёс» на месте', () => {
    const html = renderToStaticMarkup(
      createElement(MastersBoard, { items: [row], services: [], today, locations: [], canCreate: true, revenue, revenueNav: nav }),
    );
    expect(html).toContain('data-testid="period"');
    expect(html).not.toContain('Добавить первого специалиста');
  });
});
