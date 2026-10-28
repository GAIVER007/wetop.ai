import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('../hotel-staff/actions', () => ({ hotelPaySettingsAction: vi.fn(), hotelAdjustmentAction: vi.fn() }));
vi.mock('../../components/overlay', () => ({
  Overlay: ({ title, children }: { title: string; children: ReactNode }) => h('section', { 'data-title': title }, children),
}));

import { HotelPayDrawer, HotelPayrollBoard } from './hotel-payroll';

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
  it('подпись поля ведёт на само поле ввода, id без повторов (читалка и тесты находят поле по подписи)', () => {
    const fors = [...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map((m) => m[1]);
    expect(fors.length).toBeGreaterThan(0);
    for (const id of fors) {
      expect(html.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
      expect(html).toMatch(new RegExp(`<input[^>]*id="${id}"`));
    }
  });
});

/** База оплаты первой (как «Доход» у салона и ресторана): «Уборок» и «За уборки» сразу после имени, итог под ними */
describe('зарплата гостиницы: уборки первыми', () => {
  const payroll = {
    currency: 'KZT',
    rows: [{ employeeId: 'e1', name: 'Горничная Пример', model: 'PIECE', fixedMinor: '0', perCleaningMinor: '50000', cleanings: 7, pieceMinor: '350000', bonusMinor: '0', penaltyMinor: '0', totalMinor: '350000' }],
    totals: { bonusMinor: '0', penaltyMinor: '0', payoutMinor: '350000' },
  } as never;
  const html = renderToStaticMarkup(h(HotelPayrollBoard, { scopeKey: 'b:l', write: false, payroll })).replace(/<!-- -->/g, '');
  const cells = (row: string) => [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, '').trim());
  it('шапка: Сотрудник, Уборок, За уборки, Модель', () => {
    const head = cells(html.slice(html.indexOf('<thead'), html.indexOf('</thead>')));
    expect(head.slice(0, 4)).toEqual(['Сотрудник', 'Уборок', 'За уборки', 'Модель']);
  });
  it('строка и итог в том же порядке', () => {
    const body = cells(html.slice(html.indexOf('<tbody'), html.indexOf('</tbody>')));
    expect(body[1]).toBe('7');
    expect(body[2]).toMatch(/^3\s?500/);
    const foot = cells(html.slice(html.indexOf('<tfoot'), html.indexOf('</tfoot>')));
    expect(foot[1]).toBe('7');
  });
});
