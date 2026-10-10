'use client';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';

import { Button, Input } from '../../components/ui';
import { minorToInput } from '../../lib/money';
import { setBarProductPriceAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };

export function ProductPriceForm({
  productId,
  salePrice,
  context,
}: {
  context: BarFormContext;
  productId: string;
  salePrice: string;
}) {
  const [state, action, pending] = useBarAction(setBarProductPriceAction, initial);
  return (
    <form onSubmit={action} className="bar-price-form">
      <BarContextFields context={context} />
      <input type="hidden" name="id" value={productId} />
      <Input
        name="salePrice"
        inputMode="decimal"
        defaultValue={minorToInput(salePrice)}
        aria-label={`Своя цена продажи в ${context.currency}`}
        required
      />
      <Button type="submit" size="xs" disabled={pending}>
        {pending ? '...' : 'Сохранить'}
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
