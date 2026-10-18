'use client';
import { useState, useTransition } from 'react';
import { Button } from '../../components/ui';
import { useConfirm } from '../../components/use-confirm';
import { reverseBarSaleAction } from './actions';
import type { BarFormContext } from './context';

/**
 * Возврат продажи бара с подтверждением (ADR-182, DESIGN.md §14): сторно гасит кассовую операцию
 * безвозвратно, поэтому вопрос с суммой и последствием вместо кнопки в один клик. Двойная отправка
 * закрыта pending: обе кнопки гаснут на время запроса.
 */
export function BarReturnButtons({
  saleId,
  amountText,
  context,
  canRestock,
}: {
  saleId: string;
  amountText: string;
  context: BarFormContext;
  canRestock: boolean;
}) {
  const { ask, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const reverse = async (restock: boolean) => {
    const confirmed = await ask({
      title: `Вернуть продажу на ${amountText}?`,
      body: restock
        ? 'Продажа будет сторнирована: деньги уйдут из кассы, товар вернётся на остаток.'
        : 'Продажа будет сторнирована: деньги уйдут из кассы, товар на остаток не вернётся (непригоден).',
      confirmLabel: restock ? 'Вернуть на склад' : 'Вернуть без склада',
      tone: 'danger',
    });
    if (!confirmed) return;
    const fd = new FormData();
    fd.set('barPropertyId', context.propertyId);
    fd.set('barCurrency', context.currency);
    fd.set('id', saleId);
    fd.set('restock', String(restock));
    fd.set('reason', restock ? 'Возврат продажи, товар пригоден' : 'Возврат продажи, товар непригоден');
    start(async () => {
      // отказ сервера (объект или валюта формы устарели, касса не даёт вернуть) показываем словами, а не молчим
      const result = await reverseBarSaleAction(fd);
      setError(result.error);
    });
  };
  return (
    <div className="bar-return">
      {dialog}
      {canRestock && (
        <Button type="button" tone="ghost" size="xs" disabled={pending} onClick={() => reverse(true)}>
          Вернуть на склад
        </Button>
      )}
      <Button type="button" tone="ghost" size="xs" disabled={pending} onClick={() => reverse(false)}>
        Без возврата на склад
      </Button>
      {error && <p role="alert" className="bar-error">{error}</p>}
    </div>
  );
}
