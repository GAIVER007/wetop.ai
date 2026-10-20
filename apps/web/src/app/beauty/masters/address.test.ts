import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BeautyDay, BeautyEmployeeRow } from '../../../lib/api';

const captured = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => {
    effect();
  },
  useTransition: () => [false, (action: () => void) => action()],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: captured.replace }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement('a', { href, ...props }, children),
}));
vi.mock('../../../components/ui', () => ({
  Button: ({ children, ...props }: { children?: ReactNode }) =>
    createElement('button', props, children),
  Alert: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  Badge: ({ children }: { children?: ReactNode }) => createElement('span', null, children),
}));
vi.mock('../../../components/overlay', () => ({
  Overlay: ({ open, children, title }: { open: boolean; children: ReactNode; title: string }) =>
    open ? createElement('section', { role: 'dialog', 'aria-label': title }, children) : null,
}));
vi.mock('../../../components/employee-workspace/workspace', () => ({
  EmployeeProfile: () => createElement('div', { 'data-testid': 'create-profile' }),
  EmployeeTransitionGuard: ({ children }: { children: ReactNode }) => children,
}));

import { employeeProfileHref, MastersBoard } from './board';

const row = (id: string): BeautyEmployeeRow => ({
  id,
  name: `Мастер ${id}`,
  phone: null,
  email: null,
  active: true,
  serviceIds: [],
  locationIds: [],
});

function renderBoard(initialEmployeeId = '') {
  return renderToStaticMarkup(createElement(MastersBoard, {
    items: [row('A'), row('B')],
    services: [],
    canEdit: true,
    locations: [],
    initialEmployeeId,
    today: { columns: [], appointments: [] } as unknown as BeautyDay,
  }));
}

beforeEach(() => captured.replace.mockClear());

describe('employee profile address boundary', () => {
  it('uses canonical full-profile links from the employee list', () => {
    const html = renderBoard();

    expect(html).toContain('href="/employees/A/profile"');
    expect(html).toContain('href="/employees/B/profile"');
    expect(html).not.toContain('?employee=');
  });

  it('redirects an authorized legacy employee query to the canonical profile', () => {
    renderBoard('B');

    expect(captured.replace).toHaveBeenCalledWith('/employees/B/profile', { scroll: false });
  });

  it('keeps creation on the employee list behind the existing guarded dialog boundary', () => {
    const html = renderBoard();

    expect(html).toContain('Добавить специалиста');
    expect(html).not.toContain('aria-label="Новый специалист"');
    expect(html).not.toContain('data-testid="create-profile"');
  });

  it('escapes employee ids in canonical profile paths', () => {
    expect(employeeProfileHref('id/with space')).toBe('/employees/id%2Fwith%20space/profile');
  });
});
