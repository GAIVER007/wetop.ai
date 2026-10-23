'use client';
import { useState } from 'react';
import { Icon } from '../../components/icon';
import { wholeTenge } from '../../lib/dashboard-format';
import type { MenuCategory, OrderView } from '../../lib/food-types';
import { KitchenBoard } from './kitchen-board';
import { OrderDrawer, type OrderContext, type OrderDraft } from './order-drawer';

/**
 * «Бар» по макету (экран 7) и станциям (§33.6): сверху экран бармена, только позиции станции BAR («Принять / Готово»
 * по строке), ниже витрина напитков вкладками категорий бара. Плитка открывает новый заказ с этим напитком.
 * Категории бара выбираются в «Меню» (станция «Бар»); пока их нет, витрина показывает всё меню.
 */
export function BarBoard({ ctx, orders }: { ctx: OrderContext; orders: OrderView[] }) {
  const barCats = ctx.categories.filter((c) => c.active && c.station === 'BAR');
  const cats: MenuCategory[] = barCats.length ? barCats : ctx.categories.filter((c) => c.active);
  const [category, setCategory] = useState(cats[0]?.id ?? '');
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const items = ctx.menuItems.filter((m) => m.active && m.categoryId === category);
  return (
    <div className="rest-bar-screen" data-testid="bar-board">
      <section className="rest-bar-orders" aria-label="Заказы бара">
        <KitchenBoard scopeKey={ctx.scopeKey} timezone={ctx.timezone} write={ctx.write} orders={orders} station="BAR" />
      </section>
      <section className="rest-bar-menu" aria-label="Напитки">
        <nav className="tabs" aria-label="Категории напитков">
          {cats.map((c) => (
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
        {items.length === 0 ? (
          <p className="muted">В этой категории пока нет позиций</p>
        ) : (
          <div className="rest-pos-grid">
            {items.map((m) => (
              <button
                type="button"
                className="rest-pos-dish"
                key={m.id}
                disabled={!ctx.write}
                aria-label={`Новый заказ: ${m.name}, ${wholeTenge(m.priceMinor, m.currency)}`}
                onClick={() => setDraft({ kind: 'create', items: [{ menuItemId: m.id, qty: 1 }] })}
              >
                {m.photoUrl ? (
                  <img src={m.photoUrl} alt="" width={160} height={120} />
                ) : (
                  <span className="rest-pos-dish__ph" aria-hidden="true">
                    <Icon name="breakfast" />
                  </span>
                )}
                <span className="rest-pos-dish__name">{m.name}</span>
                <strong>{wholeTenge(m.priceMinor, m.currency)}</strong>
              </button>
            ))}
          </div>
        )}
      </section>
      {draft && <OrderDrawer ctx={ctx} draft={draft} close={() => setDraft(null)} />}
    </div>
  );
}
