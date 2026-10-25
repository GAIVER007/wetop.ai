import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAccess } from '../auth/provider';
import { accessMessage } from '../auth/session';
import { readCash } from '../restaurant/cash';
import { money } from '../restaurant/data';
import type { CashSummary } from '../restaurant/contracts';
import { ActionButton } from '../ui/action-button';
import { useTheme } from '../theme/theme';
const methods: Record<string, string> = {
  CASH: 'Наличные',
  CARD_TERMINAL: 'Карта через терминал',
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: 'Перевод физлица',
  BANK_TRANSFER_LEGAL: 'Перевод юрлица',
};
export default function RestaurantCashRoute() {
  const { state } = useAccess();
  if (
    state.kind !== 'ready' ||
    state.branch.vertical !== 'FOOD_SERVICE' ||
    state.user.role === 'EMPLOYEE'
  )
    return null;
  return <Cash key={state.identity} timezone={state.branch.timezone} />;
}
function Cash({ timezone }: { timezone: string }) {
  const { session } = useAccess();
  const theme = useTheme();
  const [data, setData] = useState<CashSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setData(readCash(await session.readFood('cash')));
    } catch (e) {
      setError(accessMessage(e));
    } finally {
      setBusy(false);
    }
  }, [session]);
  useEffect(() => {
    void load();
  }, [load]);
  const card = { padding: 16, borderRadius: 16, gap: 8, backgroundColor: theme.surface } as const;
  const heading = { fontSize: 18, fontWeight: '700', color: theme.text } as const;
  const secondary = { fontSize: 14, lineHeight: 21, color: theme.secondary } as const;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={data?.payments ?? []}
        keyExtractor={(payment) => payment.id}
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
            <ActionButton
              secondary
              label="К столам и заказам"
              onPress={() => router.replace('/restaurant')}
            />
            <Text accessibilityRole="header" style={{ ...heading, fontSize: 28 }}>
              Касса филиала
            </Text>
            <Text style={secondary}>
              Остатки по способам оплаты и последние оплаты. Доступ подтверждается сервером.
            </Text>
            {error ? (
              <View accessibilityRole="alert" style={card}>
                <Text style={{ ...secondary, color: theme.danger }}>{error}</Text>
                <ActionButton
                  secondary
                  label="Повторить"
                  disabled={busy}
                  onPress={() => void load()}
                />
              </View>
            ) : null}
            {data ? (
              <>
                <Text style={heading}>Остатки</Text>
                {data.balances.length ? (
                  data.balances.map((balance) => (
                    <View key={balance.method} style={card}>
                      <Text style={secondary}>{methods[balance.method] ?? balance.method}</Text>
                      <Text style={{ ...heading, fontVariant: ['tabular-nums'] }}>
                        {money(balance.balanceMinor, data.currency)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={card}>
                    <Text style={secondary}>Остатков пока нет.</Text>
                  </View>
                )}
                <Text style={heading}>Последние оплаты</Text>
                <Text style={secondary}>
                  Показаны последние до 100 записей. Это не итог выручки за день.
                </Text>
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={card}>
            <Text style={heading}>Заказ №{item.orderNumber}</Text>
            <Text style={secondary}>
              {methods[item.method] ?? item.method} ·{' '}
              {item.status === 'COMPLETED'
                ? 'Проведено'
                : item.status === 'VOIDED'
                  ? 'Аннулировано'
                  : item.status}
            </Text>
            <Text style={{ ...heading, fontVariant: ['tabular-nums'] }}>
              {money(item.amountMinor, data?.currency ?? 'KZT')}
            </Text>
            <Text style={secondary}>
              {new Date(item.paidAt).toLocaleString('ru-RU', {
                timeZone: timezone,
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          !busy && !error && data ? (
            <View style={card}>
              <Text style={secondary}>Оплат пока нет.</Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          <View style={{ paddingVertical: 12, gap: 12 }}>
            {busy ? (
              <ActivityIndicator accessibilityLabel="Загрузка кассы" color={theme.primary} />
            ) : null}
            <ActionButton secondary disabled={busy} label="Обновить" onPress={() => void load()} />
          </View>
        }
      />
    </SafeAreaView>
  );
}
