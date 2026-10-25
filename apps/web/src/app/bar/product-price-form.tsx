'use client';
import { useRef, useState } from 'react';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';

import { Button, Input } from '../../components/ui';
import { Icon } from '../../components/icon';
import { minorToInput } from '../../lib/money';
import { setBarProductPriceAction, type BarActionResult } from './actions';
import { useT } from '../../i18n/locale-provider';

const initial: BarActionResult = { error: null, ok: 0 };

/**
 * Цена продажи в строке номенклатуры (аудит 21.10.2026 п.16): сохраняется при уходе с поля или Enter, без синей кнопки
 * «Сохранить» в каждой строке; маленькая кнопка-галочка высотой с поле появляется только у изменённой цены
 * (владелец 25.10.2026: пустая растянутая кнопка в каждой строке выглядела криво).
 */
export function ProductPriceForm({
  productId,
  salePrice,
  context,
}: {
  context: BarFormContext;
  productId: string;
  salePrice: string;
}) {
  const t = useT();
  const [state, action, pending] = useBarAction(setBarProductPriceAction, initial);
  // сохранённая цена приходит с сервера после revalidate; по ней решаем, менялось ли поле
  const saved = useRef(minorToInput(salePrice));
  saved.current = minorToInput(salePrice);
  const [value, setValue] = useState<string | null>(null);
  const dirty = value !== null && value.trim() !== '' && value.trim() !== saved.current;
  return (
    <form onSubmit={action} className="bar-price-form">
      <BarContextFields context={context} />
      <input type="hidden" name="id" value={productId} />
      <span className="bar-price-form__field">
        <Input
          name="salePrice"
          inputMode="decimal"
          defaultValue={minorToInput(salePrice)}
          aria-label={t('Своя цена продажи в {currency}', { currency: context.currency })}
          required
          onChange={(event) => setValue(event.currentTarget.value)}
          onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (!value || value === saved.current || pending) return;
            event.currentTarget.form?.requestSubmit();
          }}
        />
        <span className="bar-price-form__suffix" aria-hidden="true">
          {context.currency === 'KZT' ? '₸' : context.currency}
        </span>
      </span>
      {dirty && (
        <Button type="submit" size="xs" tone="secondary" className="bar-price-form__save" disabled={pending} aria-label={t('Сохранить цену')} title={t('Сохранить цену')}>
          <Icon name="check" width={16} height={16} />
        </Button>
      )}
      {state.error && (
        <small role="alert" className="bar-error">
          {state.error}
        </small>
      )}
      {state.message && (
        <small role="status" className="bar-success">
          {state.message}
        </small>
      )}
    </form>
  );
}
