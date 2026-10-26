import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaymentScreen } from '../src/restaurant/payment-screen';
import { PaymentSubmission } from '../src/restaurant/payment-submission';
const order = {
  id: 'order',
  number: 42,
  status: 'SERVED',
  table: null,
  waiter: null,
  guestCount: 1,
  totalMinor: '10000',
  paidMinor: '2000',
  currency: 'KZT',
  updatedAt: '2026-10-25T00:00:00Z',
  delayed: false,
  items: [],
};
function fixture() {
  const store = {
    read: jest.fn().mockResolvedValue(null),
    prepare: jest.fn(async (input) => ({
      context: 'one',
      currency: input.currency,
      request: {
        orderId: input.orderId,
        amount: input.amount,
        method: input.method,
        idempotencyKey: 'key',
      },
    })),
    acknowledge: jest.fn(),
  };
  const send = jest.fn().mockResolvedValue({ ...order, status: 'CLOSED', paidMinor: '10000' });
  return { store, send, controller: new PaymentSubmission(store, send, () => true) };
}
test('form offers actual methods, requires review and confirms one exact payment', async () => {
  const f = fixture();
  await render(
    <PaymentScreen
      order={order}
      controller={f.controller}
      loadMethods={async () => ({
        methods: [
          { method: 'CASH', enabled: true, sortOrder: 0 },
          { method: 'KASPI', enabled: false, sortOrder: 1 },
        ],
      })}
      onBack={jest.fn()}
    />,
  );
  expect(await screen.findByText('Наличные')).toBeTruthy();
  expect(screen.queryByText('Kaspi')).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'Наличные' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Проверить оплату' }));
  expect(f.send).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Подтвердить оплату' }));
  expect(await screen.findByText('Оплата подтверждена')).toBeTruthy();
  expect(f.send).toHaveBeenCalledWith({
    orderId: 'order',
    amount: 8000,
    method: 'CASH',
    idempotencyKey: 'key',
  });
  expect(screen.getByText('Заказ закрыт')).toBeTruthy();
});
test('restored payment blocks new form and requires explicit retry', async () => {
  const f = fixture();
  f.store.read.mockResolvedValue({
    context: 'one',
    currency: 'KZT',
    request: { orderId: 'other', amount: 500, method: 'CASH', idempotencyKey: 'old' },
  } as never);
  await render(
    <PaymentScreen
      order={order}
      controller={f.controller}
      loadMethods={jest.fn()}
      onBack={jest.fn()}
    />,
  );
  expect(await screen.findByText(/Сохранён платёж другого заказа/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Проверить оплату' })).toBeNull();
  expect(f.send).not.toHaveBeenCalled();
});
