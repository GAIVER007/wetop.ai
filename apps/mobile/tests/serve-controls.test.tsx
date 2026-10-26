import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ServeControls } from '../src/restaurant/serve-controls';
const order = {
  id: 'order',
  number: 42,
  status: 'READY',
  table: null,
  waiter: null,
  guestCount: 1,
  totalMinor: '1000',
  paidMinor: '0',
  currency: 'KZT',
  updatedAt: '2026-10-25T00:00:00.000Z',
  delayed: false,
  items: [
    { id: 'item', name: 'Кофе', qty: 1, priceMinor: '1000', status: 'READY', station: 'BAR' },
  ],
};
test('sends exact item and version, then requires fresh data after uncertain result', async () => {
  const send = jest.fn().mockRejectedValue(new Error('lost'));
  const refresh = jest.fn();
  await render(
    <ServeControls order={order} send={send} onUpdated={jest.fn()} onRefresh={refresh} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Подано: Кофе' }));
  expect(send).toHaveBeenCalledWith('order', 'item', order.updatedAt);
  expect(screen.queryByRole('button', { name: 'Подано: Кофе' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Обновить заказ' }));
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledTimes(1);
});
test('does not offer serving for cooking or completed orders', async () => {
  const view = await render(
    <ServeControls
      order={{ ...order, status: 'CLOSED' }}
      send={jest.fn()}
      onUpdated={jest.fn()}
      onRefresh={jest.fn()}
    />,
  );
  expect(screen.queryByRole('button')).toBeNull();
  await view.rerender(
    <ServeControls
      order={{ ...order, items: [{ ...order.items[0]!, status: 'COOKING' }] }}
      send={jest.fn()}
      onUpdated={jest.fn()}
      onRefresh={jest.fn()}
    />,
  );
  expect(screen.queryByRole('button')).toBeNull();
});

test('double taps make one request and only matching served response updates the order', async () => {
  let resolve!: (value: unknown) => void;
  const send = jest.fn(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const updated = jest.fn();
  await render(
    <ServeControls order={order} send={send} onUpdated={updated} onRefresh={jest.fn()} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Подано: Кофе' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Сохраняем подачу…' }));
  expect(send).toHaveBeenCalledTimes(1);
  const next = {
    ...order,
    updatedAt: '2026-10-25T00:01:00.000Z',
    items: [{ ...order.items[0]!, status: 'SERVED' }],
  };
  await act(async () => resolve(next));
  expect(updated).toHaveBeenCalledWith(next);
});
