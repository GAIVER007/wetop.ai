import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { CloseControls } from '../src/restaurant/close-controls';
const order = {
  id: 'order',
  number: 42,
  status: 'SERVED',
  table: null,
  waiter: null,
  guestCount: 1,
  totalMinor: '1000',
  paidMinor: '1000',
  currency: 'KZT',
  updatedAt: '2026-10-25T00:00:00.000Z',
  delayed: false,
  items: [],
};
test('offers closing only for fully paid served orders', async () => {
  for (const change of [
    { status: 'READY' },
    { status: 'CLOSED' },
    { paidMinor: '999' },
    { paidMinor: '1001' },
  ]) {
    const view = await render(
      <CloseControls
        order={{ ...order, ...change }}
        send={jest.fn()}
        onUpdated={jest.fn()}
        onRefresh={jest.fn()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    await view.unmount();
  }
});
test('requires explicit confirmation, prevents double submit and validates closed response', async () => {
  let resolve!: (value: unknown) => void;
  const send = jest.fn(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const updated = jest.fn();
  await render(
    <CloseControls order={order} send={send} onUpdated={updated} onRefresh={jest.fn()} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Закрыть заказ' }));
  expect(send).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Подтвердить закрытие' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Закрываем…' }));
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(order.id, order.updatedAt);
  const closed = { ...order, status: 'CLOSED' };
  await act(async () => resolve(closed));
  expect(updated).toHaveBeenCalledWith(closed);
});
test('unknown or mismatched confirmation allows only refreshing, never automatic retry', async () => {
  const send = jest.fn().mockResolvedValue({ ...order, id: 'another', status: 'CLOSED' });
  const refresh = jest.fn();
  const updated = jest.fn();
  await render(<CloseControls order={order} send={send} onUpdated={updated} onRefresh={refresh} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Закрыть заказ' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Подтвердить закрытие' }));
  expect(updated).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Подтвердить закрытие' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Обновить заказ' }));
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledTimes(1);
});
