'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { splitEvenly } from '@pms/domain';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, Field, Input, Select, Table } from '../../components/ui';
import { METHOD_RU } from '../../lib/dashboard-format';
import type { Translate } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
import { formatMoney } from '../../lib/money';
import { cartLinePrice, choiceProblem, lineModifiersText, toggleChoice } from '../../lib/food-modifiers';
import { FOOD_PAYMENT_METHODS, type FoodPaymentMethod } from '../../lib/food-types';
import type { MenuItemView, ModifierGroupView, OrderItemInput, OrderView } from '../../lib/food-types';
import { mutateMenu, mutateOrder } from './restaurant-actions';
import { useBranchPaymentMethods } from '../branch-payment-methods/use-branch-methods';
import { branchMethodsShown } from '../branch-payment-methods/shown';

/** Прибавка к цене: «+300 ₸», «−200 ₸», у нулевой пусто */
export function deltaText(minor: string, currency: string): string {
  const v = BigInt(minor);
  if (v === 0n) return '';
  return v > 0n ? `+${formatMoney(v, currency)}` : formatMoney(v, currency);
}

/** Добавки и комментарий позиции под названием (корзина, кухня, карточка заказа) */
export function LineModifiers({ modifiers, notes }: { modifiers?: ReadonlyArray<{ name: string }> | undefined; notes?: string | null | undefined }) {
  const text = lineModifiersText(modifiers ?? [], notes);
  if (!text) return null;
  return (
    <small className="food-mod-line" data-testid="line-modifiers">
      {text}
    </small>
  );
}

/**
 * Окно выбора добавок и комментария позиции (§33.7): радио у группы «одно», галочки у «несколько», цена обновляется,
 * кнопка «Добавить» закрыта, пока обязательная группа не выбрана. Для блюда без групп только комментарий.
 */
export function ModifierPicker({
  dish,
  initial,
  submitLabel,
  onSubmit,
  close,
}: {
  dish: MenuItemView;
  initial?: OrderItemInput | undefined;
  submitLabel?: string;
  onSubmit: (line: OrderItemInput) => void;
  close: () => void;
}) {
  const t = useT();
  const groups = dish.modifierGroups ?? [];
  const [selected, setSelected] = useState<string[]>(initial?.modifierIds ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [qty, setQty] = useState(initial?.qty ?? 1);
  const problem = choiceProblem(groups, selected);
  const price = cartLinePrice(dish, selected);
  return (
    <Overlay open onClose={close} title={dish.name} drawer size="sm" trapFocus>
      <div className="food-form food-mod-picker" data-testid="modifier-picker">
        {groups.map((g) => (
          <fieldset key={g.id} className="food-mod-group">
            <legend>
              {g.name}
              <small>
                {g.required
                  ? g.maxSelect === 1
                    ? t('обязательно, одно')
                    : t('обязательно, до {n}', { n: g.maxSelect })
                  : g.maxSelect === 1
                    ? t('одно на выбор')
                    : t('до {n}', { n: g.maxSelect })}
              </small>
            </legend>
            {g.modifiers.map((m) => (
              <label key={m.id} className="food-mod-option">
                {g.maxSelect === 1 ? (
                  <input
                    type="radio"
                    name={`mod-${g.id}`}
                    checked={selected.includes(m.id)}
                    onChange={() => setSelected(toggleChoice(selected, g, m.id))}
                  />
                ) : (
                  <input
                    type="checkbox"
                    name={`mod-${g.id}`}
                    checked={selected.includes(m.id)}
                    onChange={() => setSelected(toggleChoice(selected, g, m.id))}
                  />
                )}
                <span>{m.name}</span>
                <small>{deltaText(m.priceDeltaMinor, dish.currency)}</small>
              </label>
            ))}
          </fieldset>
        ))}
        <Field label={t('Комментарий')}>
          <Input
            value={notes}
            maxLength={500}
            placeholder={t('Например: без лука')}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <div className="food-mod-foot">
          <span className="food-mod-qty" role="group" aria-label={t('Количество')}>
            <Button tone="ghost" aria-label={t('Меньше')} onClick={() => setQty(Math.max(1, qty - 1))}>
              −
            </Button>
            <span>{qty}</span>
            <Button tone="ghost" aria-label={t('Больше')} onClick={() => setQty(Math.min(999, qty + 1))}>
              +
            </Button>
          </span>
          <strong data-testid="modifier-price">{formatMoney(price * BigInt(qty), dish.currency)}</strong>
        </div>
        {problem && <p className="muted">{problem}</p>}
        <div className="food-actions">
          <Button
            data-testid="modifier-submit"
            disabled={!!problem}
            onClick={() => {
              onSubmit({ menuItemId: dish.id, qty, modifierIds: selected, notes: notes.trim() || null });
              close();
            }}
          >
            {submitLabel ?? t('Добавить')}
          </Button>
          <Button tone="secondary" onClick={close}>
            {t('Отмена')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

type Ctx = { scopeKey: string; write: boolean; currencyHint: string };
/** Продукт склада для выбора в добавке (§62.2) */
export type ModifierStockOption = { id: string; name: string; unit: string };
type DraftIngredient = { productId: string; normQty: string };
type DraftModifier = { id: string | null; name: string; price: string; active: boolean; ingredients: DraftIngredient[] };

function choiceLabel(g: Pick<ModifierGroupView, 'minSelect' | 'maxSelect'>, t: Translate) {
  const many = g.maxSelect === 1 ? t('одно') : t('до {n}', { n: g.maxSelect });
  return g.minSelect >= 1 ? t('Обязательно, {many}', { many }) : t('Можно не выбирать, {many}', { many });
}

/** Группа добавок: название, обязательность, сколько выбрать, список добавок с прибавкой к цене */
function ModifierGroupDrawer({
  ctx,
  group,
  stock,
  close,
}: {
  ctx: Ctx;
  group: ModifierGroupView | null;
  stock: ModifierStockOption[];
  close: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [name, setName] = useState(group?.name ?? '');
  const [required, setRequired] = useState(group ? group.minSelect >= 1 : false);
  const [max, setMax] = useState(String(group?.maxSelect ?? 1));
  const [active, setActive] = useState(group?.active ?? true);
  const [rows, setRows] = useState<DraftModifier[]>(
    group
      ? group.modifiers.map((m) => ({
          id: m.id,
          name: m.name,
          price: String(Number(BigInt(m.priceDeltaMinor)) / 100),
          active: m.active,
          ingredients: (m.ingredients ?? []).map((i) => ({ productId: i.productId, normQty: i.normQty })),
        }))
      : [{ id: null, name: '', price: '0', active: true, ingredients: [] }],
  );
  const set = (index: number, patch: Partial<DraftModifier>) => setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  function save() {
    setError('');
    const maxSelect = Number(max);
    if (!name.trim()) return setError(t('Введите название группы'));
    if (!Number.isInteger(maxSelect) || maxSelect < 1 || maxSelect > 20) return setError(t('Сколько можно выбрать: от 1 до 20'));
    const modifiers = [];
    for (const r of rows) {
      const price = Number(r.price.replace(',', '.').replace(/\s/g, '') || '0');
      if (!r.name.trim()) return setError(t('У каждой добавки нужно название'));
      if (!Number.isFinite(price)) return setError(t('Добавка «{name}»: прибавка числом', { name: r.name }));
      const ingredients = r.ingredients.map((i) => ({ productId: i.productId, normQty: i.normQty.replace(',', '.').trim() }));
      if (ingredients.some((i) => !i.productId || !i.normQty)) return setError(t('Добавка «{name}»: укажите продукт и сколько списать', { name: r.name }));
      modifiers.push({
        ...(r.id ? { id: r.id } : {}),
        name: r.name.trim(),
        priceDeltaMinor: Math.round(price * 100),
        active: r.active,
        // без склада поле не шлём: продукты добавки не трогаются
        ...(stock.length ? { ingredients } : {}),
      });
    }
    const body = { name: name.trim(), minSelect: required ? 1 : 0, maxSelect, active, modifiers };
    start(async () => {
      const result = await mutateMenu(ctx.scopeKey, group ? { kind: 'modifier-group', id: group.id, body } : { kind: 'modifier-group', body });
      if (result.error) setError(result.error);
      else {
        router.refresh();
        close();
      }
    });
  }
  return (
    <Overlay open onClose={close} title={group ? t('Группа: {name}', { name: group.name }) : t('Новая группа добавок')} drawer trapFocus>
      <div className="food-form" data-testid="modifier-group-drawer">
        {error && <Alert>{error}</Alert>}
        <div className="food-form-row">
          <Field label={t('Название группы')}>
            <Input value={name} maxLength={100} placeholder={t('Размер, Добавки, Соус')} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t('Сколько можно выбрать')}>
            <Input type="number" min={1} max={20} value={max} onChange={(e) => setMax(e.target.value)} />
          </Field>
        </div>
        <label className="food-check">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          {t('Обязательно выбрать (например, размер)')}
        </label>
        <label className="food-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {t('Группа включена')}
        </label>
        <h3>{t('Добавки')}</h3>
        {rows.map((r, index) => (
          <div className="food-mod-edit-row" key={r.id ?? `new-${index}`}>
            <Input aria-label={t('Добавка {n}', { n: index + 1 })} value={r.name} maxLength={100} onChange={(e) => set(index, { name: e.target.value })} />
            <Input
              aria-label={t('Прибавка к цене {n}, {currency}', { n: index + 1, currency: ctx.currencyHint })}
              inputMode="decimal"
              value={r.price}
              onChange={(e) => set(index, { price: e.target.value })}
            />
            <label className="food-check">
              <input type="checkbox" checked={r.active} onChange={(e) => set(index, { active: e.target.checked })} />
              {t('В продаже')}
            </label>
            <Button tone="ghost" aria-label={t('Убрать добавку {n}', { n: index + 1 })} onClick={() => setRows(rows.filter((_, i) => i !== index))}>
              ×
            </Button>
            {stock.length > 0 && (
              <div className="food-mod-stock" data-testid="modifier-stock">
                <small className="muted">{t('Со склада на порцию:')}</small>
                {r.ingredients.map((ing, k) => (
                  <span key={k} className="food-mod-stock-row">
                    <Select
                      aria-label={t('Продукт добавки {n}, строка {row}', { n: index + 1, row: k + 1 })}
                      value={ing.productId}
                      onChange={(e) =>
                        set(index, { ingredients: r.ingredients.map((x, j) => (j === k ? { ...x, productId: e.target.value } : x)) })
                      }
                    >
                      {stock.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}, {p.unit}
                        </option>
                      ))}
                    </Select>
                    <Input
                      aria-label={t('Сколько списать {n}, строка {row}', { n: index + 1, row: k + 1 })}
                      inputMode="decimal"
                      value={ing.normQty}
                      onChange={(e) =>
                        set(index, { ingredients: r.ingredients.map((x, j) => (j === k ? { ...x, normQty: e.target.value } : x)) })
                      }
                    />
                    <Button
                      tone="ghost"
                      size="sm"
                      aria-label={t('Убрать продукт {row} у добавки {n}', { n: index + 1, row: k + 1 })}
                      onClick={() => set(index, { ingredients: r.ingredients.filter((_, j) => j !== k) })}
                    >
                      ×
                    </Button>
                  </span>
                ))}
                {r.ingredients.length < 20 && (
                  <Button
                    tone="ghost"
                    size="sm"
                    onClick={() => set(index, { ingredients: [...r.ingredients, { productId: stock[0]!.id, normQty: '' }] })}
                  >
                    {t('+ Продукт со склада')}
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
        <p className="muted">
          {t('Прибавка к цене блюда в {currency}: 0 без доплаты, минус для скидки (маленький размер).', { currency: ctx.currencyHint })}
        </p>
        {stock.length > 0 && <p className="muted">{t('Продукты со склада спишутся вместе с блюдом, когда его отметят «Готово».')}</p>}
        <Button tone="secondary" onClick={() => setRows([...rows, { id: null, name: '', price: '0', active: true, ingredients: [] }])}>
          {t('+ Добавка')}
        </Button>
        <div className="food-actions">
          <Button disabled={pending} onClick={save}>
            {t('Сохранить')}
          </Button>
          <Button tone="secondary" disabled={pending} onClick={close}>
            {t('Отмена')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

/** Вкладка «Добавки» в «Меню»: группы таблицей, создание и правка */
export function ModifierGroupsTable({ ctx, groups: all, items, adding, setAdding, needle = '', stock = [] }: {
  ctx: Ctx;
  groups: ModifierGroupView[];
  /** §62.2: продукты склада для списания добавкой; пусто, если склада нет */
  stock?: ModifierStockOption[];
  /** строка поиска экрана «Меню»: по группе и её добавкам */
  needle?: string;
  items: MenuItemView[];
  adding: boolean;
  setAdding: (v: boolean) => void;
}) {
  const t = useT();
  const [edit, setEdit] = useState<ModifierGroupView | null>(null);
  const groups = all.filter(
    (g) => !needle || [g.name, ...g.modifiers.map((m) => m.name)].some((n) => n.toLocaleLowerCase('ru').includes(needle)),
  );
  // знак валюты филиала обратно в код: «₸» это тенге, остальные валюты currencySign отдаёт кодом
  const currency = ctx.currencyHint === '₸' ? 'KZT' : ctx.currencyHint;
  const used = (id: string) => items.filter((m) => (m.modifierGroupIds ?? []).includes(id)).length;
  return (
    <>
      {all.length > 0 && groups.length === 0 ? (
        <p className="muted food-mod-empty">{t('Группы не найдены')}</p>
      ) : groups.length === 0 ? (
        <p className="muted food-mod-empty">
          {t('Групп пока нет. Создайте «Размер» (обязательно, одно) или «Добавки» (по желанию), затем отметьте их в окне блюда.')}
        </p>
      ) : (
        <Table density="compact" caption={t('Группы добавок')} captionHidden>
          <thead>
            <tr>
              <th scope="col">{t('Группа')}</th>
              <th scope="col">{t('Выбор')}</th>
              <th scope="col">{t('Добавки')}</th>
              <th scope="col" className="num">
                {t('Блюд')}
              </th>
              <th scope="col">{t('Статус')}</th>
              <th scope="col">
                <span className="sr-only">{t('Действия')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} data-testid="modifier-group-row">
                <td>
                  <strong>{g.name}</strong>
                </td>
                <td>{choiceLabel(g, t)}</td>
                <td className="food-mod-names">
                  {g.modifiers
                    .filter((m) => m.active)
                    .map((m) => {
                      const used = (m.ingredients ?? []).map((i) => `${i.productName} ${i.normQty.replace('.', ',')} ${i.unit}`).join(', ');
                      return `${m.name} ${deltaText(m.priceDeltaMinor, currency)}${used ? ` (${used})` : ''}`.trim();
                    })
                    .join(', ') || '—'}
                </td>
                <td className="num">{used(g.id)}</td>
                <td>{g.active ? <Badge tone="ok">{t('Включена')}</Badge> : <Badge>{t('Выключена')}</Badge>}</td>
                <td>
                  {ctx.write && (
                    <Button tone="ghost" size="sm" aria-label={t('Изменить группу: {name}', { name: g.name })} onClick={() => setEdit(g)}>
                      {t('Изменить')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {(adding || edit) && (
        <ModifierGroupDrawer
          ctx={ctx}
          group={edit}
          stock={stock}
          close={() => {
            setEdit(null);
            setAdding(false);
          }}
        />
      )}
    </>
  );
}

/** Раздел «Добавки и размеры» в окне блюда: какие группы предлагать при заказе */
export function DishModifierGroups({ groups, value, onChange }: { groups: ModifierGroupView[]; value: string[]; onChange: (ids: string[]) => void }) {
  const t = useT();
  return (
    <fieldset className="food-mod-group" data-testid="dish-modifier-groups">
      <legend>{t('Добавки и размеры')}</legend>
      {groups.length === 0 ? (
        <p className="muted">{t('Групп добавок пока нет: их создают на вкладке «Добавки».')}</p>
      ) : (
        groups.map((g) => (
          <label key={g.id} className="food-mod-option">
            <input
              type="checkbox"
              checked={value.includes(g.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, g.id] : value.filter((x) => x !== g.id))}
            />
            <span>{g.name}</span>
            <small>{choiceLabel(g, t)}</small>
          </label>
        ))
      )}
    </fieldset>
  );
}

/**
 * «Разделить счёт» (§33.7): «Поровну» делит остаток на N гостей (остаток тиынов первому), каждая часть проводится
 * обычной оплатой; «По позициям» оплачивает отмеченные неоплаченные позиции, позиция не оплачивается дважды.
 */
export function SplitBill({
  scopeKey,
  order,
  onSaved,
  close,
}: {
  scopeKey: string;
  order: OrderView;
  onSaved: (order: OrderView) => void;
  close: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<'even' | 'items'>('even');
  const [guests, setGuests] = useState(String(Math.max(2, order.guestCount)));
  const [paidParts, setPaidParts] = useState(0);
  const [method, setMethod] = useState<FoodPaymentMethod>('CASH');
  // §21.7: деление счёта платит только включёнными в филиале способами
  const accepted = useBranchPaymentMethods(scopeKey);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const remaining = BigInt(order.totalMinor) - BigInt(order.paidMinor);
  const n = Number(guests);
  const parts = useMemo(() => {
    const left = n - paidParts;
    if (!Number.isInteger(n) || left < 1 || remaining <= 0n) return null;
    try {
      return splitEvenly(remaining, left);
    } catch {
      return null;
    }
  }, [n, paidParts, remaining]);
  const unpaid = order.items.filter((i) => !i.paid);
  const pickedSum = unpaid
    .filter((i) => picked.includes(i.id))
    .reduce((sum, i) => sum + BigInt(i.priceMinor) * BigInt(i.qty), 0n);
  const closed = order.status === 'CLOSED';
  function pay(amount: bigint, itemIds?: string[]) {
    setError('');
    start(async () => {
      const result = await mutateOrder(scopeKey, {
        kind: 'pay',
        id: order.id,
        body: { method, amount: Number(amount), idempotencyKey: crypto.randomUUID(), ...(itemIds ? { itemIds } : {}) },
      });
      if (result.error) {
        setError(result.error);
        if (result.stale) router.refresh();
      } else if (result.order) {
        if (!itemIds) setPaidParts((p) => p + 1);
        setPicked([]);
        onSaved(result.order);
        router.refresh();
      }
    });
  }
  return (
    <Overlay open onClose={close} title={t('Разделить счёт №{n}', { n: order.number })} drawer trapFocus>
      <div className="food-form food-split" data-testid="split-bill">
        {error && <Alert>{error}</Alert>}
        <nav className="tabs" aria-label={t('Как делить')}>
          <button className="tabs__item" type="button" aria-current={mode === 'even' ? 'page' : undefined} onClick={() => setMode('even')}>
            {t('Поровну')}
          </button>
          <button className="tabs__item" type="button" aria-current={mode === 'items' ? 'page' : undefined} onClick={() => setMode('items')}>
            {t('По позициям')}
          </button>
        </nav>
        <p className="food-split-left">
          {t('Осталось оплатить:')} <strong data-testid="split-remaining">{formatMoney(remaining, order.currency)}</strong>
        </p>
        {closed && <Alert tone="success">{t('Счёт оплачен полностью, заказ закрыт.')}</Alert>}
        {!closed && remaining > 0n && (
          <Field label={t('Способ оплаты')}>
            <Select value={method} onChange={(e) => setMethod(e.target.value as FoodPaymentMethod)}>
              {branchMethodsShown(FOOD_PAYMENT_METHODS, accepted, method).map((m) => (
                <option key={m} value={m}>
                  {t(METHOD_RU[m] ?? m)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {!closed && remaining > 0n && mode === 'even' && (
          <>
            <Field label={t('Гостей')}>
              <Input
                type="number"
                min={2}
                max={50}
                value={guests}
                onChange={(e) => {
                  setGuests(e.target.value);
                  setPaidParts(0);
                }}
              />
            </Field>
            {parts ? (
              <ul className="food-split-list" data-testid="split-even">
                {parts.map((amount, index) => (
                  <li key={index}>
                    <span>{t('Гость {n}', { n: paidParts + index + 1 })}</span>
                    <strong>{formatMoney(amount, order.currency)}</strong>
                    {index === 0 && (
                      <Button disabled={pending} onClick={() => pay(amount)}>
                        {t('Принять {sum}', { sum: formatMoney(amount, order.currency) })}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t('Укажите от 2 до 50 гостей.')}</p>
            )}
            {paidParts > 0 && <p className="muted">{t('Оплатили гостей: {n}.', { n: paidParts })}</p>}
          </>
        )}
        {!closed && remaining > 0n && mode === 'items' && (
          <>
            {unpaid.length === 0 ? (
              <p className="muted">{t('Все позиции уже оплачены по позициям. Остаток можно принять поровну.')}</p>
            ) : (
              <ul className="food-split-list" data-testid="split-items">
                {unpaid.map((i) => (
                  <li key={i.id}>
                    <label className="food-mod-option">
                      <input
                        type="checkbox"
                        aria-label={t('Оплатить: {name}', { name: i.name })}
                        checked={picked.includes(i.id)}
                        onChange={(e) => setPicked(e.target.checked ? [...picked, i.id] : picked.filter((x) => x !== i.id))}
                      />
                      <span>
                        {i.name} ×{i.qty}
                        <LineModifiers modifiers={i.modifiers} notes={i.notes} />
                      </span>
                      <small>{formatMoney(BigInt(i.priceMinor) * BigInt(i.qty), order.currency)}</small>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {order.items.some((i) => i.paid) && (
              <p className="muted">
                {t('Оплачено по позициям: {list}.', { list: order.items.filter((i) => i.paid).map((i) => i.name).join(', ') })}
              </p>
            )}
            <Button
              data-testid="split-items-pay"
              disabled={pending || pickedSum === 0n || pickedSum > remaining}
              onClick={() => pay(pickedSum, picked)}
            >
              {t('Оплатить выбранное: {sum}', { sum: formatMoney(pickedSum, order.currency) })}
            </Button>
          </>
        )}
        {order.status !== 'SERVED' && !closed && remaining === 0n && (
          <p className="muted">{t('Оплачено полностью: заказ закроется сам, когда его подадут.')}</p>
        )}
        <div className="food-actions">
          <Button tone="secondary" onClick={close}>
            {t('Готово')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
