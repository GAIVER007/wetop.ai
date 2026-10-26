import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { useAccess } from '../auth/provider';
import { Screen } from '../ui/screen';
import { createPendingOrderStore } from './pending-order-storage';
import { OrderSubmission } from './order-submission';
import { OrderProgress } from './order-progress';
import { readOrders } from './data';
import type { OrderPayload } from './pending-order';
export function OrderFlow({
  children,
  onOrders,
}: {
  children: (submit: ((payload: OrderPayload) => void) | undefined) => ReactNode;
  onOrders: () => void;
}) {
  const { session, draft } = useAccess();
  const [controller] = useState(() => {
    const current = session.state;
    if (current.kind !== 'ready') return null;
    try {
      const store = createPendingOrderStore(process.env.EXPO_PUBLIC_MOBILE_API_URL ?? '', {
        userId: current.user.id,
        organizationId: current.user.organizationId,
        businessId: current.branch.location.businessId,
        locationId: current.branch.locationId,
      });
      const isCurrent = () =>
        session.state.kind === 'ready' && session.state.identity === current.identity;
      return new OrderSubmission(
        store,
        async (request) => {
          const result = await session.createOrder(request);
          readOrders({ items: [result], nextCursor: null });
          if (isCurrent() && draft.snapshot().identity === current.identity)
            draft.update({ lines: [], tableId: undefined, guests: 1, notice: '' });
          return result;
        },
        isCurrent,
      );
    } catch {
      return null;
    }
  });
  if (!controller) return children(undefined);
  return (
    <Connected controller={controller} onOrders={onOrders}>
      {children}
    </Connected>
  );
}
function Connected({
  controller,
  children,
  onOrders,
}: {
  controller: OrderSubmission;
  children: (submit: ((payload: OrderPayload) => void) | undefined) => ReactNode;
  onOrders: () => void;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let active = true;
    void controller.restore().then(() => {
      if (active) setRestored(true);
    });
    return () => {
      active = false;
    };
  }, [controller]);
  if (!restored)
    return (
      <Screen title="Проверка заказа">
        <ActivityIndicator accessibilityLabel="Проверка сохранённой отправки" />
      </Screen>
    );
  if (state.kind !== 'idle') return <OrderProgress controller={controller} onOrders={onOrders} />;
  return children((payload) => void controller.submit(payload));
}
