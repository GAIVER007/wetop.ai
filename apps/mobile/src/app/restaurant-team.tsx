import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAccess } from '../auth/provider';
import { accessMessage } from '../auth/session';
import { money } from '../restaurant/data';
import { localDate, readAnalytics } from '../restaurant/reports';
import {
  readShifts,
  readStaffRevenue,
  teamRows,
  unlistedRevenue,
  type Shift,
  type StaffRevenue,
} from '../restaurant/team';
import { useTheme } from '../theme/theme';
import { ActionButton } from '../ui/action-button';
import { Screen } from '../ui/screen';

type Period = 'day' | 'week' | 'month';
export default function RestaurantTeamRoute() {
  const { state } = useAccess();
  if (
    state.kind !== 'ready' ||
    state.branch.vertical !== 'FOOD_SERVICE' ||
    state.user.role === 'EMPLOYEE'
  )
    return null;
  return <Team key={state.identity} timezone={state.branch.timezone} branch={state.branch.name} />;
}
function Team({ timezone, branch }: { timezone: string; branch: string }) {
  const { session } = useAccess();
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>('day');
  const [version, setVersion] = useState(0);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [revenue, setRevenue] = useState<StaffRevenue | null>(null);
  const [revenueError, setRevenueError] = useState('');
  const [ordersError, setOrdersError] = useState('');
  const [orderCounts, setOrderCounts] = useState<Map<string, number> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const today = localDate(new Date(), timezone);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setRevenueError('');
    setOrdersError('');
    setOrderCounts(null);
    setRevenue(null);
    void (async () => {
      try {
        const [shiftValue, revenueValue] = await Promise.allSettled([
          session.readFood('shifts'),
          session.readStaffRevenue(period),
        ]);
        if (!active) return;
        if (shiftValue.status === 'rejected') throw shiftValue.reason;
        setShifts(readShifts(shiftValue.value));
        if (revenueValue.status === 'fulfilled') {
          const report = readStaffRevenue(revenueValue.value);
          setRevenue(report);
          try {
            const orders = readAnalytics(
              await session.readReport('analytics', report.fromDate, report.toDate),
            );
            if (active)
              setOrderCounts(new Map(orders.waiters.map((row) => [row.waiterId, row.orders])));
          } catch (cause) {
            if (active) setOrdersError(accessMessage(cause));
          }
        } else setRevenueError(accessMessage(revenueValue.reason));
      } catch (cause) {
        if (active) setError(accessMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session, period, version]);
  const card = { padding: 16, borderRadius: 16, gap: 8, backgroundColor: theme.surface } as const;
  const heading = { fontSize: 18, fontWeight: '700', color: theme.text } as const;
  const secondary = { fontSize: 14, lineHeight: 21, color: theme.secondary } as const;
  const rows = teamRows(shifts, revenue, orderCounts);
  return (
    <Screen title="Команда ресторана" subtitle={branch}>
      <ActionButton
        secondary
        label="К обзору"
        onPress={() => router.replace('/restaurant-overview')}
      />
      <Text style={secondary}>
        График на {today} по времени филиала. «Принёс» означает оплачено минус возвраты за выбранный
        период.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(
          [
            ['day', 'День'],
            ['week', 'Неделя'],
            ['month', 'Месяц'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: period === id }}
            onPress={() => setPeriod(id)}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 12,
              padding: 10,
              justifyContent: 'center',
              backgroundColor: period === id ? theme.primary : theme.surface,
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontSize: 15,
                fontWeight: '600',
                color: period === id ? theme.onPrimary : theme.text,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator accessibilityLabel="Загрузка команды" color={theme.primary} />
      ) : null}
      {error ? (
        <View accessibilityRole="alert" style={card}>
          <Text style={{ ...secondary, color: theme.danger }}>{error}</Text>
        </View>
      ) : null}
      {ordersError ? (
        <View style={card}>
          <Text style={secondary}>Число закрытых заказов недоступно: {ordersError}</Text>
        </View>
      ) : null}
      {revenueError ? (
        <View style={card}>
          <Text style={secondary}>Показатель «Принёс» недоступен: {revenueError}</Text>
        </View>
      ) : null}
      {revenue ? (
        <Text style={secondary}>
          {revenue.fromDate} – {revenue.toDate} · время филиала
        </Text>
      ) : null}
      {!loading && !error && !rows.length ? (
        <View style={card}>
          <Text style={secondary}>Нет сотрудников с графиком в этом филиале.</Text>
        </View>
      ) : null}
      {!loading && !error
        ? rows.map((row) => {
            const slots = row.week.find((day) => day.weekday === weekday)?.intervals ?? [];
            return (
              <View key={row.id} style={card}>
                <Text style={heading}>{row.name}</Text>
                <Text style={secondary}>
                  График сегодня:{' '}
                  {slots.length
                    ? slots.map((slot) => `${slot.timeFrom}–${slot.timeTo}`).join(', ')
                    : 'нет смены'}
                </Text>
                {row.orders !== null ? (
                  <Text style={secondary}>Закрыто заказов: {row.orders}</Text>
                ) : null}
                {revenue ? (
                  <Text style={secondary}>
                    Принёс:{' '}
                    {row.net.length
                      ? row.net.map((item) => money(item.netMinor, item.currency)).join(' · ')
                      : 'нет оплат'}
                  </Text>
                ) : null}
              </View>
            );
          })
        : null}
      {unlistedRevenue(shifts, revenue).map((row) => (
        <View key={row.currency} style={card}>
          <Text style={heading}>Вне текущего состава</Text>
          <Text style={secondary}>Принесли: {money(row.netMinor, row.currency)}</Text>
        </View>
      ))}
      {revenue?.items
        .filter((row) => row.employeeId === null)
        .map((row) => (
          <View key={row.currency} style={card}>
            <Text style={heading}>Заказы без официанта</Text>
            <Text style={secondary}>Принесли: {money(row.netMinor, row.currency)}</Text>
          </View>
        ))}
      <ActionButton
        secondary
        label="Обновить"
        disabled={loading}
        onPress={() => setVersion((v) => v + 1)}
      />
    </Screen>
  );
}
