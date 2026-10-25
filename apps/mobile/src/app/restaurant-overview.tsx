import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAccess } from '../auth/provider';
import { accessMessage } from '../auth/session';
import { ActionButton } from '../ui/action-button';
import { Screen } from '../ui/screen';
import { useTheme } from '../theme/theme';
import { money } from '../restaurant/data';
import {
  localDate,
  readAnalytics,
  readOverview,
  weeklyRevenue,
  type Analytics,
  type Overview,
} from '../restaurant/reports';
import { router } from 'expo-router';
const names: Record<string, string> = {
  CASH: 'Наличные',
  CARD_TERMINAL: 'Карта',
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: 'Перевод физлица',
  BANK_TRANSFER_LEGAL: 'Перевод юрлица',
};
function period(today: string, mode: 'today' | 'week' | 'month'): { from: string; to: string } {
  if (mode === 'today') return { from: today, to: today };
  if (mode === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  const day = new Date(`${today}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return { from: day.toISOString().slice(0, 10), to: today };
}
export default function RestaurantOverviewRoute() {
  const { state } = useAccess();
  if (
    state.kind !== 'ready' ||
    state.branch.vertical !== 'FOOD_SERVICE' ||
    state.user.role === 'EMPLOYEE'
  )
    return null;
  return (
    <OverviewScreen
      key={state.identity}
      timezone={state.branch.timezone}
      branch={state.branch.name}
    />
  );
}
function OverviewScreen({ timezone, branch }: { timezone: string; branch: string }) {
  const { session } = useAccess();
  const theme = useTheme();
  const [mode, setMode] = useState<'overview' | 'analytics'>('overview');
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today');
  const [version, setVersion] = useState(0);
  const [day, setDay] = useState<Overview | null>(null);
  const [stats, setStats] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const today = localDate(new Date(), timezone);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setStats(null);
    setDay(null);
    const dates = period(today, mode === 'overview' ? 'today' : range);
    void (async () => {
      try {
        const [overview, analytics] = await Promise.all([
          mode === 'overview' ? session.readReport('overview', today) : Promise.resolve(null),
          session.readReport('analytics', dates.from, dates.to),
        ]);
        if (active) {
          setDay(overview ? readOverview(overview) : null);
          setStats(readAnalytics(analytics));
        }
      } catch (e) {
        if (active) setError(accessMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session, mode, range, today, version]);
  const card = { padding: 16, borderRadius: 16, backgroundColor: theme.surface, gap: 8 } as const;
  const heading = { fontSize: 18, fontWeight: '700', color: theme.text } as const;
  const muted = { fontSize: 14, lineHeight: 21, color: theme.secondary } as const;
  const primary = {
    fontSize: 26,
    fontWeight: '800',
    color: theme.text,
    fontVariant: ['tabular-nums'],
  } as const;
  const metric = (label: string, value: string, compact = false) => (
    <View style={card}>
      <Text style={muted}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={[primary, compact ? { fontSize: 20 } : null]}
      >
        {value}
      </Text>
    </View>
  );
  return (
    <Screen title={mode === 'overview' ? 'Обзор ресторана' : 'Аналитика'} subtitle={branch}>
      <ActionButton secondary label="Команда" onPress={() => router.push('/restaurant-team')} />
      <ActionButton
        secondary
        label="К столам и заказам"
        onPress={() => router.replace('/restaurant')}
      />
      {mode === 'overview' ? (
        <ActionButton label="Открыть аналитику" onPress={() => setMode('analytics')} />
      ) : (
        <>
          <ActionButton secondary label="Вернуться к обзору" onPress={() => setMode('overview')} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(
              [
                ['today', 'Сегодня'],
                ['week', 'Неделя'],
                ['month', 'Месяц'],
              ] as const
            ).map(([id, label]) => (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: range === id }}
                onPress={() => setRange(id)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  padding: 10,
                  justifyContent: 'center',
                  backgroundColor: range === id ? theme.primary : theme.surface,
                }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    fontSize: 15,
                    fontWeight: '600',
                    color: range === id ? theme.onPrimary : theme.text,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {loading ? (
        <ActivityIndicator accessibilityLabel="Загрузка отчёта" color={theme.primary} />
      ) : null}
      {error ? (
        <View accessibilityRole="alert" style={card}>
          <Text style={{ ...muted, color: theme.danger }}>{error}</Text>
          <ActionButton secondary label="Повторить" onPress={() => setVersion((v) => v + 1)} />
        </View>
      ) : null}
      {stats ? (
        <>
          <Text style={muted}>
            {stats.from === stats.to ? stats.from : `${stats.from} – ${stats.to}`} · время филиала
          </Text>
          {metric('Выручка закрытых заказов', money(stats.revenueMinor, stats.currency))}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              {metric('Закрыто заказов', String(stats.ordersCount), true)}
            </View>
            <View style={{ flex: 1 }}>
              {metric(
                'Средний чек',
                stats.averageCheckMinor === null
                  ? 'Нет данных'
                  : money(stats.averageCheckMinor, stats.currency),
                true,
              )}
            </View>
          </View>
          {mode === 'overview' && day ? (
            <>
              <Text style={heading}>Сейчас в ресторане</Text>
              <View style={card}>
                <Text style={heading}>
                  Столы: {day.tiles.tablesOccupied} из {day.tiles.tablesTotal} заняты
                </Text>
                <Text style={muted}>
                  Очередь кухни: {day.tiles.kitchenQueue} · ожидание:{' '}
                  {day.tiles.kitchenAvgWaitMinutes === null
                    ? 'нет данных'
                    : `${day.tiles.kitchenAvgWaitMinutes} мин`}
                </Text>
                <Text style={muted}>
                  На смене: {day.tiles.staffOnShift} из {day.tiles.staffTotal}
                </Text>
                <Text style={muted}>Открыто заказов сегодня: {day.tiles.ordersCount}</Text>
              </View>
            </>
          ) : null}
          <Text style={heading}>Оплаты по способам</Text>
          <Text style={muted}>
            Поступления за период. Они уже связаны с заказами и не прибавляются к выручке повторно.
          </Text>
          {stats.payments.length ? (
            stats.payments.map((row) => (
              <View key={row.method} style={card}>
                <Text style={muted}>
                  {names[row.method] ?? row.method} · {row.count} оплат
                </Text>
                <Text style={heading}>{money(row.amountMinor, stats.currency)}</Text>
              </View>
            ))
          ) : (
            <View style={card}>
              <Text style={muted}>Оплат за период нет.</Text>
            </View>
          )}
          {mode === 'analytics' ? (
            <>
              <Text style={heading}>{range === 'month' ? 'По неделям' : 'По дням'}</Text>
              {range === 'month'
                ? weeklyRevenue(stats.revenueByDay).map((row) => (
                    <View key={row.from} style={card}>
                      <Text style={muted}>
                        {row.from} – {row.to} · закрыто: {row.orders}
                      </Text>
                      <Text style={heading}>{money(row.revenueMinor, stats.currency)}</Text>
                    </View>
                  ))
                : stats.revenueByDay.map((row) => (
                    <View key={row.date} style={card}>
                      <Text style={muted}>
                        {row.date} · закрыто: {row.orders}
                      </Text>
                      <Text style={heading}>{money(row.revenueMinor, stats.currency)}</Text>
                    </View>
                  ))}
              <Text style={heading}>Популярные позиции</Text>
              <Text style={muted}>Топ-3 по количеству среди закрытых заказов за период.</Text>
              {(['KITCHEN', 'BAR'] as const).map((station) => (
                <View key={station} style={{ gap: 8 }}>
                  <Text style={heading}>{station === 'KITCHEN' ? 'Кухня' : 'Бар'}</Text>
                  {stats.topByStation[station].length ? (
                    stats.topByStation[station].map((row, index) => (
                      <View key={`${station}:${row.name}`} style={card}>
                        <Text style={heading}>
                          {index + 1}. {row.name}
                        </Text>
                        <Text style={muted}>
                          Продано: {row.qty} · {money(row.revenueMinor, stats.currency)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={card}>
                      <Text style={muted}>Продаж за период нет.</Text>
                    </View>
                  )}
                </View>
              ))}
              <Text style={heading}>Официанты по закрытым заказам</Text>
              {stats.waiters.slice(0, 5).map((row, index) => (
                <View key={`${row.name}:${index}`} style={card}>
                  <Text style={heading}>{row.name}</Text>
                  <Text style={muted}>
                    Заказов: {row.orders} · сумма заказов: {money(row.revenueMinor, stats.currency)}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
        </>
      ) : null}
      <ActionButton
        secondary
        label="Обновить"
        disabled={loading}
        onPress={() => setVersion((v) => v + 1)}
      />
    </Screen>
  );
}
