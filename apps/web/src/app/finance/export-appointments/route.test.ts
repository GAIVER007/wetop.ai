import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ financePeriod: vi.fn(), day: vi.fn() }));
vi.mock('../../../lib/api', () => ({ beautyApi: { financePeriod: m.financePeriod, day: m.day } }));

import { GET } from './route';

const row = (id: string, localDate: string, startMinutes: number) => ({
  id,
  localDate,
  employeeId: 'emp-1',
  serviceId: 'svc-1',
  serviceName: 'Стрижка',
  customer: { id: 'cus-1', name: 'Клиент', phone: null },
  startsAt: `${localDate}T05:00:00.000Z`,
  endsAt: `${localDate}T06:00:00.000Z`,
  startMinutes,
  endMinutes: startMinutes + 60,
  status: 'DONE' as const,
  next: [],
  priceMinor: '800000',
  paidMinor: '800000',
  refundedMinor: '0',
  currency: 'KZT',
  notes: null,
  items: [
    {
      id: `${id}-line`,
      position: 0,
      employeeId: 'emp-1',
      employeeName: 'Мастер Дина',
      serviceId: 'svc-1',
      serviceName: 'Стрижка',
      startsAt: `${localDate}T05:00:00.000Z`,
      endsAt: `${localDate}T06:00:00.000Z`,
      startMinutes,
      endMinutes: startMinutes + 60,
      durationMinutes: 60,
      basePriceMinor: '800000',
      discountMinor: '0',
      surchargeMinor: '0',
      priceMinor: '800000',
    },
  ],
});

beforeEach(() => {
  vi.resetAllMocks();
  m.financePeriod.mockResolvedValue({
    location: { id: 'loc-1', name: 'Салон', timezone: 'Asia/Almaty', currency: 'KZT' },
    period: { from: '2026-10-14', to: '2026-10-15' },
    appointments: [row('a2', '2026-10-15', 600), row('a1', '2026-10-14', 540)],
  });
});

describe('выгрузка записей идёт финансовой проекцией, а не журналом', () => {
  it('один запрос периода вместо запроса на каждый день; дни в CSV по local start day', async () => {
    const res = await GET(new Request('http://test/finance/export-appointments?from=2026-10-14&to=2026-10-15'));
    expect(res.status).toBe(200);
    expect(m.financePeriod).toHaveBeenCalledExactlyOnceWith('2026-10-14', '2026-10-15');
    expect(m.day).not.toHaveBeenCalled();
    const csv = await res.text();
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('14.10.2026');
    expect(lines[1]).toContain('Мастер Дина');
    expect(lines[2]).toContain('15.10.2026');
  });
  it('период длиннее месяца по-прежнему отклоняется до запроса', async () => {
    const res = await GET(new Request('http://test/x?from=2026-01-01&to=2026-03-01'));
    expect(res.status).toBe(422);
    expect(m.financePeriod).not.toHaveBeenCalled();
  });
});
