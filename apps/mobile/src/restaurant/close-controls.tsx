import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton } from '../ui/action-button';
import { useTheme } from '../theme/theme';
import { readOrders } from './data';
import type { RestaurantOrder } from './contracts';
export function CloseControls({
  order,
  send,
  onUpdated,
  onRefresh,
}: {
  order: RestaurantOrder;
  send: (orderId: string, expectedUpdatedAt: string) => Promise<unknown>;
  onUpdated: (order: RestaurantOrder) => void;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const locked = useRef(false);
  const [stage, setStage] = useState<'idle' | 'confirm' | 'sending' | 'unknown' | 'done'>('idle');
  if (order.status !== 'SERVED' || BigInt(order.paidMinor) !== BigInt(order.totalMinor))
    return null;
  if (stage === 'done') return null;
  if (stage === 'unknown')
    return (
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="alert" style={{ color: theme.text, fontSize: 16, lineHeight: 24 }}>
          Закрытие не подтверждено. Обновите заказ и проверьте его статус.
        </Text>
        <ActionButton label="Обновить заказ" onPress={onRefresh} />
      </View>
    );
  if (stage === 'idle')
    return <ActionButton label="Закрыть заказ" onPress={() => setStage('confirm')} />;
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: theme.text, fontSize: 16, lineHeight: 24 }}>
        Заказ полностью оплачен и подан. Подтвердите завершение обслуживания.
      </Text>
      <ActionButton
        label={stage === 'sending' ? 'Закрываем…' : 'Подтвердить закрытие'}
        disabled={stage === 'sending'}
        onPress={() => {
          if (locked.current) return;
          locked.current = true;
          setStage('sending');
          void (async () => {
            try {
              const result = readOrders({
                items: [await send(order.id, order.updatedAt)],
                nextCursor: null,
              }).items[0]!;
              if (
                result.id !== order.id ||
                result.status !== 'CLOSED' ||
                result.currency !== order.currency ||
                BigInt(result.paidMinor) !== BigInt(result.totalMinor)
              )
                throw new Error('Invalid closing confirmation');
              setStage('done');
              onUpdated(result);
            } catch {
              setStage('unknown');
            }
          })();
        }}
      />
      <ActionButton
        secondary
        label="Отмена"
        disabled={stage === 'sending'}
        onPress={() => setStage('idle')}
      />
    </View>
  );
}
