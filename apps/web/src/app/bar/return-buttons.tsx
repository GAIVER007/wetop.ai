'use client';
import { useState, useTransition } from 'react';
import { Button } from '../../components/ui';
import { useConfirm } from '../../components/use-confirm';
import { reverseBarSaleAction } from './actions';
import type { BarFormContext } from './context';
import { useT } from '../../i18n/locale-provider';

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
  const t = useT();
  const { ask, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const reverse = async (restock: boolean) => {
    const confirmed = await ask({
      title: t('Вернуть продажу на {amount}?', { amount: amountText }),
      body: restock
        ? t('Продажа будет сторнирована: деньги уйдут из кассы, товар вернётся на остаток.')
        : t('Продажа будет сторнирована: деньги уйдут из кассы, товар на остаток не вернётся (непригоден).'),
      confirmLabel: restock ? t('Вернуть на склад') : t('Вернуть без склада'),
      tone: 'danger',
    });
    if (!confirmed) return;
    const fd = new FormData();
    fd.set('barPropertyId', context.propertyId);
    fd.set('barCurrency', context.currency);
    fd.set('id', saleId);
    fd.set('restock', String(restock));
    fd.set('reason', restock ? 'Возврат продажи, товар пригоден' : 'Возврат продажи, товар непригоден'); // kk-allow: причина сторно хранится в журнале операций
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
          {t('Вернуть на склад')}
        </Button>
      )}
      <Button type="button" tone="ghost" size="xs" disabled={pending} onClick={() => reverse(false)}>
        {t('Без возврата на склад')}
      </Button>
      {error && <p role="alert" className="bar-error">{error}</p>}
    </div>
  );
}
