'use client';
import { startTransition, useActionState, useMemo, useState, type ReactNode } from 'react';
import type { BarCategoryRow, BarMovementRow, BarStockRow, BarSupplierRow } from '../../lib/api';
import { formatMoney, minorToInput } from '../../lib/money';
import { usePropertyClock } from '../../components/property-time';
import { ActionMenu } from '../../components/action-menu';
import { Tabs } from '../../components/tabs';
import { useConfirm } from '../../components/use-confirm';
import { Badge, Button, Input, Select, Table, cx } from '../../components/ui';
import { Icon } from '../../components/icon';
import { useDeskVertical } from '../../components/desk-access';
import { stockWords } from '../../lib/stock-words';
import {
  archiveBarProductsAction,
  createBarProductAction,
  updateBarProductAction,
  writeOffBarAction,
  type BarActionResult,
} from './actions';
import { BarContextFields, type BarFormContext } from './context';
import { STATUS_LABEL, STATUS_TONE, recommendedPriceMinor, stockStatusOf } from './stock-status';
import { suggestCode } from './receipts/new/new-receipt';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/**
 * «Товары и остатки» с карточкой товара колонкой справа (ADR-157, макет владельца 09.10.2026). Слева доска
 * и нижний ряд (приходы, популярные), справа карточка выбранного товара: таблица остаётся на экране (§1 п. 5).
 */
const initial: BarActionResult = { error: null, ok: 0 };
/** Знак валюты в поле суммы: тенге значком, остальные кодом (как formatMoney) */
const currencySign = (currency: string) => (currency === 'KZT' ? '₸' : currency);
const PERIODS = [
  { id: 'all', label: msg('За все время'), days: null },
  { id: '30', label: msg('За 30 дней'), days: 30 },
  { id: '7', label: msg('За 7 дней'), days: 7 },
] as const;
const MOVEMENT_LABEL: Record<BarMovementRow['kind'], string> = {
  RECEIPT: msg('Приход'),
  SALE: msg('Продажа'),
  WRITE_OFF: msg('Списание'),
  SALE_RETURN: msg('Возврат'),
  INVENTORY_ADJUSTMENT: msg('Инвентаризация'),
};

const normalized = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const dayRu = (date: string | null) =>
  date ? `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}` : '';

/** Аватар товара: фотографии в модели нет, поэтому первая буква на цветной плашке, цвет от названия */
export function ProductAvatar({ name, size }: { name: string; size?: 'lg' }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const tones = ['primary', 'success', 'warning', 'danger', 'info'] as const;
  return (
    <span
      className={cx(
        'bar-avatar',
        `bar-avatar--${tones[hash % tones.length]}`,
        size === 'lg' && 'bar-avatar--lg',
      )}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function StockBoard({
  context,
  stock,
  categories,
  suppliers,
  movements,
  today,
  initialProduct,
  bottom,
  canCatalogMutate,
  canStockMutate,
}: {
  /** Объект и валюта для скрытых полей денежных форм (D-CUR) */
  context: BarFormContext;
  stock: BarStockRow[];
  categories: BarCategoryRow[];
  suppliers: BarSupplierRow[];
  movements: BarMovementRow[];
  today: string;
  /** `?product=` из адреса: id товара или `new` (кнопка «Добавить товар» в шапке) */
  initialProduct: string | null;
  /** Нижний ряд макета под таблицей: приходы и популярные товары (рисует сервер) */
  bottom: ReactNode;
  /** UI-FIX-01: право правки каталога (settings) и не режим чтения */
  canCatalogMutate: boolean;
  /** UI-FIX-01: право движения остатка (desk) и не режим чтения */
  canStockMutate: boolean;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ field: 'name' | 'stock'; descending: boolean } | null>(null);
  const toggleSort = (field: 'name' | 'stock') =>
    setSort((prev) => ({ field, descending: prev?.field === field ? !prev.descending : false }));
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('all');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<BarActionResult>(initial);
  const { ask, dialog } = useConfirm();
  const active = useMemo(() => stock.filter((item) => item.active), [stock]);
  const rows = useMemo(() => {
    const needle = normalized(query);
    const days = PERIODS.find((entry) => entry.id === period)?.days ?? null;
    const since = days === null ? null : shiftDate(today, -(days - 1));
    const filtered = active
      .filter(
        (item) =>
          !needle ||
          normalized(
            `${item.name} ${item.code} ${item.barcode ?? ''} ${item.lastSupplier?.name ?? ''}`,
          ).includes(needle),
      )
      .filter((item) => !categoryId || item.categoryId === categoryId)
      .filter((item) => !supplierId || item.lastSupplier?.id === supplierId)
      .filter((item) => !status || stockStatusOf(item) === status)
      .filter(
        (item) =>
          since === null || (item.lastReceivedDate !== null && item.lastReceivedDate >= since),
      );
    return !sort
      ? filtered
      : filtered.sort((a, b) => {
          const result =
            sort.field === 'name'
              ? a.name.localeCompare(b.name, 'ru')
              : BigInt(a.availableUnits) === BigInt(b.availableUnits)
                ? 0
                : BigInt(a.availableUnits) < BigInt(b.availableUnits)
                  ? -1
                  : 1;
          return sort.descending ? -result : result;
        });
  }, [active, query, categoryId, supplierId, status, period, today, sort]);
  const [selected, setSelected] = useState<string | null>(() =>
    initialProduct === 'new' || active.some((item) => item.id === initialProduct)
      ? initialProduct
      : null,
  );
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const current =
    selected && selected !== 'new' ? (active.find((item) => item.id === selected) ?? null) : null;
  const select = (id: string, writeOff = false) => {
    setSelected(id);
    setWriteOffOpen(writeOff);
  };
  const archive = async (ids: string[], title: string) => {
    if (!canCatalogMutate) return;
    if (
      !(await ask({
        title,
        body: t('Товар уйдёт в архив: остатки, приходы и продажи сохраняются, вернуть можно на вкладке «Товары».'),
        confirmLabel: t('Удалить в архив'),
        tone: 'danger',
      }))
    )
      return;
    startTransition(async () => {
      const result = await archiveBarProductsAction(ids);
      setBulk(result);
      setChecked(new Set());
      if (ids.includes(selected ?? '')) setSelected(null);
    });
  };
  const allChecked = rows.length > 0 && rows.every((item) => checked.has(item.id));
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className={cx('bar-main', selected && 'bar-main--editing')}>
      {dialog}
      <div className="bar-main-left">
        <section className="panel bar-board" aria-labelledby="bar-board-title">
          <header className="bar-board-head">
            <div className="bar-category-pills" role="group" aria-label={t('Категории товаров')}>
              <Button
                type="button"
                tone={categoryId === '' ? 'primary' : 'secondary'}
                aria-pressed={categoryId === ''}
                onClick={() => setCategoryId('')}
              >
                {t('Все товары')}
              </Button>
              {categories
                .filter((c) => c.active)
                .map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    tone={categoryId === c.id ? 'primary' : 'secondary'}
                    aria-pressed={categoryId === c.id}
                    onClick={() => setCategoryId(c.id)}
                  >
                    {c.name}
                  </Button>
                ))}
            </div>
            {canCatalogMutate && (
              <Button type="button" onClick={() => setSelected('new')}>
                <Icon name="plus" width={16} height={16} />
                {t('Добавить товар')}
              </Button>
            )}
          </header>
          <h2 id="bar-board-title" className="sr-only">
            {t('Товары и остатки')}
          </h2>
          <div className="bar-board-filters">
            <span className="bar-select-search bar-board-search">
              <Icon name="search" width={16} height={16} />
              <Input
                aria-label={t('Поиск товара')}
                placeholder={t('Поиск по названию, SKU или поставщику…')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </span>
            <Select
              aria-label={t('Категория')}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">{t('Все категории')}</option>
              {categories
                .filter((category) => category.active)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </Select>
            <Select
              aria-label={t('Поставщик')}
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">{t('Все поставщики')}</option>
              {suppliers
                .filter((supplier) => supplier.active)
                .map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
            </Select>
            <Select
              aria-label={t('Статус остатка')}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">{t('Все статусы')}</option>
              <option value="ok">{t('В норме')}</option>
              <option value="low">{t('Заканчивается')}</option>
              <option value="out">{t('Нет в наличии')}</option>
            </Select>
            <span className="bar-select-search">
              <Icon name="board" width={16} height={16} />
              <Select
                aria-label={t('Период последнего прихода')}
                value={period}
                onChange={(event) => setPeriod(event.target.value as typeof period)}
              >
                {PERIODS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {t(entry.label)}
                  </option>
                ))}
              </Select>
            </span>
          </div>
          <Button
            className="bar-reset"
            type="button"
            tone="ghost"
            onClick={() => {
              setQuery('');
              setCategoryId('');
              setSupplierId('');
              setStatus('');
              setPeriod('all');
            }}
          >
            {t('Сбросить фильтры')}
          </Button>
          {canCatalogMutate && checked.size > 0 && (
            <div className="bar-bulk" role="toolbar" aria-label={t('Отмеченные товары')}>
              <span>{t('Отмечено: {n}', { n: checked.size })}</span>
              <Button
                type="button"
                tone="danger"
                size="sm"
                onClick={() =>
                  void archive([...checked], t('Удалить отмеченные товары ({n})?', { n: checked.size }))
                }
              >
                <Icon name="trash" width={16} height={16} /> {t('Удалить')}
              </Button>
              <Button type="button" tone="ghost" size="sm" onClick={() => setChecked(new Set())}>
                {t('Снять отметку')}
              </Button>
            </div>
          )}
          {bulk.error && (
            <p role="alert" className="bar-error">
              {bulk.error}
            </p>
          )}
          {rows.length === 0 ? (
            <p className="bar-muted" role="status">
              {t('По такому отбору товаров нет. Снимите фильтры или добавьте товар.')}
            </p>
          ) : (
            <Table density="compact" sticky="header" aria-label={t('Товары и остатки бара')}>
              <thead>
                <tr>
                  {canCatalogMutate && (
                    <th className="bar-col-check">
                      <input
                        type="checkbox"
                        aria-label={t('Отметить все товары')}
                        checked={allChecked}
                        onChange={() =>
                          setChecked(allChecked ? new Set() : new Set(rows.map((item) => item.id)))
                        }
                      />
                    </th>
                  )}
                  <th
                    aria-sort={
                      sort?.field === 'name'
                        ? sort.descending
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                  >
                    <button type="button" className="bar-sort" onClick={() => toggleSort('name')}>
                      {t('Товар')} {sort?.field === 'name' ? (sort.descending ? '↓' : '↑') : '↕'}
                    </button>
                  </th>
                  <th>{t('Категория')}</th>
                  <th
                    aria-sort={
                      sort?.field === 'stock'
                        ? sort.descending
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                  >
                    <button type="button" className="bar-sort" onClick={() => toggleSort('stock')}>
                      {t('Остаток')} {sort?.field === 'stock' ? (sort.descending ? '↓' : '↑') : '↕'}
                    </button>
                  </th>
                  <th>{t('Ед.')}</th>
                  <th>{t('Цена продажи')}</th>
                  <th>{t('Цена закупки')}</th>
                  <th>{t('Статус')}</th>
                  <th>{t('Действия')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const state = stockStatusOf(item);
                  return (
                    <tr key={item.id} className={selected === item.id ? 'is-active' : undefined}>
                      {canCatalogMutate && (
                        <td data-label={t('Выбор')} className="bar-col-check">
                          <input
                            type="checkbox"
                            aria-label={t('Отметить {name}', { name: item.name })}
                            checked={checked.has(item.id)}
                            onChange={() => toggle(item.id)}
                          />
                        </td>
                      )}
                      <td data-label={t('Товар')}>
                        <button
                          type="button"
                          className="bar-product-link"
                          onClick={() => select(item.id)}
                        >
                          <ProductAvatar name={item.name} />
                          <b>{item.name}</b>
                        </button>
                      </td>
                      <td data-label={t('Категория')}>{item.category?.name ?? t('нет')}</td>
                      <td data-label={t('Остаток')}>
                        <b className={`bar-units bar-units--${state}`}>{item.availableUnits}</b>
                      </td>
                      <td data-label={t('Ед.')}>{t('шт.')}</td>
                      <td data-label={t('Цена продажи')}>
                        <b>{formatMoney(item.salePrice, context.currency)}</b>
                      </td>
                      <td data-label={t('Цена закупки')}>
                        {item.lastUnitCostMinor === null
                          ? t('нет')
                          : formatMoney(item.lastUnitCostMinor, context.currency)}
                      </td>
                      <td data-label={t('Статус')}>
                        <Badge tone={STATUS_TONE[state]}>{t(STATUS_LABEL[state])}</Badge>
                      </td>
                      <td data-label={t('Действия')} className="bar-row-actions">
                        {canCatalogMutate && (
                          <Button
                            type="button"
                            tone="ghost"
                            size="xs"
                            aria-label={t('Изменить {name}', { name: item.name })}
                            onClick={() => select(item.id)}
                          >
                            <Icon name="edit" width={16} height={16} />
                          </Button>
                        )}
                        {(canCatalogMutate || canStockMutate) && (
                          <ActionMenu
                            label={t('Действия: {name}', { name: item.name })}
                            size="sm"
                            items={[
                              ...(canCatalogMutate
                                ? [{ label: t('Изменить'), onSelect: () => select(item.id) }]
                                : []),
                              ...(canStockMutate
                                ? [{ label: t('Списать'), onSelect: () => select(item.id, true) }]
                                : []),
                              ...(canCatalogMutate
                                ? [
                                    {
                                      label: t('Удалить'),
                                      tone: 'danger' as const,
                                      onSelect: () =>
                                        void archive([item.id], t('Удалить «{name}»?', { name: item.name })),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </section>
        {bottom}
      </div>
      {selected && (
        <aside
          className="panel bar-card"
          aria-label={
            selected === 'new'
              ? t('Новый товар')
              : current
                ? t('Карточка товара {name}', { name: current.name })
                : t('Карточка товара')
          }
        >
          {selected === 'new' && canCatalogMutate ? (
            <NewProductCard key="new" context={context} categories={categories} onClose={() => setSelected(null)} />
          ) : current ? (
            <ProductCard
              key={current.id}
              context={context}
              product={current}
              categories={categories}
              movements={movements.filter((movement) => movement.productId === current.id)}
              writeOffOpen={writeOffOpen}
              onWriteOff={setWriteOffOpen}
              onClose={() => setSelected(null)}
              onDelete={() => void archive([current.id], t('Удалить «{name}»?', { name: current.name }))}
              canCatalogMutate={canCatalogMutate}
              canStockMutate={canStockMutate}
            />
          ) : (
            <div className="bar-card-empty">
              <Icon name="product" width={32} height={32} />
              <p>
                {t('Выберите товар в таблице: здесь откроется его карточка с ценами, остатком и историей.')}
              </p>
              {canCatalogMutate && (
                <Button type="button" onClick={() => setSelected('new')}>
                  <Icon name="plus" width={16} height={16} /> {t('Добавить товар')}
                </Button>
              )}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function Affix({ suffix, children }: { suffix: ReactNode; children: ReactNode }) {
  return (
    <span className="bar-affix">
      {children}
      <span className="bar-affix-suffix" aria-hidden="true">
        {suffix}
      </span>
    </span>
  );
}

function CardField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="bar-card-field">
      <label htmlFor={htmlFor} title={label}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ProductCard({
  context,
  product,
  categories,
  movements,
  writeOffOpen,
  onWriteOff,
  onClose,
  onDelete,
  canCatalogMutate,
  canStockMutate,
}: {
  context: BarFormContext;
  product: BarStockRow;
  categories: BarCategoryRow[];
  movements: BarMovementRow[];
  writeOffOpen: boolean;
  onWriteOff: (open: boolean) => void;
  onClose: () => void;
  onDelete: () => void;
  canCatalogMutate: boolean;
  canStockMutate: boolean;
}) {
  const t = useT();
  const clock = usePropertyClock();
  // причины списания словами направления: у салона без «Бой» и «Угощение» (аудит 22.10.2026)
  const reasons = stockWords(useDeskVertical()).writeOffReasons;
  const [state, action, pending] = useActionState(updateBarProductAction, initial);
  const [writeOffState, writeOffAction, writeOffPending] = useActionState(
    writeOffBarAction,
    initial,
  );
  const inherited = product.markupBasis ?? product.category?.defaultMarkupBasis ?? null;
  const [markup, setMarkup] = useState(inherited === null ? '' : minorToInput(String(inherited)));
  // наценка категории показывается, но своей у товара не становится, пока её не поменяли
  const [markupTouched, setMarkupTouched] = useState(false);
  const [price, setPrice] = useState(minorToInput(product.salePrice));
  const [priceNote, setPriceNote] = useState<string | null>(null);
  const reprice = () => {
    const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(markup.trim());
    if (!product.lastUnitCostMinor) {
      setPriceNote(t('Закупочной цены ещё нет: сначала занесите приход.'));
      return;
    }
    if (!match) {
      setPriceNote(t('Укажите наценку в процентах.'));
      return;
    }
    const basis = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
    setPrice(minorToInput(recommendedPriceMinor(product.lastUnitCostMinor, basis, context.currency)));
    setPriceNote(
      context.currency === 'KZT'
        ? t('Цена пересчитана от закупки и наценки, вверх до 10 тенге. Нажмите «Сохранить».')
        : t('Цена пересчитана от закупки и наценки, вверх до целого {currency}. Нажмите «Сохранить».', { currency: context.currency }),
    );
  };
  const id = (name: string) => `bar-card-${name}`;
  const info = (
    <form action={canCatalogMutate ? action : undefined} className="bar-card-form">
      <BarContextFields context={context} />
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="unitsPerPackage" value={String(product.unitsPerPackage)} />
      <input type="hidden" name="barcode" value={product.barcode ?? ''} />
      <div className="bar-card-grid">
        <CardField label={t('Название товара')} htmlFor={id('name')}>
          <Input
            id={id('name')}
            name="name"
            defaultValue={product.name}
            readOnly={!canCatalogMutate}
            required
          />
        </CardField>
        <CardField label={t('Категория')} htmlFor={id('category')}>
          <Select
            id={id('category')}
            name="categoryId"
            defaultValue={product.categoryId ?? ''}
            disabled={!canCatalogMutate}
          >
            <option value="">{t('Без категории')}</option>
            {/* N6 (ADR-186): своя архивная категория остаётся в списке, иначе сохранение молча её сотрёт */}
            {categories
              .filter((category) => category.active || category.id === product.categoryId)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.active ? category.name : t('{name} (в архиве)', { name: category.name })}
                </option>
              ))}
          </Select>
        </CardField>
        <div className="bar-card-wide">
          <CardField label={t('Поставщик')} htmlFor={id('supplier')}>
            <Input
              id={id('supplier')}
              value={product.lastSupplier?.name ?? t('Приходов ещё не было')}
              readOnly
              title={t('Поставщик последнего прихода')}
            />
          </CardField>
        </div>
        <CardField label={t('Артикул (SKU)')} htmlFor={id('sku')}>
          <Input id={id('sku')} value={product.code} readOnly />
        </CardField>
        <CardField label={t('Ед. измерения')} htmlFor={id('unit')}>
          <Input id={id('unit')} value={t('шт.')} readOnly />
        </CardField>
        <CardField label={t('Текущий остаток')} htmlFor={id('stock')}>
          <Input id={id('stock')} value={product.availableUnits} readOnly />
        </CardField>
        <CardField label={t('Мин. остаток')} htmlFor={id('min')}>
          <Input
            id={id('min')}
            name="minimumStockUnits"
            inputMode="numeric"
            defaultValue={product.minimumStockUnits}
            readOnly={!canCatalogMutate}
            required
          />
        </CardField>
        <CardField label={t('Закупочная цена')} htmlFor={id('cost')}>
          <Affix suffix={currencySign(context.currency)}>
            <Input
              id={id('cost')}
              value={
                product.lastUnitCostMinor === null ? '' : minorToInput(product.lastUnitCostMinor)
              }
              placeholder={t('нет')}
              readOnly
            />
          </Affix>
        </CardField>
        <CardField label={t('Цена продажи')} htmlFor={id('price')}>
          <Affix suffix={currencySign(context.currency)}>
            <Input
              id={id('price')}
              name="salePrice"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              readOnly={!canCatalogMutate}
              required
            />
          </Affix>
        </CardField>
        <CardField label={t('Наценка')} htmlFor={id('markup')}>
          <Affix suffix="%">
            <Input
              id={id('markup')}
              inputMode="decimal"
              value={markup}
              onChange={(event) => {
                setMarkup(event.target.value);
                setMarkupTouched(true);
              }}
              placeholder={t('из категории')}
              readOnly={!canCatalogMutate}
            />
          </Affix>
        </CardField>
        <input
          type="hidden"
          name="markup"
          value={product.markupBasis !== null || markupTouched ? markup : ''}
        />
        <CardField label={t('Себестоимость остатка')} htmlFor={id('stock-cost')}>
          <Affix suffix={currencySign(context.currency)}>
            <Input id={id('stock-cost')} value={minorToInput(product.stockCostMinor)} readOnly />
          </Affix>
        </CardField>
        <CardField label={t('Последний приход')} htmlFor={id('last')}>
          <Affix suffix={<Icon name="board" width={16} height={16} />}>
            <Input
              id={id('last')}
              value={dayRu(product.lastReceivedDate)}
              placeholder={t('нет')}
              readOnly
            />
          </Affix>
        </CardField>
        <CardField label={t('Срок годности')} htmlFor={id('expiry')}>
          <Affix suffix={<Icon name="board" width={16} height={16} />}>
            <Input
              id={id('expiry')}
              value={dayRu(product.nearestExpiry)}
              placeholder={t('не указан')}
              readOnly
            />
          </Affix>
        </CardField>
      </div>
      {priceNote && (
        <p role="status" className="bar-muted">
          {priceNote}
        </p>
      )}
      {state.error && (
        <p role="alert" className="bar-error">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="bar-success">
          {state.message}
        </p>
      )}
      {canCatalogMutate && (
        <Button type="submit" className="bar-card-save" disabled={pending}>
          {pending ? t('Сохраняю…') : t('Сохранить')}
        </Button>
      )}
      {(canCatalogMutate || canStockMutate) && (
        <div className="bar-card-actions">
          {canCatalogMutate && (
            <Button type="button" tone="secondary" onClick={reprice}>
              <Icon name="tag" width={16} height={16} /> {t('Изменить цены')}
            </Button>
          )}
          {canStockMutate && (
            <Button
              type="button"
              tone="secondary"
              onClick={() => onWriteOff(!writeOffOpen)}
              aria-expanded={writeOffOpen}
            >
              <Icon name="writeoff" width={16} height={16} /> {t('Списать')}
            </Button>
          )}
          {canCatalogMutate && (
            <Button
              type="button"
              tone="secondary"
              disabled
              title={t('Склад у объекта один: перемещать товар некуда')}
            >
              <Icon name="move" width={16} height={16} /> {t('Переместить')}
            </Button>
          )}
          {canCatalogMutate && (
            <Button type="button" tone="danger" onClick={onDelete}>
              <Icon name="trash" width={16} height={16} /> {t('Удалить')}
            </Button>
          )}
        </div>
      )}
    </form>
  );
  const history =
    movements.length === 0 ? (
      <p className="bar-muted">{t('Движений по товару пока нет.')}</p>
    ) : (
      <ol className="bar-history">
        {movements.map((movement) => (
          <li key={movement.id}>
            <span className="bar-history-when">{clock.full(movement.createdAt)}</span>
            <b>{t(MOVEMENT_LABEL[movement.kind])}</b>
            <span>
              {t('{n} шт.', { n: movement.units.startsWith('-') ? movement.units : `+${movement.units}` })}
            </span>
            <span className="bar-muted">{movement.note ? t(movement.note) : ''}</span>
          </li>
        ))}
      </ol>
    );
  return (
    <>
      <header className="bar-card-head">
        <ProductAvatar name={product.name} size="lg" />
        <h3>{product.name}</h3>
        <Button
          type="button"
          tone="ghost"
          size="xs"
          onClick={onClose}
          aria-label={t('Закрыть карточку')}
        >
          <Icon name="close" width={16} height={16} />
        </Button>
      </header>
      <Tabs
        label={t('Карточка товара')}
        panels={[
          { id: 'bar-info', label: t('Информация'), content: info },
          { id: 'bar-history', label: t('История'), content: history },
        ]}
      />
      {canStockMutate && writeOffOpen && (
        <form
          action={writeOffAction}
          className="bar-card-writeoff"
          aria-label={t('Списание: {name}', { name: product.name })}
        >
          <BarContextFields context={context} />
          <input type="hidden" name="productId" value={product.id} />
          <Input
            name="quantityUnits"
            aria-label={t('Списать, шт.')}
            inputMode="numeric"
            pattern="[0-9]+"
            defaultValue="1"
            required
          />
          <Select name="reason" aria-label={t('Причина списания')} required defaultValue="">
            <option value="" disabled>
              {t('Причина')}
            </option>
            {reasons.map((reason) => (
              <option key={reason} value={reason}>{t(reason)}</option>
            ))}
          </Select>
          <Button type="submit" tone="warning" disabled={writeOffPending}>
            {writeOffPending ? t('Списываем…') : t('Списать')}
          </Button>
          {writeOffState.error && (
            <p role="alert" className="bar-error">
              {writeOffState.error}
            </p>
          )}
          {writeOffState.message && (
            <p role="status" className="bar-success">
              {writeOffState.message}
            </p>
          )}
        </form>
      )}
    </>
  );
}

function NewProductCard({
  context,
  categories,
  onClose,
}: {
  context: BarFormContext;
  categories: BarCategoryRow[];
  onClose: () => void;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(createBarProductAction, initial);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const id = (field: string) => `bar-new-${field}`;
  return (
    <>
      <header className="bar-card-head">
        <ProductAvatar name={name || '+'} size="lg" />
        <h3>{t('Новый товар')}</h3>
        <Button
          type="button"
          tone="ghost"
          size="xs"
          onClick={onClose}
          aria-label={t('Закрыть карточку')}
        >
          <Icon name="close" width={16} height={16} />
        </Button>
      </header>
      <form action={action} className="bar-card-form">
        <BarContextFields context={context} />
        <div className="bar-card-grid">
          <CardField label={t('Название товара')} htmlFor={id('name')}>
            <Input
              id={id('name')}
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!codeTouched) setCode(suggestCode(event.target.value));
              }}
              required
            />
          </CardField>
          <CardField label={t('Категория')} htmlFor={id('category')}>
            <Select id={id('category')} name="categoryId" defaultValue="">
              <option value="">{t('Без категории')}</option>
              {categories
                .filter((category) => category.active)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </Select>
          </CardField>
          <CardField label={t('Артикул (SKU)')} htmlFor={id('code')}>
            <Input
              id={id('code')}
              name="code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeTouched(true);
              }}
              required
            />
          </CardField>

          <CardField label={t('Цена продажи')} htmlFor={id('price')}>
            <Affix suffix={currencySign(context.currency)}>
              <Input id={id('price')} name="salePrice" inputMode="decimal" required />
            </Affix>
          </CardField>
        </div>
        <details className="bar-details">
          <summary>{t('Дополнительные параметры')}</summary>
          <div className="bar-card-grid">
            <CardField label={t('Штрихкод')} htmlFor={id('barcode')}>
              <Input id={id('barcode')} name="barcode" inputMode="numeric" />
            </CardField>
            <CardField label={t('Наценка')} htmlFor={id('markup')}>
              <Affix suffix="%">
                <Input
                  id={id('markup')}
                  name="markup"
                  inputMode="decimal"
                  placeholder={t('из категории')}
                />
              </Affix>
            </CardField>
            <CardField label={t('Мин. остаток')} htmlFor={id('min')}>
              <Input
                id={id('min')}
                name="minimumStockUnits"
                inputMode="numeric"
                defaultValue="0"
                required
              />
            </CardField>
            <CardField label={t('Штук в упаковке')} htmlFor={id('units')}>
              <Input
                id={id('units')}
                name="unitsPerPackage"
                inputMode="numeric"
                defaultValue="1"
                required
              />
            </CardField>
          </div>
        </details>
        <p className="bar-muted">
          {t('Остаток появится с первым приходом: «Приход» в шапке или фото накладной.')}
        </p>
        {state.error && (
          <p role="alert" className="bar-error">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="bar-success">
            {state.message}
          </p>
        )}
        <div className="bar-form-actions">
          <Button type="button" tone="secondary" onClick={onClose}>
            {t('Отмена')}
          </Button>
          <Button type="submit" className="bar-card-save" disabled={pending}>
            {pending ? t('Сохраняю…') : t('Сохранить')}
          </Button>
        </div>
      </form>
    </>
  );
}
