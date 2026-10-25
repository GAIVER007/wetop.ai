'use client';
import { useState } from 'react';
import { IconField } from '../../components/icon-field';
import { Icon } from '../../components/icon';
import { Button, EmptyState, Field, Input } from '../../components/ui';
import { useT } from '../../i18n/locale-provider';
import { wholeTenge } from '../../lib/dashboard-format';
import type { MenuCategory, MenuItemView, OrderItemInput } from '../../lib/food-types';
import { addCartLine, cartLineKey, cartLinePrice } from '../../lib/food-modifiers';
import { LineModifiers, ModifierPicker } from './modifier-parts';

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
  const t = useT();
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  // §33.7: блюдо с группами добавок открывает выбор добавок и комментария
  const [choosing, setChoosing] = useState<MenuItemView | null>(null);
  const q = query.trim().toLocaleLowerCase('ru');
  const dishes = ctx.menuItems.filter(
    (m) =>
      m.active &&
      (!category || m.categoryId === category) &&
      (!q || m.name.toLocaleLowerCase('ru').includes(q)),
  );
  const add = (dish: MenuItemView) => {
    if (dish.modifierGroups?.length) return setChoosing(dish);
    setItems(addCartLine(items, { menuItemId: dish.id, qty: 1 }));
  };
  return (
    <div className="rest-pos-menu">
      <nav className="tabs" aria-label={t('Категории меню')}>
        <button className="tabs__item" type="button" aria-current={!category ? 'page' : undefined} onClick={() => setCategory('')}>
          {t('Все блюда')}
        </button>
        {ctx.categories
          .filter((c) => c.active)
          .map((c) => (
            <button className="tabs__item"
              key={c.id}
              type="button"
              aria-current={category === c.id ? 'page' : undefined}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
      </nav>
      <Field label={<span className="sr-only">{t('Поиск блюда')}</span>}>
        <IconField icon="search">
          <Input
            type="search"
            placeholder={t('Поиск блюда')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </IconField>
      </Field>
      {dishes.length === 0 ? (
        <EmptyState title={t('Блюд не найдено')} />
      ) : (
        <div className="rest-pos-grid">
          {dishes.map((m) => (
            <button
              type="button"
              className="rest-pos-dish"
              key={m.id}
              aria-label={t('Добавить: {name}, {price}', { name: m.name, price: wholeTenge(m.priceMinor, m.currency) })}
              onClick={() => add(m)}
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
              {m.modifierGroups?.length ? <small className="food-mod-hint">{t('с выбором')}</small> : null}
            </button>
          ))}
        </div>
      )}
      {choosing && (
        <ModifierPicker
          dish={choosing}
          onSubmit={(line) => setItems(addCartLine(items, line))}
          close={() => setChoosing(null)}
        />
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
  const t = useT();
  const byId = new Map(ctx.menuItems.map((m) => [m.id, m]));
  // §33.7: цена строки с добавками
  const total = items.reduce((acc, i) => acc + cartLinePrice(byId.get(i.menuItemId), i.modifierIds) * BigInt(i.qty), 0n);
  const [editing, setEditing] = useState<number | null>(null);
  const modifierName = (dishId: string, id: string) =>
    byId.get(dishId)?.modifierGroups?.flatMap((g) => g.modifiers).find((m) => m.id === id)?.name ?? '';
  const change = (index: number, qty: number) => {
    if (qty <= 0) setItems(items.filter((_, i) => i !== index));
    else setItems(items.map((item, i) => (i === index ? { ...item, qty } : item)));
  };
  return (
    <div className="rest-order-items">
      <h3>
        {t('Текущий заказ')} <small>({items.reduce((acc, i) => acc + i.qty, 0)})</small>
      </h3>
      {items.length === 0 && <p className="muted">{t('Выберите блюда слева')}</p>}
      {items.map((item, index) => {
        const m = byId.get(item.menuItemId);
        return (
          <div className="rest-order-item rest-order-item--pos" key={cartLineKey(item)}>
            <span className="rest-order-qty">
              <Button tone="ghost" aria-label={t('Меньше')} onClick={() => change(index, item.qty - 1)}>
                −
              </Button>
              <span aria-label={t('Количество')}>{item.qty}</span>
              <Button tone="ghost" aria-label={t('Больше')} onClick={() => change(index, item.qty + 1)}>
                +
              </Button>
            </span>
            <strong>
              {m?.name ?? t('Блюдо')}
              <LineModifiers modifiers={(item.modifierIds ?? []).map((id) => ({ name: modifierName(item.menuItemId, id) }))} notes={item.notes} />
            </strong>
            {m && (
              <Button tone="ghost" size="sm" aria-label={t('Выбор и комментарий: {name}', { name: m.name })} onClick={() => setEditing(index)}>
                ✎
              </Button>
            )}
            <span className="rest-tech-cost">
              {m ? wholeTenge(String(cartLinePrice(m, item.modifierIds) * BigInt(item.qty)), m.currency) : '—'}
            </span>
          </div>
        );
      })}
      {editing !== null && items[editing] && byId.get(items[editing]!.menuItemId) && (
        <ModifierPicker
          dish={byId.get(items[editing]!.menuItemId)!}
          initial={items[editing]}
          submitLabel={t('Сохранить')}
          onSubmit={(line) => setItems(addCartLine(items.filter((_, i) => i !== editing), line))}
          close={() => setEditing(null)}
        />
      )}
      <div className="rest-order-total">
        <span>{t('Итого')}</span>
        <strong data-testid="order-draft-total">{wholeTenge(String(total))}</strong>
      </div>
    </div>
  );
}
