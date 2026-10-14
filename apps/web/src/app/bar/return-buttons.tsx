'use client';
import { useTransition } from 'react';
import { Button } from '../../components/ui';
import { useConfirm } from '../../components/use-confirm';
import { reverseBarSaleAction } from './actions';

/**
 * Возврат продажи бара с подтверждением (ADR-182, DESIGN.md §14): сторно гасит кассовую операцию
 * безвозвратно, поэтому вопрос с суммой и последствием вместо кнопки в один клик. Двойная отправка
 * закрыта pending: обе кнопки гаснут на время запроса.
 */
export function BarReturnButtons({ saleId, amountText }: { saleId: string; amountText: string }) {
  const { ask, dialog } = useConfirm();
  const [pending, start] = useTransition();
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
    fd.set('id', saleId);
    fd.set('restock', String(restock));
    fd.set('reason', restock ? 'Возврат гостя, товар пригоден' : 'Возврат гостя, товар непригоден');
    start(async () => {
      await reverseBarSaleAction(fd);
    });
  };
  return (
    <div className="bar-return">
      {dialog}
      <Button type="button" tone="ghost" size="xs" disabled={pending} onClick={() => reverse(true)}>
        Вернуть на склад
      </Button>
      <Button type="button" tone="ghost" size="xs" disabled={pending} onClick={() => reverse(false)}>
        Без возврата на склад
      </Button>
    </div>
  );
}
