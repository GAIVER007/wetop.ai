import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAccess } from '../auth/provider';
import { accessMessage } from '../auth/session';
import { ActionButton } from '../ui/action-button';
import { Screen } from '../ui/screen';
import { useTheme } from '../theme/theme';
import { money, readOrders, readTables } from '../restaurant/data';
import type { RestaurantOrder, RestaurantTable } from '../restaurant/contracts';
const status: Record<string, string> = {
  NEW: 'Передан в работу',
  COOKING: 'Готовится',
  READY: 'Готов',
  SERVED: 'Подан',
  OPEN: 'Открыт',
  PAID: 'Оплачен',
  CLOSED: 'Закрыт',
  CANCELLED: 'Отменён',
};
export default function RestaurantRoute() {
  const { state } = useAccess();
  if (state.kind !== 'ready' || state.branch.vertical !== 'FOOD_SERVICE') return null;
  return (
    <RestaurantWorkspace
      key={state.identity}
      personal={state.personal || state.user.role === 'EMPLOYEE'}
      name={state.branch.name}
    />
  );
}
function RestaurantWorkspace({ personal, name }: { personal: boolean; name: string }) {
  const { session } = useAccess();
  const theme = useTheme();
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'orders' | 'tables'>('orders');
  const [detail, setDetail] = useState<RestaurantOrder | null>(null);
  const request = useRef(0);
  const locked = useRef(false);
  const load = useCallback(
    async (next?: string) => {
      if (locked.current) return;
      locked.current = true;
      const id = ++request.current;
      setBusy(true);
      setError('');
      try {
        const page = readOrders(await session.readFood('orders', next));
        const tableData = next ? null : readTables(await session.readFood('tables'));
        if (id !== request.current) return;
        setOrders((old) =>
          next
            ? [...old, ...page.items.filter((item) => !old.some((o) => o.id === item.id))]
            : page.items,
        );
        if (tableData) setTables(tableData.tables);
        setCursor(page.nextCursor);
        setLoaded(true);
      } catch (e) {
        if (id === request.current) setError(accessMessage(e));
      } finally {
        if (id === request.current) {
          locked.current = false;
          setBusy(false);
        }
      }
    },
    [session],
  );
  useEffect(() => {
    void load();
    return () => {
      ++request.current;
      locked.current = false;
    };
  }, [load]);
  const card = { padding: 18, borderRadius: 16, backgroundColor: theme.surface, gap: 8 } as const;
  const title = { fontSize: 18, fontWeight: '700', color: theme.text } as const;
  const secondary = { fontSize: 14, lineHeight: 21, color: theme.secondary } as const;
  if (detail)
    return (
      <Screen title={`Заказ №${detail.number}`} subtitle={detail.table?.name ?? 'Заказ со стойки'}>
        <ActionButton secondary label="Назад к заказам" onPress={() => setDetail(null)} />
        <View style={card}>
          <Text style={title}>{status[detail.status] ?? detail.status}</Text>
          <Text style={secondary}>
            Гостей: {detail.guestCount} · {detail.waiter?.name ?? 'Сотрудник не назначен'}
          </Text>
        </View>
        {detail.items.map((item) => (
          <View key={item.id} style={card}>
            <Text style={title}>{item.name}</Text>
            <Text style={secondary}>
              {item.qty} × {money(item.priceMinor, detail.currency)}
            </Text>
            <Text style={secondary}>
              {item.station === 'BAR' ? 'Бар' : 'Кухня'} ·{' '}
              {status[item.status ?? ''] ?? item.status ?? 'В работе'}
            </Text>
          </View>
        ))}
        <View style={card}>
          <Text style={secondary}>Сумма заказа</Text>
          <Text style={title}>{money(detail.totalMinor, detail.currency)}</Text>
          <Text style={secondary}>Оплачено: {money(detail.paidMinor, detail.currency)}</Text>
        </View>
        <Text style={secondary}>
          Показан последний загруженный состав. Изменение заказа и расчёт пока доступны в
          веб-версии.
        </Text>
      </Screen>
    );
  const visibleTables = personal ? tables.filter((t) => t.mine) : tables;
  const data: (RestaurantOrder | RestaurantTable)[] = tab === 'orders' ? orders : visibleTables;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        windowSize={5}
        initialNumToRender={12}
        refreshing={busy}
        onRefresh={() => void load()}
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          width: '100%',
          maxWidth: 680,
          alignSelf: 'center',
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View style={{ gap: 16, paddingBottom: 8 }}>
            <ActionButton secondary label="В кабинет" onPress={() => router.replace('/')} />
            <View style={{ gap: 6 }}>
              <Text accessibilityRole="header" style={{ ...title, fontSize: 28 }}>
                {personal ? 'Мои заказы' : 'Работа ресторана'}
              </Text>
              <Text style={secondary}>{name}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['orders', 'tables'] as const).map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t }}
                  onPress={() => setTab(t)}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: tab === t ? theme.primary : theme.surface,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      fontSize: 16,
                      fontWeight: '600',
                      color: tab === t ? theme.onPrimary : theme.text,
                    }}
                  >
                    {t === 'orders' ? 'Заказы' : personal ? 'Мои столы' : 'Столы'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={secondary}>
              {tab === 'orders'
                ? 'Открытые заказы. Нажмите на заказ, чтобы посмотреть состав.'
                : personal
                  ? 'Столы с вашими открытыми заказами.'
                  : 'Столы текущего филиала и их состояние.'}
            </Text>
            {error ? (
              <View accessibilityRole="alert" style={card}>
                <Text style={{ ...secondary, color: theme.danger }}>{error}</Text>
                <ActionButton
                  secondary
                  disabled={busy}
                  label="Повторить"
                  onPress={() => void load()}
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) =>
          'number' in item ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Заказ ${item.number}, ${item.table?.name ?? 'со стойки'}`}
              onPress={() => setDetail(item)}
              style={card}
            >
              <Text style={title}>
                {item.table?.name ?? 'Со стойки'} · №{item.number}
              </Text>
              <Text style={secondary}>
                {status[item.status] ?? item.status}
                {item.delayed ? ' · Задерживается' : ''}
              </Text>
              <Text style={{ ...title, fontVariant: ['tabular-nums'] }}>
                {money(item.totalMinor, item.currency)}
              </Text>
              <Text style={secondary}>
                Позиций: {item.items.length} · Гостей: {item.guestCount}
              </Text>
            </Pressable>
          ) : (
            <View style={card}>
              <Text style={title}>{item.name}</Text>
              <Text style={secondary}>
                {item.areaName} · Мест: {item.capacity}
              </Text>
              <Text
                style={{ ...secondary, color: item.needsCleaning ? theme.danger : theme.primary }}
              >
                {item.needsCleaning
                  ? 'Нужна уборка'
                  : item.mine
                    ? 'Ваш заказ'
                    : item.busy
                      ? 'Занят'
                      : 'Свободен'}
              </Text>
            </View>
          )
        }
        ListEmptyComponent={
          !busy && !error && loaded ? (
            <View style={card}>
              <Text style={title}>
                {tab === 'orders'
                  ? 'Открытых заказов нет'
                  : personal
                    ? 'У вас пока нет столов'
                    : 'Столы ещё не добавлены'}
              </Text>
              <Text style={secondary}>Обновите список, когда появятся новые данные.</Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          <View style={{ gap: 16, paddingVertical: 12 }}>
            {busy ? (
              <ActivityIndicator accessibilityLabel="Загрузка" color={theme.primary} />
            ) : null}
            {tab === 'orders' && cursor ? (
              <ActionButton
                secondary
                disabled={busy}
                label="Загрузить ещё"
                onPress={() => void load(cursor)}
              />
            ) : null}
            <ActionButton secondary disabled={busy} label="Обновить" onPress={() => void load()} />
            <Text style={secondary}>
              Создание заказа и расчёт подключаются следующим этапом. Сейчас они доступны в
              веб-версии.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
