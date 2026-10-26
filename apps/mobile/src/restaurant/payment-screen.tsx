import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Screen } from '../ui/screen';
import { FormField } from '../ui/form-field';
import { ActionButton } from '../ui/action-button';
import { useTheme } from '../theme/theme';
import { accessMessage } from '../auth/session';
import { money } from './data';
import { paymentAmount, readPaymentMethods, type PaymentMethod } from './payment-input';
import type { RestaurantOrder } from './contracts';
import type { PaymentSubmission } from './payment-submission';
const labels: Record<PaymentMethod, string> = {
  CASH: 'Наличные',
  CARD_TERMINAL: 'Карта через терминал',
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: 'Перевод физлица',
  BANK_TRANSFER_LEGAL: 'Перевод юрлица',
  OTHER: 'Другое',
};
export function PaymentScreen({
  order,
  controller,
  loadMethods,
  onBack,
}: {
  order: RestaurantOrder;
  controller: PaymentSubmission;
  loadMethods: () => Promise<unknown>;
  onBack: () => void;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const theme = useTheme();
  const text = { fontSize: 16, lineHeight: 24, color: theme.text };
  const due = BigInt(order.totalMinor) - BigInt(order.paidMinor);
  const [amount, setAmount] = useState(() =>
    due > 0n ? `${due / 100n}.${(due % 100n).toString().padStart(2, '0')}` : '0.00',
  );
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [review, setReview] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    setMethod(null);
    setReview(null);
    void (async () => {
      try {
        await controller.restore();
        if (controller.snapshot().kind === 'idle') {
          const next = readPaymentMethods(await loadMethods());
          if (active) setMethods(next);
        }
      } catch (e) {
        if (active) setLoadError(accessMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [controller, loadMethods, reload]);
  const back = <ActionButton secondary label="К заказам" onPress={onBack} />;
  if (loading || state.kind === 'saving' || state.kind === 'sending')
    return (
      <Screen title="Оплата заказа">
        <ActivityIndicator accessibilityLabel="Обработка оплаты" />
        <Text style={text}>
          {state.kind === 'sending'
            ? 'Отправляем платёж. Дождитесь подтверждения.'
            : 'Проверяем сохранённый платёж и доступ.'}
        </Text>
        {back}
      </Screen>
    );
  if (state.kind === 'confirmed' || state.kind === 'confirmed-pending-cleanup')
    return (
      <Screen title="Оплата подтверждена" subtitle={`Заказ №${state.order.number}`}>
        <Text style={{ ...text, fontSize: 28, fontWeight: '700' }}>
          {money(String(state.attempt.request.amount), state.attempt.currency)}
        </Text>
        <Text style={text}>{labels[state.attempt.request.method]}</Text>
        <Text style={text}>
          {state.order.status === 'CLOSED' ? 'Заказ закрыт' : 'Заказ остаётся открытым'}
        </Text>
        <Text style={text}>
          Всего оплачено: {money(state.order.paidMinor, state.order.currency)}
        </Text>
        {state.kind === 'confirmed-pending-cleanup' ? (
          <>
            <Text style={text}>Платёж принят. Осталось завершить сохранение на устройстве.</Text>
            <ActionButton
              label="Завершить на устройстве"
              onPress={() => void controller.finish()}
            />
          </>
        ) : null}
        <Text style={{ ...text, color: theme.secondary }}>
          Это подтверждение учёта оплаты, не фискальный чек.
        </Text>
        {back}
      </Screen>
    );
  if (state.kind === 'pending' || state.kind === 'unknown')
    return (
      <Screen title="Проверка платежа">
        <Text accessibilityRole="alert" style={text}>
          {state.attempt.request.orderId !== order.id
            ? 'Сохранён платёж другого заказа. Сначала подтвердите его результат.'
            : state.kind === 'unknown'
              ? 'Ответ не получен. Платёж мог быть принят. Повторяйте только исходный платёж.'
              : 'Есть сохранённый платёж без подтверждения. Проверьте его результат.'}
        </Text>
        <Text style={text}>
          {money(String(state.attempt.request.amount), state.attempt.currency)} ·{' '}
          {labels[state.attempt.request.method]}
        </Text>
        <ActionButton label="Повторить исходный платёж" onPress={() => void controller.retry()} />
        {back}
      </Screen>
    );
  if (state.kind === 'storage-error' || state.kind === 'context-changed')
    return (
      <Screen title="Оплата приостановлена">
        <Text accessibilityRole="alert" style={text}>
          {state.kind === 'storage-error'
            ? 'Не удалось проверить сохранённый платёж. Разблокируйте устройство и повторите проверку. Если ошибка сохраняется, обратитесь к администратору.'
            : 'Доступ изменился. Вернитесь к рабочему месту.'}
        </Text>
        {state.kind === 'storage-error' ? (
          <ActionButton
            label="Проверить сохранённый платёж"
            onPress={() => setReload((v) => v + 1)}
          />
        ) : null}
        {back}
      </Screen>
    );
  if (loadError)
    return (
      <Screen title="Оплата недоступна">
        <Text accessibilityRole="alert" style={text}>
          {loadError}
        </Text>
        <ActionButton label="Повторить загрузку" onPress={() => setReload((v) => v + 1)} />
        {back}
      </Screen>
    );
  if (due <= 0n || order.status === 'CLOSED' || order.status === 'CANCELLED')
    return (
      <Screen title="Оплата не требуется">
        <Text style={text}>Обновите заказ, чтобы проверить его текущее состояние.</Text>
        {back}
      </Screen>
    );
  if (review !== null && method)
    return (
      <Screen title="Проверьте оплату" subtitle={`Заказ №${order.number}`}>
        <Text style={{ ...text, fontSize: 28, fontWeight: '700' }}>
          {money(String(review), order.currency)}
        </Text>
        <Text style={text}>{labels[method]}</Text>
        <Text style={text}>
          Подтвердите только после фактического получения денег. Приложение учитывает оплату, но не
          списывает деньги с карты.
        </Text>
        <ActionButton
          label="Подтвердить оплату"
          onPress={() =>
            void controller.submit({
              orderId: order.id,
              amount: review,
              method,
              currency: order.currency,
            })
          }
        />
        <ActionButton secondary label="Изменить" onPress={() => setReview(null)} />
        {back}
      </Screen>
    );
  return (
    <Screen
      title={`Оплата заказа №${order.number}`}
      subtitle={order.table?.name ?? 'Заказ со стойки'}
    >
      <View style={{ padding: 16, gap: 8, borderRadius: 16, backgroundColor: theme.surface }}>
        <Text style={text}>Сумма заказа: {money(order.totalMinor, order.currency)}</Text>
        <Text style={text}>Оплачено: {money(order.paidMinor, order.currency)}</Text>
        <Text style={{ ...text, fontWeight: '700' }}>
          Осталось: {money(due.toString(), order.currency)}
        </Text>
      </View>
      <FormField
        label="Сумма оплаты"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={(value) => {
          setAmount(value);
          setError('');
        }}
        error={error}
      />
      <Text style={text}>Способ оплаты</Text>
      {methods.map((value) => (
        <Pressable
          key={value}
          accessibilityRole="radio"
          accessibilityLabel={labels[value]}
          accessibilityState={{ checked: method === value }}
          onPress={() => setMethod(value)}
          style={{
            padding: 16,
            minHeight: 48,
            borderRadius: 12,
            backgroundColor: method === value ? theme.primary : theme.surface,
          }}
        >
          <Text style={{ ...text, color: method === value ? theme.onPrimary : theme.text }}>
            {labels[value]}
          </Text>
        </Pressable>
      ))}
      {!methods.length ? (
        <Text style={text}>
          В филиале нет включённых способов оплаты. Обратитесь к управляющему.
        </Text>
      ) : null}
      <ActionButton
        label="Проверить оплату"
        disabled={!method}
        onPress={() => {
          try {
            setReview(paymentAmount(amount, due.toString()));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Проверьте сумму.');
          }
        }}
      />
      {back}
    </Screen>
  );
}
