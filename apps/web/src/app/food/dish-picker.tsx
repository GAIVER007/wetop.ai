'use client';
import { useState } from 'react';
import { IconField } from '../../components/icon-field';
import { Icon } from '../../components/icon';
import { Button, Field, Input } from '../../components/ui';
import { wholeTenge } from '../../lib/dashboard-format';
import type { MenuCategory, MenuItemView, OrderItemInput } from '../../lib/food-types';

/**
 * Выбор блюд и текущий заказ (макет POS, экран 5): общий для формы заказа у стойки (`order-drawer.tsx`) и телефонного
 * экрана официанта (`/waiter`, §33.6). Нужны только категории и блюда меню.
 */
export interface MenuContext {
  categories: MenuCategory[];
  menuItems: MenuItemView[];
}

/** Выбор блюд по макету POS (экран 5): вкладки категорий, поиск, плитки с фото и ценой; щелчок добавляет порцию */
export function DishPicker({
  ctx,
  items,
  setItems,
}: {
  ctx: MenuContext;
  items: OrderItemInput[];
  setItems: (items: OrderItemInput[]) => void;
}) {
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase('ru');
  const dishes = ctx.menuItems.filter(
    (m) =>
      m.active &&
      (!category || m.categoryId === category) &&
      (!q || m.name.toLocaleLowerCase('ru').includes(q)),
  );
  const add = (id: string) => {
    const index = items.findIndex((i) => i.menuItemId === id);
    if (index >= 0)
      setItems(items.map((item, i) => (i === index ? { ...item, qty: item.qty + 1 } : item)));
    else setItems([...items, { menuItemId: id, qty: 1 }]);
  };
  return (
    <div className="rest-pos-menu">
      <nav className="rest-utabs" aria-label="Категории меню">
        <button type="button" aria-current={!category ? 'page' : undefined} onClick={() => setCategory('')}>
          Все блюда
        </button>
        {ctx.categories
          .filter((c) => c.active)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              aria-current={category === c.id ? 'page' : undefined}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
      </nav>
      <Field label={<span className="sr-only">Поиск блюда</span>}>
        <IconField icon="search">
          <Input
            type="search"
            placeholder="Поиск блюда"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </IconField>
      </Field>
      {dishes.length === 0 ? (
        <p className="muted">Блюд не найдено</p>
      ) : (
        <div className="rest-pos-grid">
          {dishes.map((m) => (
            <button
              type="button"
              className="rest-pos-dish"
              key={m.id}
              aria-label={`Добавить: ${m.name}, ${wholeTenge(m.priceMinor, m.currency)}`}
              onClick={() => add(m.id)}
            >
              {m.photoUrl ? (
                <img src={m.photoUrl} alt="" width={160} height={120} />
              ) : (
                <span className="rest-pos-dish__ph" aria-hidden="true">
                  <Icon name="kettle" />
                </span>
              )}
              <span className="rest-pos-dish__name">{m.name}</span>
              <strong>{wholeTenge(m.priceMinor, m.currency)}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Текущий заказ справа: строки с количеством, итог по ценам меню */
export function CurrentOrder({
  ctx,
  items,
  setItems,
}: {
  ctx: MenuContext;
  items: OrderItemInput[];
  setItems: (items: OrderItemInput[]) => void;
}) {
  const byId = new Map(ctx.menuItems.map((m) => [m.id, m]));
  const total = items.reduce(
    (acc, i) => acc + BigInt(byId.get(i.menuItemId)?.priceMinor ?? '0') * BigInt(i.qty),
    0n,
  );
  const change = (index: number, qty: number) => {
    if (qty <= 0) setItems(items.filter((_, i) => i !== index));
    else setItems(items.map((item, i) => (i === index ? { ...item, qty } : item)));
  };
  return (
    <div className="rest-order-items">
      <h3>
        Текущий заказ <small>({items.reduce((acc, i) => acc + i.qty, 0)})</small>
      </h3>
      {items.length === 0 && <p className="muted">Выберите блюда слева</p>}
      {items.map((item, index) => {
        const m = byId.get(item.menuItemId);
        return (
          <div className="rest-order-item rest-order-item--pos" key={item.menuItemId}>
            <span className="rest-order-qty">
              <Button tone="ghost" aria-label="Меньше" onClick={() => change(index, item.qty - 1)}>
                −
              </Button>
              <span aria-label="Количество">{item.qty}</span>
              <Button tone="ghost" aria-label="Больше" onClick={() => change(index, item.qty + 1)}>
                +
              </Button>
            </span>
            <strong>{m?.name ?? 'Блюдо'}</strong>
            <span className="rest-tech-cost">
              {m ? wholeTenge(String(BigInt(m.priceMinor) * BigInt(item.qty)), m.currency) : '—'}
            </span>
          </div>
        );
      })}
      <div className="rest-order-total">
        <span>Итого</span>
        <strong data-testid="order-draft-total">{wholeTenge(String(total))}</strong>
      </div>
    </div>
  );
}
