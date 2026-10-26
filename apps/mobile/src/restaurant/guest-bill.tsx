import { Text, View } from 'react-native';
import { Screen } from '../ui/screen';
import { ActionButton } from '../ui/action-button';
import { useTheme } from '../theme/theme';
import { money } from './data';
import type { RestaurantOrder } from './contracts';

export function GuestBill({
  order,
  onBack,
  onRefresh,
}: {
  order: RestaurantOrder;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const label = { color: theme.secondary, fontSize: 16, lineHeight: 24 } as const;
  const value = {
    color: theme.text,
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  } as const;
  const due = BigInt(order.totalMinor) - BigInt(order.paidMinor);
  const cancelled = order.status === 'CANCELLED';
  const updated = new Date(order.updatedAt);
  return (
    <Screen
      title={`Счёт №${order.number}`}
      subtitle={`${order.table?.name ?? 'Заказ со стойки'} · Гостей: ${order.guestCount}`}
    >
      <ActionButton secondary label="Назад к заказу" onPress={onBack} />
      {cancelled ? (
        <Text accessibilityRole="alert" style={label}>
          Заказ отменён
        </Text>
      ) : (
        <>
          <View style={{ padding: 20, gap: 20, borderRadius: 16, backgroundColor: theme.surface }}>
            {order.items.map((item) => (
              <View key={item.id} style={{ gap: 4 }}>
                <Text
                  style={{ color: theme.text, fontSize: 17, fontWeight: '600', lineHeight: 25 }}
                >
                  {item.name}
                </Text>
                <Text style={label}>
                  {item.qty} × {money(item.priceMinor, order.currency)}
                </Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: theme.secondary, opacity: 0.25 }} />
            {[
              ['Итого', order.totalMinor],
              ['Оплачено', order.paidMinor],
              ...(due >= 0n ? [['К оплате', due.toString()]] : []),
            ].map(([name, amount]) => (
              <View
                key={name}
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 8,
                }}
              >
                <Text style={label}>{name}</Text>
                <Text style={value}>{money(amount!, order.currency)}</Text>
              </View>
            ))}
            {due < 0n ? (
              <Text accessibilityRole="alert" style={label}>
                Суммы изменились. Обновите заказ перед расчётом.
              </Text>
            ) : null}
          </View>
          <Text style={label}>
            Не является фискальным чеком. Показаны последние загруженные данные заказа.
          </Text>
          {Number.isFinite(updated.getTime()) ? (
            <Text style={label}>Изменён: {updated.toLocaleString('ru-RU')}</Text>
          ) : null}
        </>
      )}
      <ActionButton secondary label="Обновить данные заказа" onPress={onRefresh} />
    </Screen>
  );
}
