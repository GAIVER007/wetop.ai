import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useAccess } from '../auth/provider';
import { Screen } from '../ui/screen';
import { ActionButton } from '../ui/action-button';
import { useTheme } from '../theme/theme';
import { createPendingPaymentStore } from './pending-payment-storage';
import { PaymentSubmission } from './payment-submission';
import { PaymentScreen } from './payment-screen';
import type { RestaurantOrder } from './contracts';
export function PaymentPanel({
  order,
  onBack,
}: {
  order: RestaurantOrder;
  onBack: (updated?: RestaurantOrder) => void;
}) {
  const { session } = useAccess();
  const theme = useTheme();
  const [controller] = useState(() => {
    const current = session.state;
    if (current.kind !== 'ready' || !['OWNER', 'MANAGER', 'STAFF'].includes(current.user.role))
      return null;
    try {
      const store = createPendingPaymentStore(process.env.EXPO_PUBLIC_MOBILE_API_URL ?? '', {
        userId: current.user.id,
        organizationId: current.user.organizationId,
        businessId: current.branch.location.businessId,
        locationId: current.branch.locationId,
      });
      return new PaymentSubmission(
        store,
        (request) => session.payOrder(request),
        () => session.state.kind === 'ready' && session.state.identity === current.identity,
      );
    } catch {
      return null;
    }
  });
  const loadMethods = useCallback(() => session.readFood('payment-methods'), [session]);
  if (!controller)
    return (
      <Screen title="Приём оплаты недоступен">
        <Text style={{ fontSize: 16, lineHeight: 24, color: theme.text }}>
          Для приёма оплаты нужны права кассира и установленное приложение с защищённым хранилищем.
        </Text>
        <ActionButton secondary label="К заказам" onPress={() => onBack()} />
      </Screen>
    );
  return (
    <PaymentScreen
      order={order}
      controller={controller}
      loadMethods={loadMethods}
      onBack={() => {
        const result = controller.snapshot();
        onBack(
          result.kind === 'confirmed' || result.kind === 'confirmed-pending-cleanup'
            ? result.order
            : undefined,
        );
      }}
    />
  );
}
