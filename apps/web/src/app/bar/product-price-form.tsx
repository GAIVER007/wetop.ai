'use client';
import { useRef } from 'react';
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
 * «Сохранить» в каждой строке; маленькая кнопка-галочка остаётся для мыши и читалки.
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
  return (
    <form onSubmit={action} className="bar-price-form">
      <BarContextFields context={context} />
      <input type="hidden" name="id" value={productId} />
      <Input
        name="salePrice"
        inputMode="decimal"
        defaultValue={minorToInput(salePrice)}
        aria-label={t('Своя цена продажи в {currency}', { currency: context.currency })}
        required
        onBlur={(event) => {
          const value = event.currentTarget.value.trim();
          if (!value || value === saved.current || pending) return;
          event.currentTarget.form?.requestSubmit();
        }}
      />
      <Button type="submit" size="xs" tone="ghost" disabled={pending} aria-label={t('Сохранить цену')} title={t('Сохранить цену')}>
        <Icon name="check" width={16} height={16} />
      </Button>
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
