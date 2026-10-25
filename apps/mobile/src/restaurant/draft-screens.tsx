import type { OrderPayload } from './pending-order';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '../ui/screen';
import { ActionButton } from '../ui/action-button';
import { FormField } from '../ui/form-field';
import { useTheme } from '../theme/theme';
import { money } from './data';
import { draftLine, draftTotal, type DraftLine } from './draft';
import type { MenuItem, RestaurantTable } from './contracts';
export function DishOptions({
  item,
  onBack,
  onAdd,
}: {
  item: MenuItem;
  onBack: () => void;
  onAdd: (line: DraftLine) => void;
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  return (
    <Screen title={item.name} subtitle={money(item.priceMinor, item.currency)}>
      <ActionButton secondary label="Назад в меню" onPress={onBack} />
      {item.modifierGroups.map((group) => (
        <View key={group.id} style={{ gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{group.name}</Text>
          <Text style={{ fontSize: 14, color: theme.secondary }}>
            Выберите от {Math.max(group.minSelect, group.required ? 1 : 0)} до {group.maxSelect}
          </Text>
          {group.modifiers.map((mod) => (
            <Pressable
              key={mod.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected.includes(mod.id) }}
              onPress={() => {
                setError('');
                setSelected((old) =>
                  old.includes(mod.id)
                    ? old.filter((id) => id !== mod.id)
                    : group.maxSelect === 1
                      ? [...old.filter((id) => !group.modifiers.some((m) => m.id === id)), mod.id]
                      : [...old, mod.id],
                );
              }}
              style={{
                minHeight: 56,
                padding: 16,
                gap: 6,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: selected.includes(mod.id) ? theme.primary : theme.surface,
                backgroundColor: theme.surface,
              }}
            >
              <Text style={{ fontSize: 16, color: theme.text }}>
                {selected.includes(mod.id) ? '✓ ' : ''}
                {mod.name}
              </Text>
              <Text style={{ fontSize: 14, color: theme.secondary }}>
                {money(mod.priceDeltaMinor, item.currency)}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
      <FormField label="Комментарий к позиции" value={notes} onChangeText={setNotes} />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.danger, fontSize: 16 }}>
          {error}
        </Text>
      ) : null}
      <ActionButton
        label="Добавить в заказ"
        onPress={() => {
          try {
            onAdd(draftLine(item, selected, notes));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Проверьте состав.');
          }
        }}
      />
    </Screen>
  );
}
export function DraftReview({
  onSubmit,
  notice,
  acknowledge,
  lines,
  setLines,
  tables,
  tableId,
  setTableId,
  guests,
  setGuests,
  onBack,
}: {
  onSubmit?: (payload: OrderPayload) => void;
  notice: string;
  acknowledge: () => void;
  lines: DraftLine[];
  setLines: (lines: DraftLine[]) => void;
  tables: RestaurantTable[];
  tableId: string | null | undefined;
  setTableId: (id: string | null) => void;
  guests: number;
  setGuests: (n: number) => void;
  onBack: () => void;
}) {
  const theme = useTheme();
  const label = { fontSize: 16, lineHeight: 23, color: theme.text };
  return (
    <Screen title="Проверка заказа" subtitle="Черновик на этом устройстве, ещё не отправлен">
      {notice ? (
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="alert" style={{ ...label, color: theme.danger }}>
            {notice}
          </Text>
          <ActionButton secondary label="Изменения проверены" onPress={acknowledge} />
        </View>
      ) : null}
      <ActionButton secondary label="Добавить блюда и напитки" onPress={onBack} />
      <Text style={{ ...label, fontWeight: '700' }}>Куда подать</Text>
      {[
        { id: null, name: 'Заказ со стойки' },
        ...tables.map((t) => ({
          id: t.id,
          name: `${t.name} · ${t.areaName}${t.busy ? ' · занят' : ''}`,
        })),
      ].map((t) => (
        <Pressable
          key={t.id ?? 'counter'}
          accessibilityRole="radio"
          accessibilityState={{ checked: tableId === t.id }}
          onPress={() => setTableId(t.id)}
          style={{
            minHeight: 48,
            padding: 14,
            borderRadius: 12,
            backgroundColor: tableId === t.id ? theme.primary : theme.surface,
          }}
        >
          <Text style={{ ...label, color: tableId === t.id ? theme.onPrimary : theme.text }}>
            {t.name}
          </Text>
        </Pressable>
      ))}
      <Text style={label}>Гостей: {guests}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <ActionButton
            secondary
            label="Меньше гостей"
            disabled={guests <= 1}
            onPress={() => setGuests(guests - 1)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton
            secondary
            label="Больше гостей"
            disabled={guests >= 1000}
            onPress={() => setGuests(guests + 1)}
          />
        </View>
      </View>
      {lines.map((line) => (
        <View
          key={line.key}
          style={{ padding: 16, gap: 12, borderRadius: 16, backgroundColor: theme.surface }}
        >
          <Text style={{ ...label, fontWeight: '700' }}>{line.item.name}</Text>
          <Text style={label}>
            {line.qty} × {money(line.unitMinor, line.item.currency)}
          </Text>
          {line.modifierIds.length ? (
            <Text style={{ ...label, color: theme.secondary }}>
              {line.item.modifierGroups
                .flatMap((g) => g.modifiers)
                .filter((m) => line.modifierIds.includes(m.id))
                .map((m) => m.name)
                .join(', ')}
            </Text>
          ) : null}
          {line.notes ? (
            <Text style={{ ...label, color: theme.secondary }}>{line.notes}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                secondary
                label={line.qty === 1 ? 'Убрать' : 'Меньше'}
                onPress={() =>
                  setLines(
                    line.qty === 1
                      ? lines.filter((l) => l.key !== line.key)
                      : lines.map((l) => (l.key === line.key ? { ...l, qty: l.qty - 1 } : l)),
                  )
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                secondary
                label="Больше"
                disabled={line.qty >= 999}
                onPress={() =>
                  setLines(lines.map((l) => (l.key === line.key ? { ...l, qty: l.qty + 1 } : l)))
                }
              />
            </View>
          </View>
        </View>
      ))}
      {lines[0] ? (
        <Text style={{ fontSize: 24, fontWeight: '700', color: theme.text }}>
          Итого: {money(draftTotal(lines), lines[0].item.currency)}
        </Text>
      ) : (
        <Text style={label}>В заказе пока нет позиций.</Text>
      )}
      {tableId === undefined ? (
        <Text style={{ ...label, color: theme.secondary }}>Выберите стол или заказ со стойки.</Text>
      ) : null}
      {onSubmit ? (
        <ActionButton
          label="Отправить заказ"
          disabled={!lines.length || tableId === undefined || Boolean(notice)}
          onPress={() => {
            if (!lines.length || tableId === undefined || notice) return;
            onSubmit({
              tableId,
              guestCount: guests,
              items: lines.map((line) => ({
                menuItemId: line.item.id,
                qty: line.qty,
                notes: line.notes,
                modifierIds: [...line.modifierIds],
              })),
            });
          }}
        />
      ) : (
        <Text style={{ ...label, color: theme.secondary }}>
          Надёжная отправка заказа доступна в установленном приложении. Этот черновик ещё не
          отправлен.
        </Text>
      )}
    </Screen>
  );
}
