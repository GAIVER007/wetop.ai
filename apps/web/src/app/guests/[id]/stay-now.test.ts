import { describe, expect, it } from 'vitest';
import { stayNow } from './stay-now';

const stay = (over: Partial<Parameters<typeof stayNow>[0][number]>) => ({
  confirmationNumber: 'X',
  accommodationTypeName: 'Номер',
  arrivalDate: '2026-09-20',
  departureDate: '2026-09-23',
  status: 'CONFIRMED',
  unitCode: 'R01',
  ...over,
});

describe('stayNow — где гость сейчас, одной фразой (D1)', () => {
  it('живёт: заселённое проживание главнее остальных', () => {
    expect(
      stayNow(
        [
          stay({ status: 'CHECKED_OUT', departureDate: '2026-09-10' }),
          stay({ status: 'CHECKED_IN' }),
        ],
        '2026-09-21',
      ),
    ).toBe('живёт, R01, выезд 23.09.2026');
  });
  it('ожидается: ближайшее подтверждённое, сегодняшний заезд — словом', () => {
    expect(
      stayNow(
        [stay({ arrivalDate: '2026-09-25', departureDate: '2026-09-27' }), stay({})],
        '2026-09-20',
      ),
    ).toBe('ожидается сегодня, R01');
    expect(
      stayNow(
        [stay({ arrivalDate: '2026-09-25', departureDate: '2026-09-27', unitCode: null })],
        '2026-09-20',
      ),
    ).toBe('ожидается 25.09.2026');
  });
  it('выехал: последний выезд; без истории — прочерк', () => {
    expect(
      stayNow(
        [
          stay({ status: 'CHECKED_OUT', departureDate: '2026-09-10' }),
          stay({ status: 'CHECKED_OUT', departureDate: '2026-09-15' }),
          stay({ status: 'CANCELLED' }),
        ],
        '2026-09-20',
      ),
    ).toBe('выехал 15.09.2026');
    expect(stayNow([], '2026-09-20')).toBe('—');
  });
});
