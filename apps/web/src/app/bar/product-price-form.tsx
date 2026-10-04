'use client';
import { useActionState } from 'react';
import { Button, Input } from '../../components/ui';
import { minorToInput } from '../../lib/money';
import { setBarProductPriceAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };

export function ProductPriceForm({ productId, salePrice }: { productId: string; salePrice: string }) {
  const [state, action, pending] = useActionState(setBarProductPriceAction, initial);
  return <form action={action} className="bar-price-form">
    <input type="hidden" name="id" value={productId} />
    <Input name="salePrice" inputMode="decimal" defaultValue={minorToInput(salePrice)} aria-label="Своя цена продажи в тенге" required />
    <Button type="submit" size="xs" disabled={pending}>{pending ? '...' : 'Сохранить'}</Button>
    {state.error && <small role="alert" className="bar-error">{state.error}</small>}
    {state.message && <small role="status" className="bar-success">{state.message}</small>}
  </form>;
}
