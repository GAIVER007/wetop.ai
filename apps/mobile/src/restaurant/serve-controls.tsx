import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton } from '../ui/action-button';
import { useTheme } from '../theme/theme';
import { readOrders } from './data';
import type { RestaurantOrder } from './contracts';
export function ServeControls({
  order,
  send,
  onUpdated,
  onRefresh,
}: {
  order: RestaurantOrder;
  send: (orderId: string, itemId: string, expectedUpdatedAt: string) => Promise<unknown>;
  onUpdated: (order: RestaurantOrder) => void;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  if (order.status === 'CLOSED' || order.status === 'CANCELLED') return null;
  if (uncertain)
    return (
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="alert" style={{ fontSize: 16, lineHeight: 24, color: theme.text }}>
          Не удалось подтвердить подачу. Обновите заказ и проверьте статус позиции перед следующим
          действием.
        </Text>
        <ActionButton label="Обновить заказ" onPress={onRefresh} />
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      {order.items
        .filter((item) => item.status === 'READY')
        .map((item) => (
          <ActionButton
            key={item.id}
            label={busy ? 'Сохраняем подачу…' : `Подано: ${item.name}`}
            disabled={busy}
            onPress={() => {
              if (locked.current) return;
              locked.current = true;
              setBusy(true);
              void (async () => {
                try {
                  const result = readOrders({
                    items: [await send(order.id, item.id, order.updatedAt)],
                    nextCursor: null,
                  }).items[0]!;
                  if (
                    result.id !== order.id ||
                    result.items.find((line) => line.id === item.id)?.status !== 'SERVED'
                  )
                    throw new Error('Invalid serving confirmation');
                  onUpdated(result);
                } catch {
                  setUncertain(true);
                } finally {
                  setBusy(false);
                }
              })();
            }}
          />
        ))}
    </View>
  );
}
