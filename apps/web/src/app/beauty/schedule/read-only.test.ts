import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ScheduleBoard, type WeekGridData } from './board';

vi.mock('../../../components/overlay', () => ({ Overlay: () => null }));
vi.mock('../actions', () => ({
  saveBeautyWorkingHours: vi.fn(),
  saveBeautyEmployeeLocations: vi.fn(),
  loadBeautySchedule: vi.fn(),
}));

const data: WeekGridData = {
  location: { id: 'synthetic-location', name: 'Тестовый салон' },
  monday: '2026-10-19',
  elsewhere: 0,
  masters: [{
    id: 'synthetic-master', name: 'Тестовый мастер', weekRevision: 'synthetic-original-week', timeOffs: [],
    week: Array.from({ length: 7 }, (_, weekday) => ({
      weekday, intervals: weekday === 1 ? [{ timeFrom: '09:00', timeTo: '18:00' }] : [],
    })),
  }],
};

describe('Schedule grid read-only access', () => {
  it('keeps hours visible without any entry into an editable form', () => {
    const html = renderToStaticMarkup(createElement(ScheduleBoard, { data, canEdit: false }));
    expect(html).toContain('Тестовый мастер');
    expect(html).toContain('09:00–18:00');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain('Сохранить график');
  });
  it('retains the hours editor entry and switches for managers', () => {
    const html = renderToStaticMarkup(createElement(ScheduleBoard, { data, canEdit: true }));
    expect(html).toContain('<button');
    expect(html).toContain('Тестовый мастер');
    expect(html).toContain('role="switch"');
  });
});
