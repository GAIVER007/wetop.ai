'use client';
import { useEffect, useState } from 'react';
import { barMethodRu } from '@pms/domain';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';
import type { BarFolioRow } from '../../lib/api';
import type { MenuItemView } from '../../lib/food-types';
import { cartLinePrice, choiceProblem, toggleChoice } from '../../lib/food-modifiers';
import { formatMoney } from '../../lib/money';
import { Button, Field, Input, Select } from '../../components/ui';
import { Icon } from '../../components/icon';
import { sellBarMenuAction, type BarActionResult } from './actions';
import { useT } from '../../i18n/locale-provider';

const initial: BarActionResult = { error: null, ok: 0 };

/**
 * Продажа позиции «Меню бара» (DATA_MODEL §62.3): позиция, добавки, количество, оплата в кассу или в счёт гостя
 * (только гостиница). Продукты по техкарте и добавкам списываются со склада кухни на сервере. Отправка руками
 * (useBarAction): отказ не стирает введённое; ключ продажи стабилен до успеха или правки формы (D-KEY).
 */
export function MenuSaleForm({
  items,
  context,
  methods,
  folios,
}: {
  items: MenuItemView[];
  context: BarFormContext;
  methods: string[];
  /** открытые счета гостей; пусто у салона */
  folios: BarFolioRow[];
}) {
  const t = useT();
  const [state, action, pending] = useBarAction(sellBarMenuAction, initial);
  const [key, setKey] = useState('');
  const [itemId, setItemId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [qty, setQty] = useState('1');
  const [pay, setPay] = useState<string>(methods[0] ?? (folios.length ? 'FOLIO' : ''));
  useEffect(() => setKey(crypto.randomUUID()), [state.ok]);
  const active = items.filter((m) => m.active);
  const dish = active.find((m) => m.id === itemId) ?? null;
  const groups = dish?.modifierGroups ?? [];
  const problem = dish ? choiceProblem(groups, picked) : null;
  const count = /^\d+$/.test(qty) ? BigInt(qty) : 0n;
  const total = dish ? cartLinePrice(dish, picked) * count : 0n;
  const toFolio = pay === 'FOLIO';
  const touch = () => setKey(crypto.randomUUID());
  const choose = (g: (typeof groups)[number], id: string) => {
    setPicked(toggleChoice(picked, g, id));
    touch();
  };
  return (
    <form onSubmit={action} onChange={touch} className="bar-quick-form bar-menu-sale" data-testid="bar-menu-sale">
      <BarContextFields context={context} />
      <input type="hidden" name="idempotencyKey" value={key} />
      {picked.map((id) => (
        <input key={id} type="hidden" name="modifierIds" value={id} />
      ))}
      <div className="bar-inline bar-retail-fields">
        <Field label={t('Позиция меню')}>
          <Select
            name="menuItemId"
            required
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value);
              setPicked([]);
            }}
          >
            <option value="" disabled>
              {t('Выберите позицию')}
            </option>
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}, {formatMoney(m.priceMinor, m.currency)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('Количество')}>
          <Input name="quantityUnits" inputMode="numeric" pattern="[0-9]+" required value={qty} onChange={(e) => setQty(e.target.value)} className="bar-qty" />
        </Field>
        <Field label={t('Оплата')}>
          <Select name={toFolio ? undefined : 'method'} value={pay} onChange={(e) => setPay(e.target.value)}>
            {methods.map((m) => (
              <option key={m} value={m}>
                {t(barMethodRu(m))}
              </option>
            ))}
            {folios.length > 0 && <option value="FOLIO">{t('В счёт гостя')}</option>}
          </Select>
        </Field>
        {toFolio && (
          <Field label={t('Гость')}>
            <Select name="folioId" required defaultValue="">
              <option value="" disabled>
                {t('Выберите гостя')}
              </option>
              {folios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.guestName}, {f.unitCode ?? f.confirmationNumber}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {groups.map((g) => (
        <fieldset key={g.id} className="bar-menu-mods">
          <legend>
            {g.name}
            {g.required && <small> {t('обязательно')}</small>}
          </legend>
          {g.modifiers.map((m) => (
            <label key={m.id} className="bar-menu-mod">
              {g.maxSelect === 1 ? (
                <input type="radio" name={`bar-mod-${g.id}`} checked={picked.includes(m.id)} onChange={() => choose(g, m.id)} />
              ) : (
                <input type="checkbox" checked={picked.includes(m.id)} onChange={() => choose(g, m.id)} />
              )}
              <span>{m.name}</span>
              {BigInt(m.priceDeltaMinor) !== 0n && <small>{BigInt(m.priceDeltaMinor) > 0n ? '+' : ''}{formatMoney(m.priceDeltaMinor, dish!.currency)}</small>}
            </label>
          ))}
        </fieldset>
      ))}
      <div className="bar-menu-foot">
        {dish && (
          <strong data-testid="bar-menu-total">
            {t('Итого: {sum}', { sum: formatMoney(total, dish.currency) })}
          </strong>
        )}
        {problem && <span className="bar-muted">{problem}</span>}
        <Button type="submit" disabled={pending || !key || !dish || !!problem || count < 1n || !pay}>
          <Icon name="cart" width={16} height={16} /> {pending ? t('Выполняется…') : toFolio ? t('В счёт гостя') : t('Продать')}
        </Button>
      </div>
      {active.length === 0 && <p className="bar-muted">{t('Меню пустое: добавьте позиции ниже.')}</p>}
      {state.error && <p role="alert" className="bar-error">{state.error}</p>}
      {state.message && <p role="status" className="bar-success">{state.message}</p>}
    </form>
  );
}
