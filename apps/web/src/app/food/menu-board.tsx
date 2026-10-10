'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
} from '../../components/ui';
import { Chip, ChipGroup } from '../../components/chip';
import { Icon } from '../../components/icon';
import { wholeTenge } from '../../lib/dashboard-format';
import type { IngredientInput, MenuCategory, MenuItemView } from '../../lib/food-types';
import { mutateMenu } from './restaurant-actions';

interface Ctx {
  scopeKey: string;
  write: boolean;
  currencyHint: string;
}

const UNITS = ['г', 'мл', 'шт'] as const;
type Row = { name: string; normQty: string; unit: (typeof UNITS)[number]; unitCost: string };

/** Предварительный счёт в тенге для живой строки; точный целочисленный счёт делает API (§33.1) */
function rowCost(row: Row): number {
  const qty = Number(row.normQty.replace(',', '.'));
  const cost = Number(row.unitCost);
  if (!Number.isFinite(qty) || !Number.isFinite(cost) || qty <= 0 || cost < 0) return 0;
  return row.unit === 'шт' ? qty * cost : (qty * cost) / 1000;
}

function DishDrawer({
  ctx,
  categories,
  item,
  close,
}: {
  ctx: Ctx;
  categories: MenuCategory[];
  item: MenuItemView | null;
  close: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [name, setName] = useState(item?.name ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? '');
  const [price, setPrice] = useState(item ? String(BigInt(item.priceMinor) / 100n) : '');
  const [weight, setWeight] = useState(item?.weightGrams ? String(item.weightGrams) : '');
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
      if (result.error) setError(result.error);
      else {
        router.refresh();
        close();
      }
    });
  }
  return (
    <Overlay open onClose={close} title={item ? 'Изменить блюдо' : 'Новое блюдо'} drawer className="food-drawer" trapFocus>
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
            <Input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Выход, г">
          <Input type="number" min={1} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
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
  close,
}: {
  ctx: Ctx;
  item: MenuItemView;
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
      ingredients.push({ name: r.name.trim(), normQty: qty, unit: r.unit, unitCost: cost });
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
              onChange={(e) => set(index, { unit: e.target.value as Row['unit'] })}
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
            <span className="rest-tech-cost">{wholeTenge(String(Math.round(rowCost(r) * 100)), item.currency)}</span>
            <Button
              tone="ghost"
              aria-label="Убрать строку"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          tone="secondary"
          onClick={() => setRows([...rows, { name: '', normQty: '', unit: 'г', unitCost: '' }])}
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
            <small>Food cost</small>
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
}: {
  ctx: Ctx;
  categories: MenuCategory[];
  items: MenuItemView[];
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [dish, setDish] = useState<MenuItemView | null | 'new'>(null);
  const [tech, setTech] = useState<MenuItemView | null>(null);
  const [newCategory, setNewCategory] = useState<string | null>(null);
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
      const result = await mutateMenu(ctx.scopeKey, { kind: 'category', body: { name } });
      if (result.error) setError(result.error);
      else setNewCategory(null);
      router.refresh();
    });
  }
  return (
    <div className="food-workspace" data-testid="menu-board">
      {error && <Alert>{error}</Alert>}
      <div className="food-section-heading">
        <ChipGroup label="Категория меню">
          <Chip selected={!category} onClick={() => setCategory('')} count={items.length}>
            Все блюда
          </Chip>
          {categories
            .filter((c) => c.active)
            .map((c) => (
              <Chip
                key={c.id}
                selected={category === c.id}
                count={items.filter((m) => m.categoryId === c.id).length}
                onClick={() => setCategory(c.id)}
              >
                {c.name}
              </Chip>
            ))}
        </ChipGroup>
        {ctx.write && (
          <div className="food-inline-actions">
            <Button onClick={() => setDish('new')} disabled={!categories.length}>
              + Добавить блюдо
            </Button>
            <Button tone="secondary" onClick={() => setNewCategory('')}>
              + Категория
            </Button>
          </div>
        )}
      </div>
      {newCategory !== null && (
        <div className="food-toolbar">
          <Field label="Название категории">
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          </Field>
          <Button disabled={pending} onClick={addCategory}>
            Сохранить
          </Button>
          <Button tone="ghost" onClick={() => setNewCategory(null)}>
            Отмена
          </Button>
        </div>
      )}
      <div className="food-toolbar">
        <Field label="Поиск по блюдам">
          <Input
            type="search"
            data-page-search
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
      </div>
      {list.length === 0 ? (
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
          {list.map((m) => (
            <div className="rest-menu-row" key={m.id}>
              <span className="rest-menu-thumb" aria-hidden="true">
                <Icon name="kettle" />
              </span>
              <div className="rest-menu-main">
                <strong>{m.name}</strong>
                <small>
                  {categoryName.get(m.categoryId) ?? 'Без категории'}
                  {m.weightGrams ? `, ${m.weightGrams} г` : ''}
                  {m.totals?.foodCostPct != null ? `, food cost ${m.totals.foodCostPct} %` : ''}
                </small>
              </div>
              <span className="rest-menu-price">{wholeTenge(m.priceMinor, m.currency)}</span>
              <span className="rest-menu-actions">
                {!m.active && <Badge>Скрыто из меню</Badge>}
                {ctx.write && (
                  <label className="switch">
                    <span className="switch__text">
                      <span className="switch__label">В меню</span>
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
                <Button tone="secondary" onClick={() => setTech(m)}>
                  Техкарта
                </Button>
                {ctx.write && (
                  <Button tone="ghost" onClick={() => setDish(m)}>
                    Изменить
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {dish && (
        <DishDrawer
          ctx={ctx}
          categories={categories.filter((c) => c.active)}
          item={dish === 'new' ? null : dish}
          close={() => setDish(null)}
        />
      )}
      {tech && <TechCardDrawer ctx={ctx} item={tech} close={() => setTech(null)} />}
    </div>
  );
}
