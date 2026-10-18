import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyDay, BeautyEmployeeRow } from '../../../lib/api';
import { MastersBoard } from './board';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace() {} }) }));
vi.mock('../../../components/overlay', () => ({ Overlay: () => null }));
vi.mock('../../../components/employee-workspace/workspace', () => ({
  EmployeeProfile: () => null,
  EmployeeTransitionGuard: ({ children }: { children: unknown }) => children,
}));

const employee: BeautyEmployeeRow = {
  id: 'synthetic-master',
  name: 'Synthetic Master',
  phone: null,
  email: null,
  active: true,
  serviceIds: [],
  locationIds: ['synthetic-location'],
};

const unavailableDay: BeautyDay = {
  location: { id: 'synthetic-location', name: 'Synthetic Salon', timezone: 'UTC', currency: 'USD' },
  date: '',
  columns: [],
  appointments: [],
  services: [],
  bounds: { fromMinutes: 480, toMinutes: 1200 },
};

describe('master schedule projection', () => {
  it('shows an unavailable state instead of inventing a day off', () => {
    const html = renderToStaticMarkup(createElement(MastersBoard, {
      items: [employee],
      services: [],
      today: unavailableDay,
      locations: [{ id: 'synthetic-location', name: 'Synthetic Salon', assigned: true }],
      scheduleAvailable: false,
    }));

    expect(html).toContain('График недоступен');
    expect(html).not.toContain('Выходной');
    expect(html).not.toContain('Сегодня не работает');
  });
});
