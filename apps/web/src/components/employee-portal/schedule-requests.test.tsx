import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PortalScheduleRequest } from '@pms/domain';
vi.mock('../../app/my-work/actions', () => ({ savePortal: vi.fn(), loadPortalWeek: vi.fn() }));
import { PortalScheduleRequests } from './forms';

// график через руководителя (владелец 28.10.2026): мастер видит свои запросы и просит отпуск, руководитель решает
const context = { target: { employeeId: null }, scope: 's', onSaved: () => undefined };
const week: PortalScheduleRequest = { id: 'w', kind: 'WEEK', status: 'PENDING', payload: { intervals: [{ weekday: 1, timeFrom: '12:00', timeTo: '20:00' }] }, createdAt: '2026-10-28T08:00:00Z', decidedAt: null, decisionNote: null };
const off: PortalScheduleRequest = { id: 'o', kind: 'TIME_OFF', status: 'REJECTED', payload: { dateFrom: '2026-11-10', dateTo: '2026-11-14', reason: 'Отпуск' }, createdAt: '2026-10-27T08:00:00Z', decidedAt: '2026-10-27T09:00:00Z', decisionNote: 'Много записей' };

describe('запросы графика', () => {
  it('мастер: свои запросы со статусом, отмена ожидающего, просьба об отпуске', () => {
    const html = renderToStaticMarkup(<PortalScheduleRequests requests={[week, off]} context={context} manager={false} />);
    expect(html).toContain('Мои запросы');
    expect(html).toContain('Неделя: Пн 12:00–20:00; Вт вых.');
    expect(html).toContain('Ждёт подтверждения');
    expect(html).toContain('Отклонено: Много записей');
    expect(html).toContain('Отсутствие 2026-11-10 по 2026-11-14: Отпуск');
    expect(html).toContain('Отменить запрос');
    expect(html).toContain('Попросить выходной или отпуск');
    expect(html).not.toContain('Подтвердить');
  });
  it('руководитель: только ожидающие, кнопки «Подтвердить» и «Отклонить», без просьбы об отпуске', () => {
    const html = renderToStaticMarkup(<PortalScheduleRequests requests={[week, off]} context={{ ...context, target: { employeeId: 'e' } }} manager />);
    expect(html).toContain('Запросы на изменение графика');
    expect(html).toContain('Подтвердить');
    expect(html).toContain('Отклонить');
    expect(html).not.toContain('Много записей');
    expect(html).not.toContain('Попросить выходной или отпуск');
  });
});
