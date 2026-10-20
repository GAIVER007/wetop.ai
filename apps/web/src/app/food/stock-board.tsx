'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { IconField } from '../../components/icon-field';
import { Tabs } from '../../components/tabs';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Stat,
  Stats,
  Table,
} from '../../components/ui';
import { wholeTenge } from '../../lib/dashboard-format';
import { formatMoney } from '../../lib/money';
import type { WebVertical } from '../../lib/vertical-landing';
import type {
  StockLotView,
  StockMovementView,
  StockProductView,
  StockUnit,
} from '../../lib/food-types';
import { loadLots, mutateStock } from './stock-actions';
import { useConfirm } from '../../components/use-confirm';

/** Склад кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS) */
export interface StockCtx {
  scopeKey: string;
  canDesk?: boolean;
  canProperty?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  currency: string;
  vertical?: WebVertical;
}

const stockNouns = (ctx: StockCtx) =>
  ctx.vertical === 'BEAUTY'
    ? {
        one: 'расходник',
        oneTitle: 'Расходник',
        many: 'расходникам',
        count: 'Расходников',
      }
    : {
        one: 'ингредиент',
        oneTitle: 'Ингредиент',
        many: 'ингредиентам',
        count: 'Ингредиентов',
      };

const stockMoney = (minor: string | bigint, ctx: StockCtx) =>
  ctx.vertical === 'BEAUTY'
    ? formatMoney(minor, ctx.currency)
    : wholeTenge(minor.toString(), ctx.currency);

const UNITS: StockUnit[] = ['г', 'мл', 'шт'];
const PRICE_UNIT: Record<StockUnit, string> = { г: 'кг', мл: 'л', шт: 'шт' };
const KIND_LABEL: Record<StockMovementView['kind'], string> = {
  RECEIPT: 'Приход',
  WRITE_OFF: 'Списание',
  INVENTORY: 'Инвентаризация',
  REVERSAL: 'Сторно прихода',
  // §38: движения по заказам
  CONSUMPTION: 'Расход по заказу',
  SHORTAGE: 'Недостача по заказу',
  CONSUMPTION_RETURN: 'Возврат по отмене',
};

/** Сумма в выбранной валюте с двумя десятичными знаками, в целых младших единицах. */
export function stockMoneyInputToMinor(raw: string, field: string, currency: string): number {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw.trim());
  if (!m) throw new Error(`${field}: укажите сумму в ${currency}`);
  const minor = BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0') || '0');
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${field}: сумма слишком большая`);
  return Number(minor);
}
const qtyText = (qty: string, unit: string) => `${qty.replace('.', ',')} ${unit}`;
const dateText = (iso: string) => iso.split('-').reverse().join('.');

function useSave(close: () => void) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return {
    error,
    pending,
    setError,
    run(fn: () => Promise<{ error: string | null }>) {
      setError('');
      start(async () => {
        try {
          const r = await fn();
          if (r.error) setError(r.error);
          else {
            router.refresh();
            close();
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Не удалось сохранить');
        }
      });
    },
  };
}

function ProductDrawer({ ctx, product, close }: { ctx: StockCtx; product: StockProductView | null; close: () => void }) {
  const save = useSave(close);
  const nouns = stockNouns(ctx);
  return (
    <Overlay open drawer trapFocus onClose={close} className="food-drawer" title={product ? `Изменить ${nouns.one}` : `Новый ${nouns.one}`}>
      <form
        className="food-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const body = {
            name: String(f.get('name')).trim(),
            unit: String(f.get('unit')) as StockUnit,
            minQty: String(f.get('minQty') || '0').replace(',', '.'),
            active: f.get('active') === 'on',
          };
          save.run(() =>
            mutateStock(ctx.scopeKey, product ? { kind: 'product', id: product.id, body } : { kind: 'product', body }),
          );
        }}
      >
        <Field label="Название">
          <Input name="name" required maxLength={200} defaultValue={product?.name ?? ''} />
        </Field>
        <div className="food-form-row">
          <Field label="Единица">
            <Select name="unit" defaultValue={product?.unit ?? 'г'}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Минимальный остаток">
            <Input name="minQty" inputMode="decimal" defaultValue={product?.minQty ?? '0'} />
          </Field>
        </div>
        <label className="food-check">
          <input name="active" type="checkbox" defaultChecked={product?.active ?? true} />
          Используется (снимите, чтобы убрать из прихода)
        </label>
        {save.error && <Alert tone="warning">{save.error}</Alert>}
        <Button disabled={save.pending}>{save.pending ? 'Сохраняем…' : product ? 'Сохранить' : 'Создать'}</Button>
      </form>
    </Overlay>
  );
}

type Line = { productId: string; qty: string; price: string; expiresOn: string };
function ReceiptDrawer({ ctx, products, close }: { ctx: StockCtx; products: StockProductView[]; close: () => void }) {
  const save = useSave(close);
  const nouns = stockNouns(ctx);
  const active = products.filter((p) => p.active);
  const blank = (): Line => ({ productId: active[0]?.id ?? '', qty: '', price: '', expiresOn: '' });
  const [lines, setLines] = useState<Line[]>([blank()]);
  const unitOf = (id: string) => active.find((p) => p.id === id)?.unit ?? 'г';
  const patch = (i: number, part: Partial<Line>) =>
    setLines((all) => all.map((l, k) => (k === i ? { ...l, ...part } : l)));
  return (
    <Overlay open drawer trapFocus onClose={close} className="food-drawer" title="Приход на склад">
      <form
        className="food-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          save.run(async () => {
            const body = {
              supplier: String(f.get('supplier')).trim() || null,
              document: String(f.get('document')).trim() || null,
              receivedOn: String(f.get('receivedOn')) || null,
              lines: lines.map((l, i) => ({
                productId: l.productId,
                qty: l.qty.replace(',', '.'),
                unitCost: stockMoneyInputToMinor(l.price, `Строка ${i + 1}, цена`, ctx.currency),
                expiresOn: l.expiresOn || null,
              })),
            };
            return mutateStock(ctx.scopeKey, { kind: 'receipt', body });
          });
        }}
      >
        <div className="food-form-row">
          <Field label="Поставщик">
            <Input name="supplier" maxLength={200} />
          </Field>
          <Field label="Номер накладной">
            <Input name="document" maxLength={100} />
          </Field>
        </div>
        <Field label="Дата прихода (пусто: сегодня)">
          <Input name="receivedOn" type="date" />
        </Field>
        {lines.map((l, i) => (
          <fieldset key={i} className="food-form" aria-label={`Строка ${i + 1}`}>
            <Field label={nouns.oneTitle}>
              <Select value={l.productId} onChange={(e) => patch(i, { productId: e.target.value })}>
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="food-form-row">
              <Field label={`Количество, ${unitOf(l.productId)}`}>
                <Input required inputMode="decimal" value={l.qty} onChange={(e) => patch(i, { qty: e.target.value })} />
              </Field>
              <Field label={`Цена за ${PRICE_UNIT[unitOf(l.productId)]}, ${ctx.currency === 'KZT' ? '₸' : ctx.currency}`}>
                <Input required inputMode="decimal" value={l.price} onChange={(e) => patch(i, { price: e.target.value })} />
              </Field>
            </div>
            <Field label="Годен до">
              <Input type="date" value={l.expiresOn} onChange={(e) => patch(i, { expiresOn: e.target.value })} />
            </Field>
            {lines.length > 1 && (
              <Button type="button" tone="ghost" size="sm" onClick={() => setLines((all) => all.filter((_, k) => k !== i))}>
                Убрать строку {i + 1}
              </Button>
            )}
          </fieldset>
        ))}
        {lines.length < 50 && (
          <Button type="button" tone="secondary" onClick={() => setLines((all) => [...all, blank()])}>
            + Строка
          </Button>
        )}
        {save.error && <Alert tone="warning">{save.error}</Alert>}
        <Button disabled={save.pending}>{save.pending ? 'Проводим…' : 'Провести приход'}</Button>
      </form>
    </Overlay>
  );
}

function QtyDrawer({
  ctx,
  product,
  mode,
  close,
}: {
  ctx: StockCtx;
  product: StockProductView;
  mode: 'write-off' | 'inventory';
  close: () => void;
}) {
  const save = useSave(close);
  const empty = mode === 'inventory' && Number(product.onHand) === 0;
  return (
    <Overlay
      open
      drawer
      trapFocus
      onClose={close}
      className="food-drawer"
      title={`${mode === 'write-off' ? 'Списание' : 'Инвентаризация'}: ${product.name}`}
    >
      <form
        className="food-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const qty = String(f.get('qty')).replace(',', '.');
          const reason = String(f.get('reason')).trim();
          save.run(() => {
            // пустой склад: излишек принимается по цене, которую называет человек (Q-KITCHEN-9)
            const price = empty
              ? { unitCost: stockMoneyInputToMinor(String(f.get('price')), 'Цена излишка', ctx.currency) }
              : {};
            return mutateStock(
              ctx.scopeKey,
              mode === 'write-off'
                ? { kind: 'write-off', body: { productId: product.id, qty, reason } }
                : { kind: 'inventory', body: { productId: product.id, actualQty: qty, reason: reason || null, ...price } },
            );
          });
        }}
      >
        <p className="muted">По учёту: {qtyText(product.onHand, product.unit)}</p>
        <Field label={mode === 'write-off' ? `Списать, ${product.unit}` : `Фактически на складе, ${product.unit}`}>
          <Input name="qty" required inputMode="decimal" />
        </Field>
        {empty && (
          <Field
            label={`Цена излишка за ${PRICE_UNIT[product.unit as keyof typeof PRICE_UNIT]}, ${ctx.currency === 'KZT' ? '₸' : ctx.currency}`}
            hint="На складе пусто: найденное примем по этой цене"
            controlId="stock-surplus-price"
          >
            <Input name="price" required inputMode="decimal" />
          </Field>
        )}
        <Field label={mode === 'write-off' ? 'Причина' : 'Комментарий'}>
          <Input name="reason" required={mode === 'write-off'} maxLength={500} />
        </Field>
        {save.error && <Alert tone="warning">{save.error}</Alert>}
        <Button disabled={save.pending}>{save.pending ? 'Сохраняем…' : mode === 'write-off' ? 'Списать' : 'Сверить'}</Button>
      </form>
    </Overlay>
  );
}

function LotsDrawer({ ctx, product, close }: { ctx: StockCtx; product: StockProductView; close: () => void }) {
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [lots, setLots] = useState<StockLotView[] | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const nouns = stockNouns(ctx);
  const reload = () =>
    loadLots(ctx.scopeKey, product.id).then((r) => {
      setError(r.error ?? '');
      setLots(r.items);
    });
  useEffect(() => {
    void reload();
  }, [product.id]);
  return (
    <Overlay open drawer trapFocus onClose={close} className="food-drawer" title={`Партии: ${product.name}`}>
      <div className="food-form">
        {dialog}
        {error && <Alert tone="warning">{error}</Alert>}
        {lots === null ? (
          <p role="status">Загружаем партии…</p>
        ) : lots.length === 0 ? (
          <EmptyState title={`Приходов по ${nouns.one}у ещё не было`} />
        ) : (
          <ul className="food-catalog-list">
            {lots.map((l) => (
              <li key={l.id}>
                <div>
                  <strong>{dateText(l.receivedOn)}</strong>
                  <span>
                    Остаток {qtyText(l.remainingQty, product.unit)} из {qtyText(l.receivedQty, product.unit)}, цена за{' '}
                    {PRICE_UNIT[product.unit]} {stockMoney(l.unitCostMinor, ctx)}
                  </span>
                  {l.supplier && <span>{l.supplier}</span>}
                </div>
                {l.reversed ? (
                  <Badge tone="neutral">Сторнирован</Badge>
                ) : l.reversible && (ctx.canDelete ?? ctx.canProperty ?? false) ? (
                  <Button
                    tone="secondary"
                    size="sm"
                    disabled={pending}
                    aria-label={`Сторнировать приход от ${dateText(l.receivedOn)}`}
                    onClick={async () => {
                      // сторно пишет обратное движение в ленту, которая только дописывается (§34)
                      if (
                        !(await ask({
                          title: `Сторнировать приход от ${dateText(l.receivedOn)}?`,
                          body: `${product.name}: партия на ${qtyText(l.receivedQty, product.unit)} уйдёт из остатка, в ленте появится «Сторно прихода». Отменить сторно нельзя.`,
                          confirmLabel: 'Сторнировать',
                          tone: 'danger',
                        }))
                      )
                        return;
                      start(async () => {
                        const r = await mutateStock(ctx.scopeKey, { kind: 'reverse', id: l.id });
                        if (r.error) setError(r.error);
                        else {
                          await reload();
                          router.refresh();
                        }
                      });
                    }}
                  >
                    Сторно
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Overlay>
  );
}

type Draft =
  | { kind: 'product'; product: StockProductView | null }
  | { kind: 'receipt' }
  | { kind: 'write-off' | 'inventory' | 'lots'; product: StockProductView };

export function StockBoard({
  ctx,
  products,
  movements,
}: {
  ctx: StockCtx;
  products: StockProductView[];
  movements: StockMovementView[];
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState('');
  const close = () => setDraft(null);
  const canCreateProduct = ctx.canCreate ?? ctx.canProperty ?? false;
  const canReceive = ctx.canCreate ?? ctx.canDesk ?? false;
  const canUpdateProduct = ctx.canUpdate ?? ctx.canProperty ?? false;
  const canUpdateStock = ctx.canUpdate ?? ctx.canDesk ?? false;
  const nouns = stockNouns(ctx);
  const total = products.reduce((sum, p) => sum + BigInt(p.valueMinor), 0n);
  const low = products.filter((p) => p.active && p.low).length;
  const q = query.trim().toLocaleLowerCase('ru');
  const shown = products.filter((p) => q === '' || p.name.toLocaleLowerCase('ru').includes(q));

  const stockTable =
    products.length === 0 ? (
      <EmptyState title={`Добавьте первый ${nouns.one}`} />
    ) : (
      <div className="rest-card">
        <div className="rest-card__tools">
          <IconField icon="search">
            <Input aria-label={`Поиск по ${nouns.many}`} placeholder={`Поиск по ${nouns.many}`} value={query} onChange={(e) => setQuery(e.target.value)} />
          </IconField>
        </div>
        {shown.length === 0 ? (
          <EmptyState title="Ничего не найдено" />
        ) : (
          <Table density="normal" aria-label="Остатки склада">
            <thead>
              <tr>
                {[nouns.oneTitle, 'Остаток', 'Минимум', 'Стоимость', 'Годен до', 'Статус'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
                <th>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} data-low={(p.active && (p.low || p.onHand === '0')) || undefined}>
                  <td>{p.name}</td>
                  <td className="rest-stock-qty">{qtyText(p.onHand, p.unit)}</td>
                  <td className="rest-stock-qty">{qtyText(p.minQty, p.unit)}</td>
                  <td>{stockMoney(p.valueMinor, ctx)}</td>
                  <td>{p.nearestExpiry ? <time dateTime={p.nearestExpiry}>{dateText(p.nearestExpiry)}</time> : 'Нет'}</td>
                  <td>
                    {!p.active ? (
                      <Badge tone="neutral">Не используется</Badge>
                    ) : p.onHand === '0' ? (
                      <Badge tone="danger">Нет на складе</Badge>
                    ) : p.low ? (
                      <Badge tone="warn">Мало</Badge>
                    ) : (
                      <Badge tone="ok">В норме</Badge>
                    )}
                  </td>
                  <td>
                    <div className="food-inline-actions">
                      <Button tone="ghost" size="sm" aria-label={`Партии: ${p.name}`} onClick={() => setDraft({ kind: 'lots', product: p })}>
                        Партии
                      </Button>
                      {canUpdateStock && p.onHand !== '0' && (
                        <Button tone="ghost" size="sm" aria-label={`Списать: ${p.name}`} onClick={() => setDraft({ kind: 'write-off', product: p })}>
                          Списать
                        </Button>
                      )}
                      {canUpdateStock && (
                        <Button tone="ghost" size="sm" aria-label={`Инвентаризация: ${p.name}`} onClick={() => setDraft({ kind: 'inventory', product: p })}>
                          Инвентаризация
                        </Button>
                      )}
                      {canUpdateProduct && (
                        <Button tone="ghost" size="sm" aria-label={`Изменить: ${p.name}`} onClick={() => setDraft({ kind: 'product', product: p })}>
                          Изменить
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    );

  const movementTable =
    movements.length === 0 ? (
      <EmptyState title="Движений пока нет" />
    ) : (
      <Table density="compact" caption="Последние 200 движений склада" captionHidden>
        <thead>
          <tr>
            {['Когда', nouns.oneTitle, 'Операция', 'Количество', 'Сумма', 'Основание'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td>
                <time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</time>
              </td>
              <td>{m.productName}</td>
              <td>{KIND_LABEL[m.kind]}</td>
              <td>{qtyText(m.qty, m.unit)}</td>
              <td>{stockMoney(m.costMinor, ctx)}</td>
              <td>{m.reason ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

  return (
    <div className="food-workspace">
      <Stats min={170} className="rest-kpis">
        <Stat label={nouns.count} value={String(products.filter((p) => p.active).length)} />
        <Stat label="Стоимость остатка" value={stockMoney(total, ctx)} tone="info" testId="stock-value" />
        <Stat label="Мало на складе" value={String(low)} tone={low > 0 ? 'warn' : undefined} testId="stock-low" />
      </Stats>
      <div className="food-section-heading rest-actions-end">
        <div className="food-inline-actions">
          {canCreateProduct && (
            <Button tone="secondary" onClick={() => setDraft({ kind: 'product', product: null })}>
              + {nouns.oneTitle}
            </Button>
          )}
          {canReceive && products.some((p) => p.active) && (
            <Button onClick={() => setDraft({ kind: 'receipt' })}>+ Приход товара</Button>
          )}
        </div>
      </div>
      <Tabs
        className="rest-tabs-line"
        label="Склад"
        panels={[
          { id: 'stock', label: 'Остатки', content: stockTable },
          { id: 'movements', label: 'Движения', content: movementTable },
        ]}
      />
      {draft?.kind === 'product' && <ProductDrawer ctx={ctx} product={draft.product} close={close} />}
      {draft?.kind === 'receipt' && <ReceiptDrawer ctx={ctx} products={products} close={close} />}
      {(draft?.kind === 'write-off' || draft?.kind === 'inventory') && (
        <QtyDrawer ctx={ctx} product={draft.product} mode={draft.kind} close={close} />
      )}
      {draft?.kind === 'lots' && <LotsDrawer ctx={ctx} product={draft.product} close={close} />}
    </div>
  );
}
