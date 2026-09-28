import { describe, expect, it } from 'vitest';
import { unitNow } from './unit-now';

const stay = (startDate: string, endDate: string, status = 'CONFIRMED', n = startDate) => ({
  confirmationNumber: `B-${n}`,
  startDate,
  endDate,
  status,
  guestLabel: 'Гость Тестовый',
});

describe('панель места: что с ним сейчас и какое проживание следующее (ADR-107, I2)', () => {
  it('свободно и без будущих проживаний', () => {
    expect(unitNow([], '2026-09-28')).toEqual({ current: null, next: null });
  });

  it('живущий сейчас — текущее проживание; выезд сегодня уже не держит место', () => {
    const living = stay('2026-09-26', '2026-09-30', 'CHECKED_IN');
    expect(unitNow([living], '2026-09-28').current).toBe(living);
    // ночь выезда в срок не входит: 30.09 место свободно
    expect(unitNow([living], '2026-09-30').current).toBeNull();
  });

  it('заезд сегодня без заселения — тоже текущее: место на эту ночь занято', () => {
    const arriving = stay('2026-09-28', '2026-09-29');
    expect(unitNow([arriving], '2026-09-28')).toEqual({ current: arriving, next: null });
  });

  it('выселенный раньше срока место не держит', () => {
    const gone = stay('2026-09-26', '2026-09-30', 'CHECKED_OUT');
    expect(unitNow([gone], '2026-09-28').current).toBeNull();
  });

  it('следующее — ближайшее из будущих, в каком бы порядке ни пришли', () => {
    const later = stay('2026-10-10', '2026-10-12');
    const sooner = stay('2026-10-01', '2026-10-03');
    const living = stay('2026-09-27', '2026-09-29', 'CHECKED_IN');
    expect(unitNow([later, living, sooner], '2026-09-28')).toEqual({
      current: living,
      next: sooner,
    });
  });
});
