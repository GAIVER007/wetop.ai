import { DraftReview } from '../src/restaurant/draft-screens';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { OrderSubmission } from '../src/restaurant/order-submission';
import { OrderProgress } from '../src/restaurant/order-progress';
const attempt = {
  context: 'one',
  request: {
    creationRequestKey: 'key',
    tableId: null,
    guestCount: 2,
    items: [{ menuItemId: 'item', qty: 2, modifierIds: [] }],
  },
};
const order = {
  id: 'order',
  number: 42,
  status: 'NEW',
  table: null,
  waiter: null,
  guestCount: 2,
  totalMinor: '240000',
  paidMinor: '0',
  currency: 'KZT',
  updatedAt: '2026-10-25T00:00:00Z',
  delayed: false,
  items: [],
};
test('restored attempt requires explicit retry, then displays server confirmation', async () => {
  const send = jest.fn().mockResolvedValue(order);
  const store = {
    read: jest.fn().mockResolvedValue(attempt),
    prepare: jest.fn(),
    acknowledge: jest.fn(),
  };
  const controller = new OrderSubmission(store, send, () => true);
  await controller.restore();
  await render(<OrderProgress controller={controller} onOrders={jest.fn()} />);
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByText(/Сохранён незавершённый заказ/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Повторить отправку этого заказа' }));
  expect(send).toHaveBeenCalledWith(attempt.request);
  expect(screen.getByText('Заказ №42 создан')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Повторить отправку этого заказа' })).toBeNull();
});
test('lost response explains uncertainty and offers only original request retry', async () => {
  const controller = new OrderSubmission(
    {
      read: jest.fn().mockResolvedValue(attempt),
      prepare: jest.fn().mockResolvedValue(attempt),
      acknowledge: jest.fn(),
    },
    jest.fn().mockRejectedValue(new Error('offline')),
    () => true,
  );
  await controller.submit(attempt.request);
  await render(<OrderProgress controller={controller} onOrders={jest.fn()} />);
  expect(screen.getByText(/Сервер мог принять заказ/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Новый заказ' })).toBeNull();
});

test('draft review requires destination and acknowledges menu changes before sending', async () => {
  const submit = jest.fn();
  const props = {
    notice: '',
    acknowledge: jest.fn(),
    lines: [
      {
        key: 'line',
        item: {
          id: 'menu-item',
          categoryId: 'category',
          name: 'Кофе',
          priceMinor: '100000',
          currency: 'KZT',
          active: true,
          photoUrl: null,
          modifierGroups: [],
        },
        qty: 2,
        unitMinor: '100000',
        modifierIds: [],
        notes: 'Без сахара',
      },
    ],
    setLines: jest.fn(),
    tables: [],
    tableId: undefined as string | null | undefined,
    setTableId: jest.fn(),
    guests: 1,
    setGuests: jest.fn(),
    onBack: jest.fn(),
    onSubmit: submit,
  };
  const view = await render(<DraftReview {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Отправить заказ' }));
  expect(submit).not.toHaveBeenCalled();
  await view.rerender(<DraftReview {...props} tableId={null} notice="Цена изменилась" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Отправить заказ' }));
  expect(submit).not.toHaveBeenCalled();
  await view.rerender(<DraftReview {...props} tableId={null} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Отправить заказ' }));
  expect(submit).toHaveBeenCalledWith({
    tableId: null,
    guestCount: 1,
    items: [{ menuItemId: 'menu-item', qty: 2, notes: 'Без сахара', modifierIds: [] }],
  });
});
