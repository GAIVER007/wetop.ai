import { readOverview, readAnalytics, localDate, weeklyRevenue } from '../src/restaurant/reports';
test('business local date does not shift to device timezone', () =>
  expect(localDate(new Date('2026-10-24T22:30:00Z'), 'Asia/Almaty')).toBe('2026-10-25'));
test('owner reports preserve canonical closed-order revenue separately from payments', () => {
  const day = readOverview({
    date: '2026-10-24',
    currency: 'KZT',
    tiles: {
      tablesOccupied: 3,
      tablesTotal: 8,
      ordersCount: 24,
      revenueMinor: '900719925474099312',
      kitchenQueue: 2,
      kitchenAvgWaitMinutes: 14,
      staffOnShift: 6,
      staffTotal: 9,
    },
    internal: 'drop',
  });
  expect(day.tiles.revenueMinor).toBe('900719925474099312');
  expect(JSON.stringify(day)).not.toContain('drop');
  const period = readAnalytics({
    from: '2026-10-24',
    to: '2026-10-24',
    currency: 'KZT',
    ordersCount: 20,
    revenueMinor: '1200000',
    averageCheckMinor: '60000',
    payments: [{ method: 'CASH', amountMinor: '500000', count: 5 }],
    topDishes: [{ name: 'Кофе', qty: 10, revenueMinor: '120000' }],
    topByStation: {
      KITCHEN: [{ name: 'Паста', qty: 6, revenueMinor: '300000' }],
      BAR: [{ name: 'Кофе', qty: 10, revenueMinor: '120000' }],
    },
    revenueByDay: [{ date: '2026-10-24', revenueMinor: '1200000', orders: 20 }],
    waiters: [
      { waiterId: 'employee-1', name: 'Тестовый сотрудник', orders: 5, revenueMinor: '400000' },
    ],
  });
  expect(period.revenueMinor).toBe('1200000');
  expect(period.payments[0]?.amountMinor).toBe('500000');
  expect(period.topByStation.BAR[0]?.name).toBe('Кофе');
});

test('monthly daily report groups by calendar week without floating-point money', () => {
  expect(
    weeklyRevenue([
      { date: '2026-10-04', revenueMinor: '900719925474099312', orders: 2 },
      { date: '2026-10-05', revenueMinor: '8', orders: 1 },
      { date: '2026-10-06', revenueMinor: '2', orders: 1 },
    ]),
  ).toEqual([
    { from: '2026-10-04', to: '2026-10-04', revenueMinor: '900719925474099312', orders: 2 },
    { from: '2026-10-05', to: '2026-10-06', revenueMinor: '10', orders: 2 },
  ]);
});
