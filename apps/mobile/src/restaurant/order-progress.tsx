import { useSyncExternalStore } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { Screen } from '../ui/screen';
import { ActionButton } from '../ui/action-button';
import { useTheme } from '../theme/theme';
import { money } from './data';
import type { OrderSubmission } from './order-submission';
export function OrderProgress({
  controller,
  onOrders,
}: {
  controller: OrderSubmission;
  onOrders: () => void;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const theme = useTheme();
  const text = { fontSize: 16, lineHeight: 24, color: theme.text };
  if (state.kind === 'confirmed' || state.kind === 'confirmed-pending-cleanup')
    return (
      <Screen title={`Заказ №${state.order.number} создан`} subtitle="Подтверждено сервером">
        <Text style={text}>
          {state.order.table?.name ?? 'Заказ со стойки'} · гостей: {state.order.guestCount}
        </Text>
        <Text style={{ ...text, fontSize: 28, fontWeight: '700' }}>
          {money(state.order.totalMinor, state.order.currency)}
        </Text>
        {state.order.items.map((item) => (
          <Text key={item.id} style={text}>
            {item.qty} × {item.name}
          </Text>
        ))}
        {state.kind === 'confirmed-pending-cleanup' ? (
          <>
            <Text style={text}>
              Заказ уже создан. Осталось завершить сохранение на устройстве. Повторно отправлять
              заказ не нужно.
            </Text>
            <ActionButton
              label="Завершить на устройстве"
              onPress={() => void controller.finish()}
            />
          </>
        ) : null}
        <ActionButton
          label="К столам и заказам"
          onPress={onOrders}
          secondary={state.kind !== 'confirmed'}
        />
      </Screen>
    );
  const pending = state.kind === 'pending' || state.kind === 'unknown';
  return (
    <Screen title={pending ? 'Проверка отправки' : 'Отправка заказа'}>
      {state.kind === 'saving' || state.kind === 'sending' ? (
        <>
          <ActivityIndicator accessibilityLabel="Отправка заказа" color={theme.primary} />
          <Text accessibilityLiveRegion="polite" style={text}>
            {state.kind === 'saving'
              ? 'Проверяем сохранённый заказ…'
              : 'Отправляем заказ. Дождитесь подтверждения…'}
          </Text>
        </>
      ) : null}
      {pending ? (
        <>
          <Text accessibilityRole="alert" style={text}>
            {state.kind === 'pending'
              ? 'Сохранён незавершённый заказ. Проверьте его отправку, прежде чем создавать следующий.'
              : 'Ответ не получен. Сервер мог принять заказ. Повторите отправку этого же заказа, чтобы получить подтверждение без дубля.'}
          </Text>
          <Text style={text}>
            {state.attempt.request.tableId ? 'Заказ за столом' : 'Заказ со стойки'} · гостей:{' '}
            {state.attempt.request.guestCount} · позиций:{' '}
            {state.attempt.request.items.reduce((sum, item) => sum + item.qty, 0)}
          </Text>
          <ActionButton
            label="Повторить отправку этого заказа"
            onPress={() => void controller.retry()}
          />
        </>
      ) : null}
      {state.kind === 'storage-error' ? (
        <>
          <Text accessibilityRole="alert" style={text}>
            Не удалось проверить сохранённый заказ. Отправка заблокирована, чтобы не создать дубль.
            Разблокируйте устройство и повторите проверку. Если ошибка сохраняется, обратитесь к
            администратору.
          </Text>
          <ActionButton
            label="Проверить сохранённый заказ"
            onPress={() => void controller.restore()}
          />
        </>
      ) : null}
      {state.kind === 'context-changed' ? (
        <Text style={text}>
          Доступ изменился. Вернитесь к рабочему месту и проверьте выбранный филиал.
        </Text>
      ) : null}
      <ActionButton secondary label="К столам и заказам" onPress={onOrders} />
    </Screen>
  );
}
