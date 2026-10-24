'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { CatalogGroupRow, groupCatalog } from '../../components/catalog-table';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Table,
  Textarea,
} from '../../components/ui';
import { Icon } from '../../components/icon';
import { IconField } from '../../components/icon-field';
import { wholeTenge } from '../../lib/dashboard-format';
import type { IngredientInput, MenuCategory, MenuItemView, MenuStation, ModifierGroupView } from '../../lib/food-types';
import { dishPhoto, mutateMenu } from './restaurant-actions';
import { DishModifierGroups, ModifierGroupsTable } from './modifier-parts';

interface Ctx {
  scopeKey: string;
  write: boolean;
  currencyHint: string;
}

const UNITS = ['г', 'мл', 'шт'] as const;
type Row = {
  name: string;
  normQty: string;
  unit: (typeof UNITS)[number];
  unitCost: string;
  /** §38: ингредиент склада той же единицы; «Готово» по заказу списывает его */
  productId: string | null;
};
type StockOption = { id: string; name: string; unit: string };

/** Предварительный счёт в тенге для живой строки; точный целочисленный счёт делает API (§33.1) */
function rowCost(row: Row): number {
  const qty = Number(row.normQty.replace(',', '.'));
  const cost = Number(row.unitCost);
  if (!Number.isFinite(qty) || !Number.isFinite(cost) || qty <= 0 || cost < 0) return 0;
  return row.unit === 'шт' ? qty * cost : (qty * cost) / 1000;
}

/** Фото блюда (§37): превью, загрузка заменяет прежнее, «Убрать фото» */
function DishPhoto({ ctx, item }: { ctx: Ctx; item: MenuItemView }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const run = (form: FormData | null) =>
    start(async () => {
      const result = await dishPhoto(ctx.scopeKey, item.id, form);
      if (result.error) setError(result.error);
      else {
        setError('');
        router.refresh();
      }
    });
  return (
    <section className="rest-dish-photo" aria-label="Фото блюда" data-testid="dish-photo">
      {error && <Alert>{error}</Alert>}
      {item.photoUrl ? (
        <img src={item.photoUrl} alt={item.name} width={160} height={120} />
      ) : (
        <p className="muted">Фото пока нет. JPEG, PNG или WebP до 10 МБ.</p>
      )}
      <form action={(form) => run(form)} className="food-actions">
        <Input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Файл фото блюда"
        />
        <Button type="submit" disabled={pending}>
          {item.photoUrl ? 'Заменить фото' : 'Загрузить фото'}
        </Button>
        {item.photoUrl && (
          <Button tone="secondary" disabled={pending} onClick={() => run(null)}>
            Убрать фото
          </Button>
        )}
      </form>
    </section>
  );
}

function DishDrawer({
  ctx,
  categories,
  item,
  modifierGroups,
  close,
}: {
  ctx: Ctx;
  categories: MenuCategory[];
  item: MenuItemView | null;
  /** §33.7: группы добавок бизнеса для раздела «Добавки и размеры» */
  modifierGroups: ModifierGroupView[];
  close: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [name, setName] = useState(item?.name ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? '');
  const [price, setPrice] = useState(item ? String(BigInt(item.priceMinor) / 100n) : '');
  const [weight, setWeight] = useState(item?.weightGrams ? String(item.weightGrams) : '');
  const [groupIds, setGroupIds] = useState<string[]>(item?.modifierGroupIds ?? []);
  function submit() {
    setError('');
    const priceMinor = Math.round(Number(price)) * 100;
    if (!name.trim() || !categoryId || !Number.isFinite(priceMinor) || priceMinor < 0) {
      setError('Заполните название, категорию и цену');
      return;
    }
    start(async () => {
      const body = {
        name: name.trim(),
        categoryId,
        price: priceMinor,
        weightGrams: weight.trim() ? Number(weight) : null,
      };
      const result = await mutateMenu(
        ctx.scopeKey,
        item ? { kind: 'item', id: item.id, body } : { kind: 'item', body },
      );
      if (result.error) return setError(result.error);
      // §33.7: группы добавок сохраняются, только если их меняли (и у нового блюда, если отмечены)
      const before = item?.modifierGroupIds ?? [];
      const id = item?.id ?? result.item?.id;
      if (id && groupIds.join(',') !== before.join(',')) {
        const groups = await mutateMenu(ctx.scopeKey, { kind: 'item-modifier-groups', id, groupIds });
        if (groups.error) return setError(groups.error);
      }
      router.refresh();
      close();
    });
  }
  return (
    <Overlay
      open
      onClose={close}
      title={item ? 'Изменить блюдо' : 'Новое блюдо'}
      drawer
      className="food-drawer"
      trapFocus
    >
      <div className="food-form" data-testid="dish-drawer">
        {error && <Alert>{error}</Alert>}
        <Field label="Название">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="food-form-row">
          <Field label="Категория">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Цена, ${ctx.currencyHint}`}>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>
        <Field label="Выход, г">
          <Input type="number" min={1} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
        <DishModifierGroups groups={modifierGroups.filter((g) => g.active || groupIds.includes(g.id))} value={groupIds} onChange={setGroupIds} />
        {item && ctx.write && <DishPhoto ctx={ctx} item={item} />}
        <div className="food-actions">
          <Button disabled={pending} onClick={submit}>
            Сохранить
          </Button>
          <Button tone="secondary" disabled={pending} onClick={close}>
            Отмена
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

function TechCardDrawer({
  ctx,
  item,
  stock,
  close,
}: {
  ctx: Ctx;
  item: MenuItemView;
  stock: StockOption[];
  close: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(
    (item.ingredients ?? []).map((i) => ({
      name: i.name,
      normQty: i.normQty,
      unit: (UNITS as readonly string[]).includes(i.unit) ? (i.unit as Row['unit']) : 'г',
      unitCost: String(BigInt(i.unitCostMinor) / 100n),
      productId: i.productId ?? null,
    })),
  );
  const [tech, setTech] = useState(item.techNotes ?? '');
  const priceTenge = Number(BigInt(item.priceMinor) / 100n);
  const cost = rows.reduce((acc, r) => acc + rowCost(r), 0);
  const profit = priceTenge - cost;
  const foodCost = priceTenge > 0 ? Math.round((cost / priceTenge) * 100) : null;
  const margin = cost > 0 ? Math.round((profit / cost) * 100) : null;
  const set = (index: number, patch: Partial<Row>) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  function save() {
    setError('');
    const ingredients: IngredientInput[] = [];
    for (const r of rows) {
      const qty = r.normQty.replace(',', '.').trim();
      const cost = Math.round(Number(r.unitCost)) * 100;
      if (!r.name.trim() || !qty || !Number.isFinite(cost) || cost < 0) {
        setError('У каждой строки нужны название, норма и цена');
        return;
      }
      ingredients.push({
        name: r.name.trim(),
        normQty: qty,
        unit: r.unit,
        unitCost: cost,
        productId: r.productId,
      });
    }
    start(async () => {
      const replaced = await mutateMenu(ctx.scopeKey, {
        kind: 'ingredients',
        id: item.id,
        ingredients,
      });
      if (replaced.error) {
        setError(replaced.error);
        return;
      }
      const notes = await mutateMenu(ctx.scopeKey, {
        kind: 'item',
        id: item.id,
        body: { techNotes: tech.trim() ? tech : null },
      });
      if (notes.error) {
        setError(notes.error);
        return;
      }
      router.refresh();
      close();
    });
  }
  return (
    <Overlay
      open
      onClose={close}
      title={`Калькуляция: ${item.name}`}
      drawer
      size="lg"
      className="food-drawer"
      trapFocus
    >
      <div className="food-form" data-testid="tech-card">
        {error && <Alert>{error}</Alert>}
        <h3>Ингредиенты</h3>
        <div className="rest-tech-grid rest-tech-head" aria-hidden="true">
          <span>Ингредиент</span>
          <span>Норма</span>
          <span>Ед.</span>
          <span>Цена за ед., {ctx.currencyHint}</span>
          <span className="rest-tech-cost">Стоимость</span>
          <span />
        </div>
        {rows.map((r, index) => (
          <div className="rest-tech-grid" key={index}>
            <Input
              aria-label={`Ингредиент ${index + 1}`}
              value={r.name}
              onChange={(e) => set(index, { name: e.target.value })}
            />
            <Input
              aria-label="Норма"
              inputMode="decimal"
              value={r.normQty}
              onChange={(e) => set(index, { normQty: e.target.value })}
            />
            <Select
              aria-label="Единица"
              value={r.unit}
              onChange={(e) => set(index, { unit: e.target.value as Row['unit'], productId: null })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Цена за единицу"
              type="number"
              min={0}
              value={r.unitCost}
              onChange={(e) => set(index, { unitCost: e.target.value })}
            />
            <span className="rest-tech-cost">
              {wholeTenge(String(Math.round(rowCost(r) * 100)), item.currency)}
            </span>
            <Button
              tone="ghost"
              aria-label="Убрать строку"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            >
              ×
            </Button>
            {stock.length > 0 && (
              <Select
                className="rest-tech-link"
                aria-label={`Склад для строки ${index + 1}`}
                value={r.productId ?? ''}
                onChange={(e) => {
                  const p = stock.find((x) => x.id === e.target.value);
                  set(index, {
                    productId: p?.id ?? null,
                    ...(p && !r.name.trim() ? { name: p.name } : {}),
                  });
                }}
              >
                <option value="">Не списывать со склада</option>
                {stock
                  .filter((p) => p.unit === r.unit)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      Списывать со склада: {p.name}
                    </option>
                  ))}
              </Select>
            )}
          </div>
        ))}
        <Button
          tone="secondary"
          onClick={() =>
            setRows([...rows, { name: '', normQty: '', unit: 'г', unitCost: '', productId: null }])
          }
        >
          + Ингредиент
        </Button>
        <div className="rest-tech-totals" data-testid="tech-totals">
          <div>
            <small>Себестоимость</small>
            <strong>{wholeTenge(String(Math.round(cost * 100)), item.currency)}</strong>
          </div>
          <div>
            <small>Цена в меню</small>
            <strong>{wholeTenge(item.priceMinor, item.currency)}</strong>
          </div>
          <div>
            <small>Наценка</small>
            <strong>{margin === null ? '—' : `${margin} %`}</strong>
          </div>
          <div>
            <small>Прибыль</small>
            <strong>{wholeTenge(String(Math.round(profit * 100)), item.currency)}</strong>
          </div>
          <div>
            <small>Себестоимость, %</small>
            <strong>{foodCost === null ? '—' : `${foodCost} %`}</strong>
          </div>
        </div>
        <Field label="Технология приготовления">
          <Textarea rows={4} value={tech} onChange={(e) => setTech(e.target.value)} />
        </Field>
        <div className="food-actions">
          {ctx.write ? (
            <Button disabled={pending} onClick={save}>
              Сохранить техкарту
            </Button>
          ) : null}
          <Button tone="secondary" disabled={pending} onClick={close}>
            Закрыть
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

export function MenuBoard({
  ctx,
  categories,
  items,
  stock = [],
  modifierGroups = [],
}: {
  ctx: Ctx;
  categories: MenuCategory[];
  items: MenuItemView[];
  /** §33.7: группы добавок бизнеса (вкладка «Добавки») */
  modifierGroups?: ModifierGroupView[];
  /** Ингредиенты склада для связи строк техкарты (§38); пусто, если склада нет */
  stock?: StockOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [category, setCategory] = useState('');
  const [view, setView] = useState<'items' | 'categories' | 'modifiers'>('items');
  const [newGroup, setNewGroup] = useState(false);
  const [search, setSearch] = useState('');
  const [dish, setDish] = useState<MenuItemView | null | 'new'>(null);
  const [tech, setTech] = useState<MenuItemView | null>(null);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [newStation, setNewStation] = useState<MenuStation>('KITCHEN');
  const needle = search.trim().toLocaleLowerCase('ru');
  const list = items.filter(
    (m) =>
      (!category || m.categoryId === category) &&
      (!needle || m.name.toLocaleLowerCase('ru').includes(needle)),
  );
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  function toggle(item: MenuItemView) {
    setError('');
    start(async () => {
      const result = await mutateMenu(ctx.scopeKey, {
        kind: 'item',
        id: item.id,
        body: { active: !item.active },
      });
      if (result.error) setError(result.error);
      router.refresh();
    });
  }
  function addCategory() {
    const name = (newCategory ?? '').trim();
    if (!name) return;
    setError('');
    start(async () => {
      const result = await mutateMenu(ctx.scopeKey, { kind: 'category', body: { name, station: newStation } });
      if (result.error) setError(result.error);
      else {
        setNewCategory(null);
        setNewStation('KITCHEN');
      }
      router.refresh();
    });
  }
  /** Станция категории (§33.6): куда уходят её позиции, «Кухня» или «Бар»; отправленные позиции не переезжают */
  function setStation(c: MenuCategory, station: MenuStation) {
    setError('');
    start(async () => {
      const result = await mutateMenu(ctx.scopeKey, { kind: 'category', id: c.id, body: { station } });
      if (result.error) setError(result.error);
      router.refresh();
    });
  }
  return (
    <div className="food-workspace" data-testid="menu-board">
      {error && <Alert>{error}</Alert>}
      <div className="rest-bar">
        <nav className="tabs" aria-label="Меню">
          <button className="tabs__item"
            type="button"
            aria-current={view === 'items' ? 'page' : undefined}
            onClick={() => setView('items')}
          >
            Позиции ({items.length})
          </button>
          <button className="tabs__item"
            type="button"
            aria-current={view === 'categories' ? 'page' : undefined}
            onClick={() => setView('categories')}
          >
            Категории ({categories.filter((c) => c.active).length})
          </button>
          <button className="tabs__item"
            type="button"
            aria-current={view === 'modifiers' ? 'page' : undefined}
            onClick={() => setView('modifiers')}
          >
            Добавки ({modifierGroups.length})
          </button>
        </nav>
        {ctx.write && (
          <div className="food-inline-actions">
            <Button tone="secondary" onClick={() => setNewCategory('')}>
              + Категория
            </Button>
            <Button tone="secondary" onClick={() => { setView('modifiers'); setNewGroup(true); }}>
              + Группа добавок
            </Button>
            <Button
              onClick={() => setDish('new')}
              disabled={!categories.length}
              title={categories.length ? undefined : 'Сначала добавьте категорию'}
              aria-describedby={categories.length ? undefined : 'menu-no-category'}
            >
              + Добавить блюдо
            </Button>
            {!categories.length && (
              <span id="menu-no-category" className="muted">
                Сначала добавьте категорию
              </span>
            )}
          </div>
        )}
      </div>
      {newCategory !== null && (
        <div className="food-toolbar">
          <Field label="Название категории">
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          </Field>
          <Field label="Куда уходят заказы">
            <Select value={newStation} onChange={(e) => setNewStation(e.target.value as MenuStation)}>
              <option value="KITCHEN">Кухня</option>
              <option value="BAR">Бар</option>
            </Select>
          </Field>
          <Button disabled={pending} onClick={addCategory}>
            Сохранить
          </Button>
          <Button tone="ghost" onClick={() => setNewCategory(null)}>
            Отмена
          </Button>
        </div>
      )}
      <div className="rest-card">
        <div className="rest-card__tools">
          <Field label={<span className="sr-only">Поиск по блюдам</span>}>
            <IconField icon="search">
              <Input
                type="search"
                placeholder={view === 'modifiers' ? 'Поиск добавки' : 'Поиск блюда'}
                data-page-search
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </IconField>
          </Field>
          {view === 'items' && (
            <Field label={<span className="sr-only">Категория меню</span>}>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Все категории</option>
                {categories
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({items.filter((m) => m.categoryId === c.id).length})
                    </option>
                  ))}
              </Select>
            </Field>
          )}
        </div>
        {view === 'modifiers' ? (
          <ModifierGroupsTable ctx={ctx} groups={modifierGroups} items={items} adding={newGroup} setAdding={setNewGroup} needle={needle} stock={stock} />
        ) : view === 'categories' ? (
          <Table density="compact" caption="Категории меню" captionHidden>
            <thead>
              <tr>
                <th scope="col">Категория</th>
                <th scope="col">Станция</th>
                <th scope="col" className="num">
                  Блюд
                </th>
                <th scope="col" className="num">
                  В меню
                </th>
              </tr>
            </thead>
            <tbody>
              {categories
                .filter((c) => c.active && (!needle || c.name.toLocaleLowerCase('ru').includes(needle)))
                .map((c) => {
                  const dishes = items.filter((m) => m.categoryId === c.id);
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>
                        {ctx.write ? (
                          <Select
                            aria-label={`Станция: ${c.name}`}
                            value={c.station ?? 'KITCHEN'}
                            disabled={pending}
                            onChange={(e) => setStation(c, e.target.value as MenuStation)}
                          >
                            <option value="KITCHEN">Кухня</option>
                            <option value="BAR">Бар</option>
                          </Select>
                        ) : c.station === 'BAR' ? (
                          'Бар'
                        ) : (
                          'Кухня'
                        )}
                      </td>
                      <td className="num">{dishes.length}</td>
                      <td className="num">{dishes.filter((m) => m.active).length}</td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>
        ) : list.length === 0 ? (
          <EmptyState
            title={items.length ? 'Блюда не найдены' : 'Меню пока пустое'}
            actions={
              ctx.write && !items.length ? (
                <Button onClick={() => (categories.length ? setDish('new') : setNewCategory(''))}>
                  {categories.length ? 'Добавить блюдо' : 'Сначала добавить категорию'}
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="rest-menu-list" data-testid="menu-list">
            <Table density="compact" caption="Блюда меню" captionHidden>
              <thead>
                <tr>
                  <th scope="col">Название</th>
                  <th scope="col">Категория</th>
                  <th scope="col" className="num">
                    Выход
                  </th>
                  <th scope="col" className="num">
                    Цена
                  </th>
                  <th scope="col" className="num">
                    Себестоимость, %
                  </th>
                  <th scope="col">Статус</th>
                  <th scope="col">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* «Все категории»: подзаголовки категорий (каталог A + B, решение 23.10.2026) */}
                {(category
                  ? [{ key: category, name: '', rows: list }]
                  : groupCatalog(list, (m) => m.categoryId, categories)
                ).flatMap((group) => [
                  ...(category
                    ? []
                    : [<CatalogGroupRow key={`g:${group.key}`} name={group.name} count={group.rows.length} columns={7} />]),
                  ...group.rows.map((m) => (
                  <tr className="rest-menu-row" key={m.id}>
                    <td>
                      <span className="rest-menu-name">
                        <span className="rest-menu-thumb" aria-hidden="true">
                          {m.photoUrl ? (
                            <img src={m.photoUrl} alt="" width={44} height={44} loading="lazy" />
                          ) : (
                            <Icon name="kettle" />
                          )}
                        </span>
                        <span>
                          <strong>{m.name}</strong>
                        </span>
                      </span>
                    </td>
                    <td>{categoryName.get(m.categoryId) ?? 'Без категории'}</td>
                    <td className="num">{m.weightGrams ? `${m.weightGrams} г` : '—'}</td>
                    <td className="num rest-menu-price">{wholeTenge(m.priceMinor, m.currency)}</td>
                    <td className="num">
                      {m.totals?.foodCostPct != null && m.totals.costMinor !== '0'
                        ? `${m.totals.foodCostPct} %`
                        : '—'}
                    </td>
                    <td>
                      <span className="rest-menu-status">
                        {m.active ? (
                          <Badge tone="ok">Активно</Badge>
                        ) : (
                          <Badge>Скрыто из меню</Badge>
                        )}
                        {ctx.write && (
                          <label className="switch">
                            <span className="switch__text">
                              <span className="switch__label sr-only">В меню</span>
                            </span>
                            <input
                              className="switch__input"
                              type="checkbox"
                              role="switch"
                              checked={m.active}
                              disabled={pending}
                              onChange={() => toggle(m)}
                            />
                            <span className="switch__track" aria-hidden="true" />
                          </label>
                        )}
                      </span>
                    </td>
                    <td>
                      <span className="rest-menu-actions">
                        <Button tone="secondary" size="sm" onClick={() => setTech(m)}>
                          Техкарта
                        </Button>
                        {ctx.write && (
                          <Button tone="ghost" size="sm" onClick={() => setDish(m)}>
                            Изменить
                          </Button>
                        )}
                      </span>
                    </td>
                  </tr>
                  )),
                ])}
              </tbody>
            </Table>
          </div>
        )}
      </div>
      {dish && (
        <DishDrawer
          ctx={ctx}
          categories={categories.filter((c) => c.active)}
          // свежее блюдо из списка: после загрузки фото список обновился, а снимок в состоянии нет
          item={dish === 'new' ? null : (items.find((i) => i.id === dish.id) ?? dish)}
          modifierGroups={modifierGroups}
          close={() => setDish(null)}
        />
      )}
      {tech && <TechCardDrawer stock={stock} ctx={ctx} item={tech} close={() => setTech(null)} />}
    </div>
  );
}
