import { fireEvent, render, screen } from '@testing-library/react-native';
import { GuestBill } from '../src/restaurant/guest-bill';
import { money } from '../src/restaurant/data';
const order = {
  id: 'order',
  number: 42,
  status: 'SERVED',
  table: { id: 'table', name: 'Стол 4' },
  waiter: null,
  guestCount: 2,
  totalMinor: '10001',
  paidMinor: '2000',
  currency: 'KZT',
  updatedAt: '2026-10-25T12:00:00.000Z',
  delayed: false,
  items: [{ id: 'line', name: 'Кофе', qty: 2, priceMinor: '5000', status: 'SERVED' }],
};
test('shows server totals and exact remainder without recalculating total from lines', async () => {
  const back = jest.fn(),
    refresh = jest.fn();
  await render(<GuestBill order={order} onBack={back} onRefresh={refresh} />);
  expect(screen.getByText('Счёт №42')).toBeTruthy();
  expect(screen.getByText(money('10001', 'KZT'))).toBeTruthy();
  expect(screen.getByText(money('8001', 'KZT'))).toBeTruthy();
  expect(screen.getByText(/Не является фискальным чеком/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Обновить данные заказа' }));
  expect(refresh).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Назад к заказу' }));
  expect(back).toHaveBeenCalledTimes(1);
});
test('keeps large monetary values exact and refuses a cancelled bill', async () => {
  const view = await render(
    <GuestBill
      order={{ ...order, totalMinor: '9007199254740993', paidMinor: '1' }}
      onBack={jest.fn()}
      onRefresh={jest.fn()}
    />,
  );
  expect(screen.getByText(money('9007199254740992', 'KZT'))).toBeTruthy();
  await view.rerender(
    <GuestBill
      order={{ ...order, status: 'CANCELLED' }}
      onBack={jest.fn()}
      onRefresh={jest.fn()}
    />,
  );
  expect(screen.queryByText('К оплате')).toBeNull();
  expect(screen.getByText('Заказ отменён')).toBeTruthy();
});
