import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { OrderFlow } from '../src/restaurant/order-flow';
import { useAccess } from '../src/auth/provider';
import { createPendingOrderStore } from '../src/restaurant/pending-order-storage';
import { DraftStore } from '../src/restaurant/draft-store';
import { ActionButton } from '../src/ui/action-button';
jest.mock('../src/auth/provider', () => ({ useAccess: jest.fn() }));
jest.mock('../src/restaurant/pending-order-storage', () => ({
  createPendingOrderStore: jest.fn(),
}));
const payload = {
  tableId: null,
  guestCount: 1,
  items: [{ menuItemId: 'item', qty: 1, modifierIds: [] }],
};
const order = {
  id: 'order',
  number: 42,
  status: 'NEW',
  table: null,
  waiter: null,
  guestCount: 1,
  totalMinor: '240000',
  paidMinor: '0',
  currency: 'KZT',
  updatedAt: '2026-10-25T00:00:00Z',
  delayed: false,
  items: [],
};
function setup(result: unknown) {
  const draft = new DraftStore();
  draft.bind('identity');
  draft.update({ guests: 3, notice: 'fixture' });
  const createOrder = jest.fn().mockResolvedValue(result);
  const store = {
    read: jest.fn().mockResolvedValue(null),
    prepare: jest
      .fn()
      .mockResolvedValue({ context: 'one', request: { ...payload, creationRequestKey: 'key' } }),
    acknowledge: jest.fn(),
  };
  jest
    .mocked(createPendingOrderStore)
    .mockReturnValue(store as unknown as ReturnType<typeof createPendingOrderStore>);
  jest
    .mocked(useAccess)
    .mockReturnValue({
      draft,
      session: {
        state: {
          kind: 'ready',
          identity: 'identity',
          user: { id: 'user', organizationId: 'org' },
          branch: { locationId: 'location', location: { businessId: 'business' } },
        },
        createOrder,
      },
    } as unknown as ReturnType<typeof useAccess>);
  return { draft, createOrder, store };
}
test('confirmed send clears original draft before local attempt is acknowledged', async () => {
  const f = setup(order);
  f.store.acknowledge.mockImplementation(async () => {
    expect(f.draft.snapshot().guests).toBe(1);
    expect(f.draft.snapshot().notice).toBe('');
  });
  await render(
    <OrderFlow onOrders={jest.fn()}>
      {(submit) =>
        submit ? (
          <ActionButton label="Отправить" onPress={() => submit(payload)} />
        ) : (
          <Text>Preview</Text>
        )
      }
    </OrderFlow>,
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Отправить' }));
  expect(await screen.findByText('Заказ №42 создан')).toBeTruthy();
  expect(f.createOrder).toHaveBeenCalledTimes(1);
  expect(f.store.acknowledge).toHaveBeenCalledWith('key');
});
test('unverified server reply retains draft and persisted attempt', async () => {
  const f = setup({ broken: true });
  await render(
    <OrderFlow onOrders={jest.fn()}>
      {(submit) =>
        submit ? (
          <ActionButton label="Отправить" onPress={() => submit(payload)} />
        ) : (
          <Text>Preview</Text>
        )
      }
    </OrderFlow>,
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Отправить' }));
  expect(await screen.findByText(/Сервер мог принять заказ/)).toBeTruthy();
  expect(f.draft.snapshot().guests).toBe(3);
  expect(f.store.acknowledge).not.toHaveBeenCalled();
});
