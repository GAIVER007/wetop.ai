import { OrderFlow } from '../restaurant/order-flow';
import type { OrderPayload } from '../restaurant/pending-order';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAccess } from '../auth/provider';
import { accessMessage } from '../auth/session';
import { AccessError } from '../auth/contracts';
import { ActionButton } from '../ui/action-button';
import { FormField } from '../ui/form-field';
import { useTheme } from '../theme/theme';
import { money, readCategories, readMenu, readTables } from '../restaurant/data';
import type { MenuCategory, MenuItem, RestaurantTable } from '../restaurant/contracts';
import { DishOptions, DraftReview } from '../restaurant/draft-screens';
import type { DraftLine } from '../restaurant/draft';
export default function MenuRoute() {
  const { state } = useAccess();
  return state.kind === 'ready' && state.branch.vertical === 'FOOD_SERVICE' ? (
    <OrderFlow key={state.identity} onOrders={() => router.replace('/restaurant')}>
      {(submit) => <RestaurantMenu onSubmit={submit} />}
    </OrderFlow>
  ) : null;
}
function RestaurantMenu({ onSubmit }: { onSubmit?: (payload: OrderPayload) => void }) {
  const { session, draft } = useAccess();
  const draftState = useSyncExternalStore(draft.subscribe, draft.snapshot, draft.snapshot);
  const { lines, tableId, guests } = draftState;
  const setLines = (next: DraftLine[] | ((old: DraftLine[]) => DraftLine[])) =>
    draft.update({ lines: typeof next === 'function' ? next(draft.snapshot().lines) : next });
  const setTableId = (id: string | null) => draft.update({ tableId: id });
  const setGuests = (n: number) => draft.update({ guests: n });
  const theme = useTheme();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [review, setReview] = useState(false);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [query, setQuery] = useState('');
  const [station, setStation] = useState('ALL');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    const version = ++generation.current;
    setBusy(true);
    setError('');
    async function readAll<T>(
      action: 'categories' | 'items',
      parse: (v: unknown) => { items: T[]; nextCursor: string | null },
    ) {
      let cursor: string | undefined;
      const seen = new Set<string>();
      const result: T[] = [];
      do {
        const page = parse(await session.readFood(action, cursor));
        if (!active || version !== generation.current) return [];
        result.push(...page.items);
        if (page.nextCursor && seen.has(page.nextCursor)) throw new AccessError('invalid');
        if (page.nextCursor) seen.add(page.nextCursor);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return result;
    }
    void (async () => {
      try {
        const cats = await readAll('categories', readCategories);
        const menu = await readAll('items', readMenu);
        const tableData = readTables(await session.readFood('tables'));
        if (active) {
          setTables(tableData.tables);
          draft.reconcile(menu.filter((i) => cats.some((c) => c.id === i.categoryId && c.active)));
          const current = draft.snapshot();
          if (current.tableId && !tableData.tables.some((t) => t.id === current.tableId))
            draft.update({
              tableId: undefined,
              notice: [current.notice, 'Выбранный стол больше недоступен. Выберите другой.']
                .filter(Boolean)
                .join('. '),
            });
          setCategories(cats);
          setItems(menu);
          setLoaded(true);
        }
      } catch (e) {
        if (active) setError(accessMessage(e));
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session, draft, attempt]);
  const cats = new Map(categories.map((c) => [c.id, c]));
  const visible = items.filter((i) => {
    const cat = cats.get(i.categoryId);
    return (
      i.active &&
      cat?.active &&
      (station === 'ALL' || cat.station === station) &&
      i.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))
    );
  });
  if (selected)
    return (
      <DishOptions
        key={selected.id}
        item={selected}
        onBack={() => setSelected(null)}
        onAdd={(line) => {
          if (lines.length >= 100 && !lines.some((l) => l.key === line.key))
            throw new Error('В заказе не больше 100 позиций.');
          if (lines.some((l) => l.item.currency !== line.item.currency))
            throw new Error('Валюты позиций не совпадают.');
          if (lines.some((l) => l.key === line.key && l.qty >= 999))
            throw new Error('Количество не больше 999.');
          setLines((old) =>
            old.some((l) => l.key === line.key)
              ? old.map((l) => (l.key === line.key ? { ...l, qty: l.qty + 1 } : l))
              : [...old, line],
          );
          setSelected(null);
        }}
      />
    );
  if (review)
    return (
      <DraftReview
        onSubmit={onSubmit}
        notice={draftState.notice}
        acknowledge={() => draft.update({ notice: '' })}
        lines={lines}
        setLines={setLines}
        tables={tables}
        tableId={tableId}
        setTableId={setTableId}
        guests={guests}
        setGuests={setGuests}
        onBack={() => setReview(false)}
      />
    );
  const text = { fontSize: 15, lineHeight: 22, color: theme.secondary };
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        windowSize={5}
        initialNumToRender={12}
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          maxWidth: 680,
          width: '100%',
          alignSelf: 'center',
          flexGrow: 1,
        }}
        refreshing={busy}
        onRefresh={() => setAttempt((v) => v + 1)}
        ListHeaderComponent={
          <View style={{ gap: 16, paddingBottom: 8 }}>
            <ActionButton
              secondary
              label="К столам и заказам"
              onPress={() => router.replace('/restaurant')}
            />
            <Text
              accessibilityRole="header"
              style={{ fontSize: 28, fontWeight: '700', color: theme.text }}
            >
              Меню
            </Text>
            {draftState.notice ? (
              <Text accessibilityRole="alert" style={{ ...text, color: theme.danger }}>
                {draftState.notice}
              </Text>
            ) : null}
            {lines.length ? (
              <ActionButton
                label={`Проверить заказ · ${lines.reduce((sum, l) => sum + l.qty, 0)}`}
                onPress={() => setReview(true)}
              />
            ) : null}
            <FormField label="Найти блюдо или напиток" value={query} onChangeText={setQuery} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(
                [
                  ['ALL', 'Всё'],
                  ['KITCHEN', 'Кухня'],
                  ['BAR', 'Бар'],
                ] as const
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: station === id }}
                  onPress={() => setStation(id)}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: station === id ? theme.primary : theme.surface,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      textAlign: 'center',
                      color: station === id ? theme.onPrimary : theme.text,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={text}>
              Доступные блюда и напитки по данным сервера. Черновик сохраняется при переходах до
              выхода из аккаунта или смены филиала.
            </Text>
            {error ? (
              <View accessibilityRole="alert" style={{ gap: 12 }}>
                <Text style={{ ...text, color: theme.danger }}>{error}</Text>
                <ActionButton
                  label="Повторить"
                  disabled={busy}
                  onPress={() => setAttempt((v) => v + 1)}
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ padding: 16, borderRadius: 16, backgroundColor: theme.surface, gap: 10 }}>
            {item.photoUrl?.startsWith('https://') ? (
              <Image
                accessibilityLabel={item.name}
                source={{ uri: item.photoUrl }}
                style={{ height: 140, width: '100%', borderRadius: 12 }}
              />
            ) : null}
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{item.name}</Text>
            <Text style={text}>{cats.get(item.categoryId)?.name}</Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: theme.primary,
                fontVariant: ['tabular-nums'],
              }}
            >
              {money(item.priceMinor, item.currency)}
            </Text>
            <ActionButton
              secondary
              label="Добавить"
              disabled={busy || Boolean(error)}
              onPress={() => setSelected(item)}
            />
            {item.modifierGroups.length ? (
              <Text style={text}>Есть варианты приготовления</Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          !busy && !error && loaded ? (
            <Text style={text}>
              {query
                ? 'Ничего не найдено. Попробуйте другое название.'
                : 'Доступных позиций пока нет.'}
            </Text>
          ) : undefined
        }
        ListFooterComponent={
          <View style={{ paddingVertical: 12, gap: 16 }}>
            {busy ? (
              <ActivityIndicator accessibilityLabel="Загрузка меню" color={theme.primary} />
            ) : null}
            <ActionButton
              secondary
              disabled={busy}
              label="Обновить меню"
              onPress={() => setAttempt((v) => v + 1)}
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}
