'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { IconField } from '../../components/icon-field';
import { Tabs } from '../../components/tabs';
import { Chip } from '../../components/chip';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Table,
} from '../../components/ui';
import { wholeTenge } from '../../lib/dashboard-format';
import { formatMoney } from '../../lib/money';
import type { WebVertical } from '../../lib/vertical-landing';
import type {
  PrepRecipeView,
  StockLotView,
  StockMovementView,
  StockProductKind,
  StockProductView,
  StockUnit,
} from '../../lib/food-types';
import { loadLots, loadPrepRecipe, mutateStock } from './stock-actions';
import { intlLocale, msg, translator, type Translate } from '../../i18n';
import { dateFormat } from '../../i18n/dates';
import { useLocale, useT } from '../../i18n/locale-provider';
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
  /** пояс филиала для времени движений; без него время по UTC, одинаково на сервере и в браузере */
  timezone?: string;
}

const stockNouns = (ctx: StockCtx) =>
  ctx.vertical === 'BEAUTY'
    ? {
        oneTitle: msg('Расходник'),
        count: msg('Расходников'),
        edit: msg('Изменить расходник'),
        create: msg('Новый расходник'),
        noLots: msg('Приходов по расходнику ещё не было'),
        search: msg('Поиск по расходникам'),
        first: msg('Добавьте первый расходник'),
        add: msg('+ Расходник'),
      }
    : {
        oneTitle: msg('Ингредиент'),
        count: msg('Ингредиентов'),
        edit: msg('Изменить ингредиент'),
        create: msg('Новый ингредиент'),
        noLots: msg('Приходов по ингредиенту ещё не было'),
        search: msg('Поиск по ингредиентам'),
        first: msg('Добавьте первый ингредиент'),
        add: msg('+ Ингредиент'),
      };

const stockMoney = (minor: string | bigint, ctx: StockCtx) =>
  ctx.vertical === 'BEAUTY'
    ? formatMoney(minor, ctx.currency)
    : wholeTenge(minor.toString(), ctx.currency);

const UNITS: StockUnit[] = ['г', 'мл', 'шт']; // kk-allow: единицы как значения API; подпись переводится при показе
const PRICE_UNIT: Record<StockUnit, string> = { г: msg('кг'), мл: msg('л'), шт: msg('шт') }; // kk-allow: ключи это значения единиц
const KIND_LABEL: Record<StockMovementView['kind'], string> = {
  RECEIPT: msg('Приход'),
  WRITE_OFF: msg('Списание'),
  INVENTORY: msg('Инвентаризация'),
  REVERSAL: msg('Сторно прихода'),
  // §38: движения по заказам
  CONSUMPTION: msg('Расход по заказу'),
  SHORTAGE: msg('Недостача по заказу'),
  CONSUMPTION_RETURN: msg('Возврат по отмене'),
  // §62: заготовки
  PRODUCTION_OUT: msg('Расход на заготовку'),
  PRODUCTION_IN: msg('Приготовлено'),
};

/** Сумма в выбранной валюте с двумя десятичными знаками, в целых младших единицах. */
export function stockMoneyInputToMinor(raw: string, field: string, currency: string, t: Translate = translator('ru')): number {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw.trim());
  if (!m) throw new Error(t('{field}: укажите сумму в {currency}', { field, currency }));
  const minor = BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0') || '0');
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(t('{field}: сумма слишком большая', { field }));
  return Number(minor);
}
const qtyText = (qty: string, unit: string) => `${qty.replace('.', ',')} ${unit}`;
const dateText = (iso: string) => iso.split('-').reverse().join('.');

function useSave(close: () => void) {
  const t = useT();
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
          setError(e instanceof Error ? e.message : t('Не удалось сохранить'));
        }
      });
    },
  };
}

function ProductDrawer({ ctx, product, close }: { ctx: StockCtx; product: StockProductView | null; close: () => void }) {
  const t = useT();
  const save = useSave(close);
  const nouns = stockNouns(ctx);
  return (
    <Overlay open drawer trapFocus onClose={close} className="food-drawer" title={product ? t(nouns.edit) : t(nouns.create)}>
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
            kind: String(f.get('kind') || 'RAW') as StockProductKind,
          };
          save.run(() =>
            mutateStock(ctx.scopeKey, product ? { kind: 'product', id: product.id, body } : { kind: 'product', body }),
          );
        }}
      >
        <Field label={t('Название')}>
          <Input name="name" required maxLength={200} defaultValue={product?.name ?? ''} />
        </Field>
        <Field label={t('Вид')} controlId="stock-product-kind" hint={t('Заготовку готовят у вас из других продуктов: соус, тесто, колбаса, сироп')}>
          <Select name="kind" defaultValue={product?.kind ?? 'RAW'}>
            <option value="RAW">{t('Покупаем готовым')}</option>
            <option value="PREP">{t('Заготовка')}</option>
          </Select>
        </Field>
        <div className="food-form-row">
          <Field label={t('Единица')}>
            <Select name="unit" defaultValue={product?.unit ?? 'г'}>{/* kk-allow: значение единицы */}
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(u)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Минимальный остаток')}>
            <Input name="minQty" inputMode="decimal" defaultValue={product?.minQty ?? '0'} />
          </Field>
        </div>
        <label className="food-check">
          <input name="active" type="checkbox" defaultChecked={product?.active ?? true} />
          {t('Используется (снимите, чтобы убрать из прихода)')}
        </label>
        {save.error && <Alert tone="warning">{save.error}</Alert>}
        <Button disabled={save.pending}>{save.pending ? t('Сохраняем…') : product ? t('Сохранить') : t('Создать')}</Button>
      </form>
    </Overlay>
  );
}

type Line = { productId: string; qty: string; price: string; expiresOn: string };
function ReceiptDrawer({ ctx, products, close }: { ctx: StockCtx; products: StockProductView[]; close: () => void }) {
  const t = useT();
  const save = useSave(close);
  const nouns = stockNouns(ctx);
  // заготовку не покупают: она приходит кнопкой «Приготовили» (§62)
  const active = products.filter((p) => p.active && p.kind !== 'PREP');
  const blank = (): Line => ({ productId: active[0]?.id ?? '', qty: '', price: '', expiresOn: '' });
  const [lines, setLines] = useState<Line[]>([blank()]);
  const unitOf = (id: string) => active.find((p) => p.id === id)?.unit ?? 'г'; // kk-allow: значение единицы
  const patch = (i: number, part: Partial<Line>) =>
    setLines((all) => all.map((l, k) => (k === i ? { ...l, ...part } : l)));
  return (
    <Overlay open drawer trapFocus onClose={close} className="food-drawer" title={t('Приход на склад')}>
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
                unitCost: stockMoneyInputToMinor(l.price, t('Строка {n}, цена', { n: i + 1 }), ctx.currency, t),
                expiresOn: l.expiresOn || null,
              })),
            };
            return mutateStock(ctx.scopeKey, { kind: 'receipt', body });
          });
        }}
      >
        <div className="food-form-row">
          <Field label={t('Поставщик')}>
            <Input name="supplier" maxLength={200} />
          </Field>
          <Field label={t('Номер накладной')}>
            <Input name="document" maxLength={100} />
          </Field>
        </div>
        <Field label={t('Дата прихода (пусто: сегодня)')}>
          <Input name="receivedOn" type="date" />
        </Field>
        {lines.map((l, i) => (
          <fieldset key={i} className="food-form" aria-label={t('Строка {n}', { n: i + 1 })}>
            <Field label={t(nouns.oneTitle)}>
              <Select value={l.productId} onChange={(e) => patch(i, { productId: e.target.value })}>
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="food-form-row">
              <Field label={t('Количество, {unit}', { unit: t(unitOf(l.productId)) })}>
                <Input required inputMode="decimal" value={l.qty} onChange={(e) => patch(i, { qty: e.target.value })} />
              </Field>
              <Field
                label={t('Цена за {unit}, {currency}', {
                  unit: t(PRICE_UNIT[unitOf(l.productId)]),
                  currency: ctx.currency === 'KZT' ? '₸' : ctx.currency,
                })}
              >
                <Input required inputMode="decimal" value={l.price} onChange={(e) => patch(i, { price: e.target.value })} />
              </Field>
            </div>
            <Field label={t('Годен до')}>
              <Input type="date" value={l.expiresOn} onChange={(e) => patch(i, { expiresOn: e.target.value })} />
            </Field>
            {lines.length > 1 && (
              <Button type="button" tone="ghost" size="sm" onClick={() => setLines((all) => all.filter((_, k) => k !== i))}>
                {t('Убрать строку {n}', { n: i + 1 })}
              </Button>
            )}
          </fieldset>
        ))}
        {lines.length < 50 && (
          <Button type="button" tone="secondary" onClick={() => setLines((all) => [...all, blank()])}>
            {t('+ Строка')}
          </Button>
        )}
        {save.error && <Alert tone="warning">{save.error}</Alert>}
        <Button disabled={save.pending}>{save.pending ? t('Проводим…') : t('Провести приход')}</Button>
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
  const t = useT();
  const save = useSave(close);
  const empty = mode === 'inventory' && Number(product.onHand) === 0;
  return (
    <Overlay
      open
      drawer
      trapFocus
      onClose={close}
      className="food-drawer"
      title={mode === 'write-off' ? t('Списание: {name}', { name: product.name }) : t('Инвентаризация: {name}', { name: product.name })}
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
              ? { unitCost: stockMoneyInputToMinor(String(f.get('price')), t('Цена излишка'), ctx.currency, t) }
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
        <p className="muted">{t('По учёту: {qty}', { qty: qtyText(product.onHand, t(product.unit)) })}</p>
        <Field
          label={
            mode === 'write-off'
              ? t('Списать, {unit}', { unit: t(product.unit) })
              : t('Фактически на складе, {unit}', { unit: t(product.unit) })
          }
        >
          <Input name="qty" required inputMode="decimal" />
        </Field>
        {empty && (
          <Field
            label={t('Цена излишка за {unit}, {currency}', {
              unit: t(PRICE_UNIT[product.unit as keyof typeof PRICE_UNIT]),
              currency: ctx.currency === 'KZT' ? '₸' : ctx.currency,
            })}
            hint={t('На складе пусто: найденное примем по этой цене')}
            controlId="stock-surplus-price"
          >
            <Input name="price" required inputMode="decimal" />
          </Field>
        )}
        <Field label={mode === 'write-off' ? t('Причина') : t('Комментарий')}>
          <Input name="reason" required={mode === 'write-off'} maxLength={500} />
        </Field>
        {save.error && <Alert tone="warning">{save.error}</Alert>}
        <Button disabled={save.pending}>{save.pending ? t('Сохраняем…') : mode === 'write-off' ? t('Списать') : t('Сверить')}</Button>
      </form>
    </Overlay>
  );
}

function LotsDrawer({ ctx, product, close }: { ctx: StockCtx; product: StockProductView; close: () => void }) {
  const t = useT();
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
    <Overlay open drawer trapFocus onClose={close} className="food-drawer" title={t('Партии: {name}', { name: product.name })}>
      <div className="food-form">
        {dialog}
        {error && <Alert tone="warning">{error}</Alert>}
        {lots === null ? (
          <p role="status">{t('Загружаем партии…')}</p>
        ) : lots.length === 0 ? (
          <EmptyState title={t(nouns.noLots)} />
        ) : (
          <ul className="food-catalog-list">
            {lots.map((l) => (
              <li key={l.id}>
                <div>
                  <strong>{dateText(l.receivedOn)}</strong>
                  <span>
                    {t('Остаток {left} из {received}, цена за {unit} {price}', {
                      left: qtyText(l.remainingQty, t(product.unit)),
                      received: qtyText(l.receivedQty, t(product.unit)),
                      unit: t(PRICE_UNIT[product.unit]),
                      price: stockMoney(l.unitCostMinor, ctx),
                    })}
                  </span>
                  {l.supplier && <span>{l.supplier}</span>}
                </div>
                {l.reversed ? (
                  <Badge tone="neutral">{t('Сторнирован')}</Badge>
                ) : l.reversible && (ctx.canDelete ?? ctx.canProperty ?? false) ? (
                  <Button
                    tone="secondary"
                    size="sm"
                    disabled={pending}
                    aria-label={t('Сторнировать приход от {date}', { date: dateText(l.receivedOn) })}
                    onClick={async () => {
                      // сторно пишет обратное движение в ленту, которая только дописывается (§34)
                      if (
                        !(await ask({
                          title: t('Сторнировать приход от {date}?', { date: dateText(l.receivedOn) }),
                          body: t('{name}: партия на {qty} уйдёт из остатка, в ленте появится «Сторно прихода». Отменить сторно нельзя.', {
                            name: product.name,
                            qty: qtyText(l.receivedQty, t(product.unit)),
                          }),
                          confirmLabel: t('Сторнировать'),
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
                    {t('Сторно')}
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

type RecipeLine = { ingredientId: string; normQty: string };
/** §62: техкарта заготовки: сколько каждого продукта уходит на выход (например, на 1 000 г колбасы) */
function RecipeDrawer({
  ctx,
  product,
  products,
  canEdit,
  close,
}: {
  ctx: StockCtx;
  product: StockProductView;
  products: StockProductView[];
  canEdit: boolean;
  close: () => void;
}) {
  const t = useT();
  const save = useSave(close);
  const [recipe, setRecipe] = useState<PrepRecipeView | null>(null);
  const [yieldQty, setYieldQty] = useState('');
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const choices = products.filter((p) => p.id !== product.id && p.active);
  const unitOf = (id: string) => products.find((p) => p.id === id)?.unit ?? 'г'; // kk-allow: значение единицы
  useEffect(() => {
    void loadPrepRecipe(ctx.scopeKey, product.id).then((r) => {
      if (r.error) save.setError(r.error);
      setRecipe(r.recipe);
      setYieldQty(r.recipe?.yieldQty ?? '');
      setLines(
        r.recipe?.lines.length
          ? r.recipe.lines.map((l) => ({ ingredientId: l.ingredientId, normQty: l.normQty }))
          : [{ ingredientId: choices[0]?.id ?? '', normQty: '' }],
      );
    });
  }, [product.id]);
  const patch = (i: number, part: Partial<RecipeLine>) =>
    setLines((all) => all.map((l, k) => (k === i ? { ...l, ...part } : l)));
  return (
    <Overlay open drawer trapFocus onClose={close} className="food-drawer" title={t('Техкарта: {name}', { name: product.name })}>
      {recipe === null && !save.error ? (
        <p role="status">{t('Загружаем техкарту…')}</p>
      ) : (
        <form
          className="food-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.run(() =>
              mutateStock(ctx.scopeKey, {
                kind: 'recipe',
                id: product.id,
                body: {
                  yieldQty: yieldQty.replace(',', '.'),
                  lines: lines.map((l) => ({ ingredientId: l.ingredientId, normQty: l.normQty.replace(',', '.') })),
                },
              }),
            );
          }}
        >
          <Field
            label={t('Выход, {unit}', { unit: t(product.unit) })}
            controlId="stock-prep-yield"
            hint={t('Сколько заготовки получается из состава ниже')}
          >
            <Input required inputMode="decimal" disabled={!canEdit} value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} />
          </Field>
          {lines.map((l, i) => (
            <fieldset key={i} className="food-form-row" aria-label={t('Продукт {n}', { n: i + 1 })}>
              <Field label={t('Продукт')}>
                <Select disabled={!canEdit} value={l.ingredientId} onChange={(e) => patch(i, { ingredientId: e.target.value })}>
                  {choices.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('Норма, {unit}', { unit: t(unitOf(l.ingredientId)) })}>
                <Input required inputMode="decimal" disabled={!canEdit} value={l.normQty} onChange={(e) => patch(i, { normQty: e.target.value })} />
              </Field>
              {canEdit && lines.length > 1 && (
                <Button type="button" tone="ghost" size="sm" onClick={() => setLines((all) => all.filter((_, k) => k !== i))}>
                  {t('Убрать {n}', { n: i + 1 })}
                </Button>
              )}
            </fieldset>
          ))}
          {canEdit && lines.length < 50 && choices.length > 0 && (
            <Button type="button" tone="secondary" onClick={() => setLines((all) => [...all, { ingredientId: choices[0]!.id, normQty: '' }])}>
              {t('+ Продукт')}
            </Button>
          )}
          {save.error && <Alert tone="warning">{save.error}</Alert>}
          {canEdit && <Button disabled={save.pending}>{save.pending ? t('Сохраняем…') : t('Сохранить техкарту')}</Button>}
        </form>
      )}
    </Overlay>
  );
}

/** §62: «Приготовили»: продукты по техкарте уходят со склада сейчас, заготовка приходит партией по их себестоимости */
function ProduceDrawer({ ctx, product, close }: { ctx: StockCtx; product: StockProductView; close: () => void }) {
  const t = useT();
  const save = useSave(close);
  return (
    <Overlay open drawer trapFocus onClose={close} className="food-drawer" title={t('Приготовили: {name}', { name: product.name })}>
      <form
        className="food-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          save.run(() =>
            mutateStock(ctx.scopeKey, {
              kind: 'produce',
              body: {
                productId: product.id,
                qty: String(f.get('qty')).replace(',', '.'),
                expiresOn: String(f.get('expiresOn')) || null,
              },
            }),
          );
        }}
      >
        <p className="muted">
          {t('Продукты по техкарте спишутся со склада сейчас. Если чего-то не хватит, спишем остаток и запишем недостачу.')}
        </p>
        <Field label={t('Сколько приготовили, {unit}', { unit: t(product.unit) })}>
          <Input name="qty" required inputMode="decimal" />
        </Field>
        <Field label={t('Годен до')}>
          <Input name="expiresOn" type="date" />
        </Field>
        {save.error && <Alert tone="warning">{save.error}</Alert>}
        <Button disabled={save.pending}>{save.pending ? t('Проводим…') : t('Приготовили')}</Button>
      </form>
    </Overlay>
  );
}

type Draft =
  | { kind: 'product'; product: StockProductView | null }
  | { kind: 'receipt' }
  | { kind: 'write-off' | 'inventory' | 'lots' | 'recipe' | 'produce'; product: StockProductView };

export function StockBoard({
  ctx,
  products,
  movements,
}: {
  ctx: StockCtx;
  products: StockProductView[];
  movements: StockMovementView[];
}) {
  const t = useT();
  const locale = useLocale();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState('');
  // неиспользуемые позиции скрыты, пока их не попросили (владелец 25.10.2026)
  const [showIdle, setShowIdle] = useState(false);
  const close = () => setDraft(null);
  const canCreateProduct = ctx.canCreate ?? ctx.canProperty ?? false;
  const canReceive = ctx.canCreate ?? ctx.canDesk ?? false;
  const canUpdateProduct = ctx.canUpdate ?? ctx.canProperty ?? false;
  const canUpdateStock = ctx.canUpdate ?? ctx.canDesk ?? false;
  const nouns = stockNouns(ctx);
  const total = products.reduce((sum, p) => sum + BigInt(p.valueMinor), 0n);
  const low = products.filter((p) => p.active && p.low).length;
  const q = query.trim().toLocaleLowerCase('ru');
  // момент движения в поясе филиала: «22 окт., 01:06» на языке человека
  const timeZone = ctx.timezone ?? 'UTC';
  const moment = (iso: string) =>
    `${dateFormat(intlLocale(locale), { day: 'numeric', month: 'short', timeZone }).format(new Date(iso))}, ${dateFormat(intlLocale(locale), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(iso))}`;
  const idleCount = products.filter((p) => !p.active).length;
  const shown = products.filter(
    (p) => (showIdle || p.active) && (q === '' || p.name.toLocaleLowerCase('ru').includes(q)),
  );

  // кнопки в строке поиска над таблицей, а не отдельной строкой с пустым местом (аудит 21.10.2026 п.40)
  const actions = (canCreateProduct || (canReceive && products.some((p) => p.active))) && (
    <div className="food-inline-actions">
      {canCreateProduct && (
        <Button tone="secondary" onClick={() => setDraft({ kind: 'product', product: null })}>
          {t(nouns.add)}
        </Button>
      )}
      {canReceive && products.some((p) => p.active && p.kind !== 'PREP') && (
        <Button onClick={() => setDraft({ kind: 'receipt' })}>{t('+ Приход товара')}</Button>
      )}
    </div>
  );
  const stockTable =
    products.length === 0 ? (
      // пусто одной короткой строкой, как на /bar (владелец 25.10.2026)
      <>
        <p className="bar-muted">{t(nouns.first)}</p>
        {actions}
      </>
    ) : (
      <div className="rest-card">
        {/* строка поиска с кнопками (аудит 21.10.2026 п.40) в виде /bar (владелец 25.10.2026) */}
        <div className="rest-card__tools bar-products-tools">
          <IconField icon="search">
            <Input aria-label={t(nouns.search)} placeholder={t(nouns.search)} value={query} onChange={(e) => setQuery(e.target.value)} />
          </IconField>
          {idleCount > 0 && (
            <Chip size="sm" selected={showIdle} count={idleCount} onClick={() => setShowIdle((v) => !v)}>
              {t('Показать неиспользуемые')}
            </Chip>
          )}
          {actions}
        </div>
        {shown.length === 0 ? (
          <p className="bar-muted">{t('Ничего не найдено')}</p>
        ) : (
          <Table density="compact" sticky="header" className="bar-products-grid" aria-label={t('Остатки склада')}>
            <thead>
              <tr>
                {[nouns.oneTitle, msg('Остаток'), msg('Минимум'), msg('Стоимость'), msg('Годен до'), msg('Статус')].map((h, i) => (
                  <th key={h} className={i === 0 ? 'bar-products-grid__name' : undefined}>{t(h)}</th>
                ))}
                <th>
                  <span className="sr-only">{t('Действия')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                // нехватку показывает только значок «Мало» или «Нет на складе», без заливки ячеек (п.41)
                <tr key={p.id}>
                  <td>
                    {p.name}
                    {p.kind === 'PREP' && (
                      <>
                        {' '}
                        <Badge tone="info">{t('Заготовка')}</Badge>
                      </>
                    )}
                  </td>
                  <td className="rest-stock-qty">{qtyText(p.onHand, t(p.unit))}</td>
                  <td className="rest-stock-qty">{qtyText(p.minQty, t(p.unit))}</td>
                  <td>{stockMoney(p.valueMinor, ctx)}</td>
                  <td>{p.nearestExpiry ? <time dateTime={p.nearestExpiry}>{dateText(p.nearestExpiry)}</time> : '—'}</td>
                  <td>
                    {!p.active ? (
                      <Badge tone="neutral">{t('Не используется')}</Badge>
                    ) : p.onHand === '0' ? (
                      <Badge tone="danger">{t('Нет на складе')}</Badge>
                    ) : p.low ? (
                      <Badge tone="warn">{t('Мало')}</Badge>
                    ) : (
                      <Badge tone="ok">{t('В норме')}</Badge>
                    )}
                  </td>
                  <td>
                    <div className="food-inline-actions">
                      {p.kind === 'PREP' && canReceive && p.active && (
                        <Button tone="secondary" size="xs" aria-label={t('Приготовили: {name}', { name: p.name })} onClick={() => setDraft({ kind: 'produce', product: p })}>
                          {t('Приготовили')}
                        </Button>
                      )}
                      {p.kind === 'PREP' && (
                        <Button tone="secondary" size="xs" aria-label={t('Техкарта: {name}', { name: p.name })} onClick={() => setDraft({ kind: 'recipe', product: p })}>
                          {t('Техкарта')}
                        </Button>
                      )}
                      <Button tone="secondary" size="xs" aria-label={t('Партии: {name}', { name: p.name })} onClick={() => setDraft({ kind: 'lots', product: p })}>
                        {t('Партии')}
                      </Button>
                      {canUpdateStock && p.onHand !== '0' && (
                        <Button tone="secondary" size="xs" aria-label={t('Списать: {name}', { name: p.name })} onClick={() => setDraft({ kind: 'write-off', product: p })}>
                          {t('Списать')}
                        </Button>
                      )}
                      {canUpdateStock && (
                        <Button tone="secondary" size="xs" aria-label={t('Инвентаризация: {name}', { name: p.name })} onClick={() => setDraft({ kind: 'inventory', product: p })}>
                          {t('Инвентаризация')}
                        </Button>
                      )}
                      {canUpdateProduct && (
                        <Button tone="secondary" size="xs" aria-label={t('Изменить: {name}', { name: p.name })} onClick={() => setDraft({ kind: 'product', product: p })}>
                          {t('Изменить')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {/* итог строкой под таблицей вместо трёх плиток над ней (правило владельца «без плиток», п.8) */}
        <p className="muted" data-testid="stock-totals">
          {t(nouns.count)}: {products.filter((p) => p.active).length}, {t('стоимость остатка')}{' '}
          <b data-testid="stock-value">{stockMoney(total, ctx)}</b>, {t('мало на складе')}{' '}
          <b data-testid="stock-low">{low}</b>
        </p>
      </div>
    );

  const movementTable =
    movements.length === 0 ? (
      <p className="bar-muted">{t('Движений пока нет')}</p>
    ) : (
      <Table density="compact" caption={t('Последние 200 движений склада')} captionHidden>
        <thead>
          <tr>
            {[msg('Когда'), nouns.oneTitle, msg('Операция'), msg('Количество'), msg('Сумма'), msg('Основание')].map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td>
                <time dateTime={m.createdAt}>{moment(m.createdAt)}</time>
              </td>
              <td>{m.productName}</td>
              <td>{t(KIND_LABEL[m.kind])}</td>
              <td>{qtyText(m.qty, t(m.unit))}</td>
              <td>{stockMoney(m.costMinor, ctx)}</td>
              <td>{m.reason ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

  return (
    <div className="food-workspace">
      <Tabs
        className="rest-tabs-line"
        label={t('Склад')}
        panels={[
          { id: 'stock', label: t('Остатки'), content: stockTable },
          { id: 'movements', label: t('Движения'), content: movementTable },
        ]}
      />
      {draft?.kind === 'product' && <ProductDrawer ctx={ctx} product={draft.product} close={close} />}
      {draft?.kind === 'receipt' && <ReceiptDrawer ctx={ctx} products={products} close={close} />}
      {(draft?.kind === 'write-off' || draft?.kind === 'inventory') && (
        <QtyDrawer ctx={ctx} product={draft.product} mode={draft.kind} close={close} />
      )}
      {draft?.kind === 'lots' && <LotsDrawer ctx={ctx} product={draft.product} close={close} />}
      {draft?.kind === 'recipe' && (
        <RecipeDrawer ctx={ctx} product={draft.product} products={products} canEdit={canUpdateProduct} close={close} />
      )}
      {draft?.kind === 'produce' && <ProduceDrawer ctx={ctx} product={draft.product} close={close} />}
    </div>
  );
}
