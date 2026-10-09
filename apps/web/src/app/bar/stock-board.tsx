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
import {
  archiveBarProductsAction,
  createBarProductAction,
  updateBarProductAction,
  writeOffBarAction,
  type BarActionResult,
} from './actions';
import { STATUS_LABEL, STATUS_TONE, markupPercent, recommendedPriceMinor, stockStatusOf } from './stock-status';
import { suggestCode } from './receipts/new/new-receipt';

/**
 * «Товары и остатки» с карточкой товара колонкой справа (ADR-154, макет владельца 09.10.2026). Слева доска
 * и нижний ряд (приходы, популярные), справа карточка выбранного товара: таблица остаётся на экране (§1 п. 5).
 */
const initial: BarActionResult = { error: null, ok: 0 };
const PERIODS = [
  { id: 'all', label: 'За все время', days: null },
  { id: '30', label: 'За 30 дней', days: 30 },
  { id: '7', label: 'За 7 дней', days: 7 },
] as const;
const MOVEMENT_LABEL: Record<BarMovementRow['kind'], string> = {
  RECEIPT: 'Приход', SALE: 'Продажа', WRITE_OFF: 'Списание', SALE_RETURN: 'Возврат', INVENTORY_ADJUSTMENT: 'Инвентаризация',
};

const normalized = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const dayRu = (date: string | null) => (date ? `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}` : '');

/** Аватар товара: фотографии в модели нет, поэтому первая буква на цветной плашке, цвет от названия */
export function ProductAvatar({ name, size }: { name: string; size?: 'lg' }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const tones = ['primary', 'success', 'warning', 'danger', 'info'] as const;
  return <span className={cx('bar-avatar', `bar-avatar--${tones[hash % tones.length]}`, size === 'lg' && 'bar-avatar--lg')} aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>;
}

export function StockBoard({ stock, categories, suppliers, movements, today, initialProduct, bottom }: {
  stock: BarStockRow[];
  categories: BarCategoryRow[];
  suppliers: BarSupplierRow[];
  movements: BarMovementRow[];
  today: string;
  /** `?product=` из адреса: id товара или `new` (кнопка «Добавить товар» в шапке) */
  initialProduct: string | null;
  /** Нижний ряд макета под таблицей: приходы и популярные товары (рисует сервер) */
  bottom: ReactNode;
}) {
  const [query, setQuery] = useState('');
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
    return active
      .filter((item) => !needle || normalized(`${item.name} ${item.code} ${item.barcode ?? ''} ${item.lastSupplier?.name ?? ''}`).includes(needle))
      .filter((item) => !categoryId || item.categoryId === categoryId)
      .filter((item) => !supplierId || item.lastSupplier?.id === supplierId)
      .filter((item) => !status || stockStatusOf(item) === status)
      .filter((item) => since === null || (item.lastReceivedDate !== null && item.lastReceivedDate >= since));
  }, [active, query, categoryId, supplierId, status, period, today]);
  const [selected, setSelected] = useState<string | null>(() =>
    initialProduct === 'new' || active.some((item) => item.id === initialProduct) ? initialProduct : null);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const current = selected && selected !== 'new' ? active.find((item) => item.id === selected) ?? null : null;
  const select = (id: string, writeOff = false) => { setSelected(id); setWriteOffOpen(writeOff); };
  const archive = async (ids: string[], title: string) => {
    if (!(await ask({
      title,
      body: 'Товар уйдёт в архив: остатки, приходы и продажи сохраняются, вернуть можно на вкладке «Товары».',
      confirmLabel: 'Удалить в архив',
      tone: 'danger',
    }))) return;
    startTransition(async () => {
      const result = await archiveBarProductsAction(ids);
      setBulk(result);
      setChecked(new Set());
      if (ids.includes(selected ?? '')) setSelected(null);
    });
  };
  const allChecked = rows.length > 0 && rows.every((item) => checked.has(item.id));
  const toggle = (id: string) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <div className="bar-main">
      {dialog}
      <div className="bar-main-left">
        <section className="panel bar-board" aria-labelledby="bar-board-title">
          <h2 id="bar-board-title" className="bar-panel-title">Товары и остатки</h2>
          <div className="bar-board-filters">
            <span className="bar-select-search bar-board-search">
              <Icon name="search" width={16} height={16} />
              <Input aria-label="Поиск товара" placeholder="Поиск по названию, SKU или поставщику…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </span>
            <Select aria-label="Категория" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Все категории</option>
              {categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
            <Select aria-label="Поставщик" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">Все поставщики</option>
              {suppliers.filter((supplier) => supplier.active).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </Select>
            <Select aria-label="Статус остатка" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Все статусы</option>
              <option value="ok">В норме</option>
              <option value="low">Заканчивается</option>
              <option value="out">Нет в наличии</option>
            </Select>
            <span className="bar-select-search">
              <Icon name="board" width={16} height={16} />
              <Select aria-label="Период последнего прихода" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}>
                {PERIODS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
              </Select>
            </span>
          </div>
          {checked.size > 0 && (
            <div className="bar-bulk" role="toolbar" aria-label="Отмеченные товары">
              <span>Отмечено: {checked.size}</span>
              <Button type="button" tone="danger" size="sm" onClick={() => void archive([...checked], `Удалить отмеченные товары (${checked.size})?`)}><Icon name="trash" width={16} height={16} /> Удалить</Button>
              <Button type="button" tone="ghost" size="sm" onClick={() => setChecked(new Set())}>Снять отметку</Button>
            </div>
          )}
          {bulk.error && <p role="alert" className="bar-error">{bulk.error}</p>}
          {rows.length === 0 ? (
            <p className="bar-muted" role="status">По такому отбору товаров нет. Снимите фильтры или добавьте товар.</p>
          ) : (
            <Table density="compact" sticky="header" aria-label="Товары и остатки бара">
              <thead><tr>
                <th className="bar-col-check"><input type="checkbox" aria-label="Отметить все товары" checked={allChecked} onChange={() => setChecked(allChecked ? new Set() : new Set(rows.map((item) => item.id)))} /></th>
                <th>Товар</th><th>Категория</th><th>Поставщик</th><th>Остаток</th><th>Мин. остаток</th><th>Ед.</th>
                <th>Закуп. цена</th><th>Цена продажи</th><th>Наценка</th><th>Себестоимость</th><th>Статус</th><th>Действия</th>
              </tr></thead>
              <tbody>{rows.map((item) => {
                const state = stockStatusOf(item);
                const markup = markupPercent(item.salePrice, item.lastUnitCostMinor);
                return <tr key={item.id} className={selected === item.id ? 'is-active' : undefined}>
                  <td className="bar-col-check"><input type="checkbox" aria-label={`Отметить ${item.name}`} checked={checked.has(item.id)} onChange={() => toggle(item.id)} /></td>
                  <td><button type="button" className="bar-product-link" onClick={() => select(item.id)}><ProductAvatar name={item.name} /><b>{item.name}</b></button></td>
                  <td>{item.category?.name ?? 'нет'}</td>
                  <td>{item.lastSupplier?.name ?? 'нет'}</td>
                  <td><b className={`bar-units bar-units--${state}`}>{item.availableUnits}</b></td>
                  <td>{item.minimumStockUnits}</td>
                  <td>шт.</td>
                  <td>{item.lastUnitCostMinor === null ? 'нет' : formatMoney(item.lastUnitCostMinor)}</td>
                  <td><b>{formatMoney(item.salePrice)}</b></td>
                  <td>{markup === null ? 'нет' : `${markup}%`}</td>
                  <td>{formatMoney(item.stockCostMinor)}</td>
                  <td><Badge tone={STATUS_TONE[state]}>{STATUS_LABEL[state]}</Badge></td>
                  <td className="bar-row-actions">
                    <Button type="button" tone="ghost" size="xs" aria-label={`Изменить ${item.name}`} onClick={() => select(item.id)}><Icon name="edit" width={16} height={16} /></Button>
                    <ActionMenu label={`Действия: ${item.name}`} size="sm" items={[
                      { label: 'Изменить', onSelect: () => select(item.id) },
                      { label: 'Списать', onSelect: () => select(item.id, true) },
                      { label: 'Удалить', tone: 'danger', onSelect: () => void archive([item.id], `Удалить «${item.name}»?`) },
                    ]} />
                  </td>
                </tr>;
              })}</tbody>
            </Table>
          )}
        </section>
        {bottom}
      </div>
      <aside className="panel bar-card" aria-label={selected === 'new' ? 'Новый товар' : current ? `Карточка товара ${current.name}` : 'Карточка товара'}>
        {selected === 'new'
          ? <NewProductCard key="new" categories={categories} onClose={() => setSelected(null)} />
          : current
            ? <ProductCard key={current.id} product={current} categories={categories} movements={movements.filter((movement) => movement.productId === current.id)}
                writeOffOpen={writeOffOpen} onWriteOff={setWriteOffOpen} onClose={() => setSelected(null)}
                onDelete={() => void archive([current.id], `Удалить «${current.name}»?`)} />
            : <div className="bar-card-empty">
                <Icon name="product" width={32} height={32} />
                <p>Выберите товар в таблице: здесь откроется его карточка с ценами, остатком и историей.</p>
                <Button type="button" onClick={() => setSelected('new')}><Icon name="plus" width={16} height={16} /> Добавить товар</Button>
              </div>}
      </aside>
    </div>
  );
}

function Affix({ suffix, children }: { suffix: string; children: ReactNode }) {
  return <span className="bar-affix">{children}<span className="bar-affix-suffix" aria-hidden="true">{suffix}</span></span>;
}

function CardField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="bar-card-field"><label htmlFor={htmlFor}>{label}</label>{children}</div>;
}

function ProductCard({ product, categories, movements, writeOffOpen, onWriteOff, onClose, onDelete }: {
  product: BarStockRow;
  categories: BarCategoryRow[];
  movements: BarMovementRow[];
  writeOffOpen: boolean;
  onWriteOff: (open: boolean) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const clock = usePropertyClock();
  const [state, action, pending] = useActionState(updateBarProductAction, initial);
  const [writeOffState, writeOffAction, writeOffPending] = useActionState(writeOffBarAction, initial);
  const inherited = product.markupBasis ?? product.category?.defaultMarkupBasis ?? null;
  const [markup, setMarkup] = useState(inherited === null ? '' : minorToInput(String(inherited)));
  // наценка категории показывается, но своей у товара не становится, пока её не поменяли
  const [markupTouched, setMarkupTouched] = useState(false);
  const [price, setPrice] = useState(minorToInput(product.salePrice));
  const [priceNote, setPriceNote] = useState<string | null>(null);
  const reprice = () => {
    const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(markup.trim());
    if (!product.lastUnitCostMinor) { setPriceNote('Закупочной цены ещё нет: сначала занесите приход.'); return; }
    if (!match) { setPriceNote('Укажите наценку в процентах.'); return; }
    const basis = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
    setPrice(minorToInput(recommendedPriceMinor(product.lastUnitCostMinor, basis)));
    setPriceNote('Цена пересчитана от закупки и наценки, вверх до 10 тенге. Нажмите «Сохранить».');
  };
  const id = (name: string) => `bar-card-${name}`;
  const info = (
    <form action={action} className="bar-card-form">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="unitsPerPackage" value={String(product.unitsPerPackage)} />
      <input type="hidden" name="barcode" value={product.barcode ?? ''} />
      <div className="bar-card-grid">
        <CardField label="Название товара" htmlFor={id('name')}><Input id={id('name')} name="name" defaultValue={product.name} required /></CardField>
        <CardField label="Категория" htmlFor={id('category')}>
          <Select id={id('category')} name="categoryId" defaultValue={product.categoryId ?? ''}>
            <option value="">Без категории</option>
            {categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Select>
        </CardField>
        <div className="bar-card-wide">
          <CardField label="Поставщик" htmlFor={id('supplier')}><Input id={id('supplier')} value={product.lastSupplier?.name ?? 'Приходов ещё не было'} readOnly title="Поставщик последнего прихода" /></CardField>
        </div>
        <CardField label="Артикул (SKU)" htmlFor={id('sku')}><Input id={id('sku')} value={product.code} readOnly /></CardField>
        <CardField label="Ед. измерения" htmlFor={id('unit')}><Input id={id('unit')} value="шт." readOnly /></CardField>
        <CardField label="Текущий остаток" htmlFor={id('stock')}><Input id={id('stock')} value={product.availableUnits} readOnly /></CardField>
        <CardField label="Мин. остаток" htmlFor={id('min')}><Input id={id('min')} name="minimumStockUnits" inputMode="numeric" defaultValue={product.minimumStockUnits} required /></CardField>
        <CardField label="Закупочная цена" htmlFor={id('cost')}><Affix suffix="₸"><Input id={id('cost')} value={product.lastUnitCostMinor === null ? '' : minorToInput(product.lastUnitCostMinor)} placeholder="нет" readOnly /></Affix></CardField>
        <CardField label="Цена продажи" htmlFor={id('price')}><Affix suffix="₸"><Input id={id('price')} name="salePrice" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required /></Affix></CardField>
        <CardField label="Наценка" htmlFor={id('markup')}><Affix suffix="%"><Input id={id('markup')} inputMode="decimal" value={markup} onChange={(event) => { setMarkup(event.target.value); setMarkupTouched(true); }} placeholder="из категории" /></Affix></CardField>
        <input type="hidden" name="markup" value={product.markupBasis !== null || markupTouched ? markup : ''} />
        <CardField label="Себестоимость остатка" htmlFor={id('stock-cost')}><Affix suffix="₸"><Input id={id('stock-cost')} value={minorToInput(product.stockCostMinor)} readOnly /></Affix></CardField>
        <CardField label="Последний приход" htmlFor={id('last')}><Input id={id('last')} value={dayRu(product.lastReceivedDate)} placeholder="нет" readOnly /></CardField>
        <CardField label="Срок годности" htmlFor={id('expiry')}><Input id={id('expiry')} value={dayRu(product.nearestExpiry)} placeholder="не указан" readOnly /></CardField>
      </div>
      {priceNote && <p role="status" className="bar-muted">{priceNote}</p>}
      {state.error && <p role="alert" className="bar-error">{state.error}</p>}
      {state.message && <p role="status" className="bar-success">{state.message}</p>}
      <Button type="submit" className="bar-card-save" disabled={pending}>{pending ? 'Сохраняю…' : 'Сохранить'}</Button>
      <div className="bar-card-actions">
        <Button type="button" tone="secondary" onClick={reprice}><Icon name="tag" width={16} height={16} /> Изменить цены</Button>
        <Button type="button" tone="secondary" onClick={() => onWriteOff(!writeOffOpen)} aria-expanded={writeOffOpen}><Icon name="writeoff" width={16} height={16} /> Списать</Button>
        <Button type="button" tone="secondary" disabled title="Склад у объекта один: перемещать товар некуда"><Icon name="move" width={16} height={16} /> Переместить</Button>
        <Button type="button" tone="danger" onClick={onDelete}><Icon name="trash" width={16} height={16} /> Удалить</Button>
      </div>
    </form>
  );
  const history = movements.length === 0
    ? <p className="bar-muted">Движений по товару пока нет.</p>
    : <ol className="bar-history">{movements.map((movement) => (
        <li key={movement.id}>
          <span className="bar-history-when">{clock.full(movement.createdAt)}</span>
          <b>{MOVEMENT_LABEL[movement.kind]}</b>
          <span>{movement.units.startsWith('-') ? movement.units : `+${movement.units}`} шт.</span>
          <span className="bar-muted">{movement.note ?? ''}</span>
        </li>
      ))}</ol>;
  return (
    <>
      <header className="bar-card-head">
        <ProductAvatar name={product.name} size="lg" />
        <h3>{product.name}</h3>
        <Button type="button" tone="ghost" size="xs" onClick={onClose} aria-label="Закрыть карточку"><Icon name="close" width={16} height={16} /></Button>
      </header>
      <Tabs label="Карточка товара" panels={[
        { id: 'bar-info', label: 'Информация', content: info },
        { id: 'bar-history', label: 'История', content: history },
      ]} />
      {writeOffOpen && (
        <form action={writeOffAction} className="bar-card-writeoff" aria-label={`Списание: ${product.name}`}>
          <input type="hidden" name="productId" value={product.id} />
          <Input name="quantityUnits" aria-label="Списать, шт." inputMode="numeric" pattern="[0-9]+" defaultValue="1" required />
          <Select name="reason" aria-label="Причина списания" required defaultValue="">
            <option value="" disabled>Причина</option>
            <option>Порча</option><option>Бой</option><option>Истек срок</option><option>Угощение</option><option>Нужды объекта</option><option>Иное</option>
          </Select>
          <Button type="submit" tone="warning" disabled={writeOffPending}>{writeOffPending ? 'Списываем…' : 'Списать'}</Button>
          {writeOffState.error && <p role="alert" className="bar-error">{writeOffState.error}</p>}
          {writeOffState.message && <p role="status" className="bar-success">{writeOffState.message}</p>}
        </form>
      )}
    </>
  );
}

function NewProductCard({ categories, onClose }: { categories: BarCategoryRow[]; onClose: () => void }) {
  const [state, action, pending] = useActionState(createBarProductAction, initial);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const id = (field: string) => `bar-new-${field}`;
  return (
    <>
      <header className="bar-card-head">
        <ProductAvatar name={name || '+'} size="lg" />
        <h3>Новый товар</h3>
        <Button type="button" tone="ghost" size="xs" onClick={onClose} aria-label="Закрыть карточку"><Icon name="close" width={16} height={16} /></Button>
      </header>
      <form action={action} className="bar-card-form">
        <div className="bar-card-grid">
          <CardField label="Название товара" htmlFor={id('name')}><Input id={id('name')} name="name" value={name} onChange={(event) => { setName(event.target.value); if (!codeTouched) setCode(suggestCode(event.target.value)); }} required /></CardField>
          <CardField label="Категория" htmlFor={id('category')}>
            <Select id={id('category')} name="categoryId" defaultValue="">
              <option value="">Без категории</option>
              {categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </CardField>
          <CardField label="Артикул (SKU)" htmlFor={id('code')}><Input id={id('code')} name="code" value={code} onChange={(event) => { setCode(event.target.value); setCodeTouched(true); }} required /></CardField>
          <CardField label="Штрихкод" htmlFor={id('barcode')}><Input id={id('barcode')} name="barcode" inputMode="numeric" /></CardField>
          <CardField label="Цена продажи" htmlFor={id('price')}><Affix suffix="₸"><Input id={id('price')} name="salePrice" inputMode="decimal" required /></Affix></CardField>
          <CardField label="Наценка" htmlFor={id('markup')}><Affix suffix="%"><Input id={id('markup')} name="markup" inputMode="decimal" placeholder="из категории" /></Affix></CardField>
          <CardField label="Мин. остаток" htmlFor={id('min')}><Input id={id('min')} name="minimumStockUnits" inputMode="numeric" defaultValue="0" required /></CardField>
          <CardField label="Штук в упаковке" htmlFor={id('units')}><Input id={id('units')} name="unitsPerPackage" inputMode="numeric" defaultValue="1" required /></CardField>
        </div>
        <p className="bar-muted">Остаток появится с первым приходом: «Приход» в шапке или фото накладной.</p>
        {state.error && <p role="alert" className="bar-error">{state.error}</p>}
        {state.message && <p role="status" className="bar-success">{state.message}</p>}
        <Button type="submit" className="bar-card-save" disabled={pending}>{pending ? 'Сохраняю…' : 'Сохранить'}</Button>
      </form>
    </>
  );
}
