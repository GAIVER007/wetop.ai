'use client';
import { useState } from 'react';
import { Icon } from '../../components/icon';
import { BADGE_TONE, Badge } from '../../components/ui';
import { wholeTenge } from '../../lib/dashboard-format';
import { statusLabel, statusTone } from '../../lib/status/types';
import { foodOrderStatus } from '../../lib/status/food';
import type { MenuCategory, OrderView } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { OrderDrawer, type OrderContext, type OrderDraft } from './order-drawer';
import { tableTitle } from './timeline-board';

// ponytail: напитки узнаются по названию категории меню, флага «бар» в модели нет (Q-REST-9);
// если таких категорий нет, витрина показывает всё меню
const DRINK = /напит|бар|кокт|пив|вин|алког|виск|сок|кофе|чай|лимонад/i;

/**
 * «Бар» по макету (экран 7): слева текущие заказы с напитками, справа витрина напитков вкладками
 * категорий меню. Плитка открывает заказ с этим напитком, дальше обычный путь заказа и кухни (§33.2).
 */
export function BarBoard({ ctx, orders }: { ctx: OrderContext; orders: OrderView[] }) {
  const drinkCats = ctx.categories.filter((c) => c.active && DRINK.test(c.name));
  const cats: MenuCategory[] = drinkCats.length ? drinkCats : ctx.categories.filter((c) => c.active);
  const [category, setCategory] = useState(cats[0]?.id ?? '');
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const catIds = new Set(cats.map((c) => c.id));
  const drinkIds = new Set(ctx.menuItems.filter((m) => catIds.has(m.categoryId)).map((m) => m.id));
  const current = orders
    .filter((o) => o.status !== 'SERVED' && o.items.some((i) => i.menuItemId && drinkIds.has(i.menuItemId)))
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const items = ctx.menuItems.filter((m) => m.active && m.categoryId === category);
  const clock = (iso: string) => localInput(iso, ctx.timezone).slice(11, 16);
  return (
    <div className="rest-bar-screen" data-testid="bar-board">
      <section className="rest-bar-orders" aria-labelledby="bar-orders-title">
        <h2 id="bar-orders-title">
          Текущие заказы <small>({current.length})</small>
        </h2>
        {current.length === 0 ? (
          <p className="muted">Открытых заказов с напитками нет</p>
        ) : (
          current.map((o) => (
            <button
              type="button"
              key={o.id}
              className="rest-kds-card rest-bar-order"
              data-status={o.status}
              onClick={() => setDraft({ kind: 'view', order: o })}
            >
              <span className="rest-kds-head">
                <strong>№{o.number}</strong>
                <time dateTime={o.openedAt}>{clock(o.openedAt)}</time>
              </span>
              <span className="rest-kds-table">{o.table ? tableTitle(o.table.name) : 'Без стола'}</span>
              <ul className="rest-kds-items">
                {o.items
                  .filter((i) => i.menuItemId && drinkIds.has(i.menuItemId))
                  .map((i) => (
                    <li key={i.id}>
                      <span>{i.name}</span>
                      <b>×{i.qty}</b>
                    </li>
                  ))}
              </ul>
              <Badge tone={BADGE_TONE[statusTone(foodOrderStatus, o.status)]}>
                {statusLabel(foodOrderStatus, o.status)}
              </Badge>
            </button>
          ))
        )}
      </section>
      <section className="rest-bar-menu" aria-label="Напитки">
        <nav className="rest-utabs" aria-label="Категории напитков">
          {cats.map((c) => (
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
