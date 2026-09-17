import { describe, expect, it } from 'vitest';
import { outboxRowSummary } from './outbox-rows';

const names = {
  roomTypeById: new Map([['rt-1', 'Двухместный номер']]),
  ratePlanById: new Map([['rp-1', 'Мужской общий номер']]),
};

describe('outboxRowSummary — строка очереди ARI для журнала интеграции', () => {
  it('остатки: даты по краям всех сообщений, категории по маппингу, число сообщений', () => {
    const s = outboxRowSummary(
      [
        {
          property_id: 'p',
          room_type_id: 'rt-1',
          date_from: '2026-09-16',
          date_to: '2026-09-17',
          availability: 3,
        },
        {
          property_id: 'p',
          room_type_id: 'rt-1',
          date_from: '2026-09-14',
          date_to: '2026-09-15',
          availability: 4,
        },
      ],
      names,
    );
    expect(s).toEqual({
      dateFrom: '2026-09-14',
      dateTo: '2026-09-17',
      roomTypes: ['Двухместный номер'],
      messages: 2,
    });
  });
  it('цены и ограничения: категория через тариф; незнакомый id остаётся id, чтобы строка не молчала', () => {
    const s = outboxRowSummary(
      [
        {
          rate_plan_id: 'rp-1',
          date_from: '2026-09-20',
          date_to: '2026-09-22',
          min_stay_arrival: 3,
        },
        { rate_plan_id: 'rp-9', date_from: '2026-09-20', date_to: '2026-09-22', rate: '9100' },
      ],
      names,
    );
    expect(s.roomTypes).toEqual(['Мужской общий номер', 'rp-9']);
    expect(s.messages).toBe(2);
  });
  it('пустой или битый payload — пустая сводка, не исключение', () => {
    expect(outboxRowSummary(null, names)).toEqual({
      dateFrom: null,
      dateTo: null,
      roomTypes: [],
      messages: 0,
    });
    expect(outboxRowSummary([null, 5, 'x'], names).messages).toBe(3);
  });
});
