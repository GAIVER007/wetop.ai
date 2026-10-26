import { readShifts, readStaffRevenue, teamRows, unlistedRevenue } from '../src/restaurant/team';

test('team joins branch shifts to paid-minus-refunded contribution by stable employee ID', () => {
  const shifts = readShifts({
    employees: [
      {
        id: 'employee-1',
        name: 'Тестовый сотрудник',
        week: [{ weekday: 1, intervals: [{ timeFrom: '09:00', timeTo: '18:00' }] }],
        phone: 'drop',
      },
      { id: 'employee-2', name: 'Другой сотрудник', week: [], phone: 'drop' },
    ],
  });
  const revenue = readStaffRevenue({
    period: 'week',
    fromDate: '2026-10-19',
    toDate: '2026-10-25',
    items: [
      {
        employeeId: 'employee-1',
        currency: 'KZT',
        paidMinor: '100',
        refundedMinor: '150',
        netMinor: '-50',
      },
      { employeeId: null, currency: 'KZT', paidMinor: '25', refundedMinor: '0', netMinor: '25' },
    ],
  });
  expect(teamRows(shifts, revenue).map((row) => [row.name, row.net[0]?.netMinor])).toEqual([
    ['Тестовый сотрудник', '-50'],
    ['Другой сотрудник', undefined],
  ]);
  expect(JSON.stringify(shifts)).not.toContain('drop');
  expect(revenue.items.find((row) => row.employeeId === null)?.netMinor).toBe('25');
});

test('paid contribution from a former shift member is not silently lost', () => {
  const revenue = readStaffRevenue({
    period: 'day',
    fromDate: '2026-10-25',
    toDate: '2026-10-25',
    items: [
      {
        employeeId: 'former',
        currency: 'KZT',
        paidMinor: '100',
        refundedMinor: '25',
        netMinor: '75',
      },
      { employeeId: null, currency: 'KZT', paidMinor: '20', refundedMinor: '0', netMinor: '20' },
    ],
  });
  expect(unlistedRevenue([], revenue)).toEqual([{ currency: 'KZT', netMinor: '75' }]);
});

test('closed-order count joins by employee ID, not by matching names', () => {
  const shifts = readShifts({
    employees: [
      { id: 'a', name: 'Сотрудник', week: [] },
      { id: 'b', name: 'Сотрудник', week: [] },
    ],
  });
  expect(
    teamRows(
      shifts,
      null,
      new Map([
        ['a', 3],
        ['b', 1],
      ]),
    ).map((row) => row.orders),
  ).toEqual([3, 1]);
});
