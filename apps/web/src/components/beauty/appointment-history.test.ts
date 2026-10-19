import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppointmentHistory, type AppointmentHistoryData } from './appointment-history';

describe('A10/M4: история записи в карточке', () => {
  it('показывает время филиала, автора и изменения до/после', () => {
    const history: AppointmentHistoryData = {
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      truncated: false,
      items: [
        {
          id: 'event-1',
          at: '2036-10-19T05:00:00.000Z',
          action: 'beauty.appointment.moved',
          author: { id: 'user-1', name: 'Тестовый администратор' },
          before: {
            startsAt: '2036-10-19T05:00:00.000Z',
            employee: { id: 'employee-1', name: 'Тест Анна' },
            priceMinor: '1200000',
          },
          after: {
            startsAt: '2036-10-19T06:00:00.000Z',
            employee: { id: 'employee-2', name: 'Тест Борис' },
            priceMinor: '1500000',
          },
        },
      ],
    };

    const markup = renderToStaticMarkup(createElement(AppointmentHistory, { history }));
    expect(markup).toContain('Запись изменена');
    expect(markup).toContain('Тестовый администратор');
    expect(markup).toContain('10:00');
    expect(markup).toContain('11:00');
    expect(markup).toContain('Тест Анна');
    expect(markup).toContain('Тест Борис');
    expect(markup).toContain('12 000');
    expect(markup).toContain('15 000');
  });

  it('явно показывает пустую и усечённую историю', () => {
    const empty: AppointmentHistoryData = {
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      items: [],
      truncated: false,
    };
    const truncated = { ...empty, truncated: true };

    expect(renderToStaticMarkup(createElement(AppointmentHistory, { history: empty }))).toContain(
      'История изменений пока пуста',
    );
    expect(
      renderToStaticMarkup(createElement(AppointmentHistory, { history: truncated })),
    ).toContain('Показаны последние 100 событий');
  });
});
