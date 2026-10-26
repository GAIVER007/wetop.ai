import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('../hotel-staff/actions', () => ({ hotelPaySettingsAction: vi.fn(), hotelAdjustmentAction: vi.fn() }));
vi.mock('../../components/overlay', () => ({
  Overlay: ({ title, children }: { title: string; children: ReactNode }) => h('section', { 'data-title': title }, children),
}));

import { HotelPayDrawer } from './hotel-payroll';

/**
 * Окно «Оплата» гостиницы в том же виде, что у салона и ресторана (владелец 26.10.2026: «всё, что делаешь, применить
 * для всех вертикалей»): способы строками с иконкой и пояснением, поля с валютой внутри, без «к выплате».
 */
describe('окно оплаты гостиницы: вариант B', () => {
  const row = { employeeId: 'e1', name: 'Горничная Пример', model: 'FIXED', fixedMinor: '15000000', perCleaningMinor: '50000' } as never;
  const html = renderToStaticMarkup(h(HotelPayDrawer, { scopeKey: 'b:l', row, currency: 'KZT', close() {} })).replace(/<!-- -->/g, '');
  it('два способа строками с иконкой: оклад и без оклада', () => {
    expect(html.match(/class="pay-choice"/g)).toHaveLength(2);
    expect(html.match(/class="pay-choice__icon"/g)).toHaveLength(2);
    expect(html).toContain('Оклад в месяц плюс уборки');
    expect(html).toContain('Только за уборки и премии');
    expect(html).not.toContain('<select');
  });
  it('оклад и уборка с валютой внутри поля', () => {
    expect(html).toMatch(/value="150000(\.00)?"[^>]*>[\s\S]*?class="pay-unit"[^>]*>₸</);
    expect(html).toMatch(/value="500(\.00)?"[^>]*>[\s\S]*?class="pay-unit"[^>]*>₸</);
  });
});
