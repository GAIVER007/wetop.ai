'use client';
import { useState } from 'react';
import { ActionMenu } from '../../components/action-menu';
import { AmountBadge } from '../../components/amount-badge';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { Icon } from '../../components/icon';
import { Toast, ToastProvider, useToast, type ToastItem } from '../../components/toast';
import { Tooltip } from '../../components/tooltip';
import { Button } from '../../components/ui';

/** Живые образцы пяти новых компонентов (DESIGN.md §8): открываются и закрываются по-настоящему. */

export function LiveActionMenu() {
  const [last, setLast] = useState<string | null>(null);
  const items = [
    { id: 'move', label: 'Переселить', icon: 'bed' as const, hint: 'та же категория — без пересчёта', onSelect: () => setLast('Переселить') },
    { id: 'extend', label: 'Продлить на ночь', icon: 'plus' as const, onSelect: () => setLast('Продлить на ночь') },
    { id: 'checkin', label: 'Заселить', icon: 'arrival' as const, disabled: true, hint: 'нет гражданства' },
    { id: 'cancel', label: 'Отменить со штрафом', icon: 'incidents' as const, tone: 'danger' as const, onSelect: () => setLast('Отменить со штрафом') },
  ];
  return (
    <div className="ds-inline">
      <ActionMenu items={items} />
      <ActionMenu items={items} compact label="Действия с бронью" />
      <span className="ds-freshness" data-testid="action-menu-last">
        {last ? `выбрано: ${last}` : 'ничего не выбрано'}
      </span>
    </div>
  );
}

export function LiveConfirm() {
  const [open, setOpen] = useState<'move' | 'cancel' | null>(null);
  const [pending, setPending] = useState<string | undefined>();
  const [done, setDone] = useState<string | null>(null);
  const confirm = (what: string) => {
    setPending(what === 'move' ? 'Переселяю…' : 'Отменяю…');
    setTimeout(() => {
      setPending(undefined);
      setOpen(null);
      setDone(what === 'move' ? 'переселение подтверждено' : 'отмена подтверждена');
    }, 600);
  };
  return (
    <div className="ds-inline">
      <Button type="button" tone="secondary" onClick={() => setOpen('move')}>
        Переселить в другую категорию
      </Button>
      <Button type="button" tone="danger" onClick={() => setOpen('cancel')}>
        Отменить со штрафом
      </Button>
      <span className="ds-freshness" data-testid="confirm-last">
        {done ?? 'ничего не подтверждено'}
      </span>
      <ConfirmDialog
        open={open === 'move'}
        title="Переселить в двухместный номер R04?"
        consequence="Счёт будет пересчитан по тарифу новой категории на весь срок проживания."
        amount={
          <>
            <span>Новая сумма за 3 ночи</span>
            <b>45 000 ₸</b>
          </>
        }
        confirmLabel="Переселить и пересчитать"
        pending={pending}
        onConfirm={() => confirm('move')}
        onCancel={() => setOpen(null)}
      >
        <p>Гость Әбдірахманова Гүлнұр, бронь 20260913-SHOWTN, сейчас койка M03.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={open === 'cancel'}
        title="Отменить бронь 20260913-SHOWTN?"
        tone="danger"
        consequence="Штраф за первую ночь останется на счёте, место вернётся в продажу."
        amount={
          <>
            <span>Штраф по тарифу</span>
            <b>8 000 ₸</b>
          </>
        }
        confirmLabel="Отменить со штрафом"
        pending={pending}
        onConfirm={() => confirm('cancel')}
        onCancel={() => setOpen(null)}
      >
        <p>Отмена необратима: восстановить бронь можно только новой бронью.</p>
      </ConfirmDialog>
    </div>
  );
}

function ToastButtons() {
  const { push } = useToast();
  return (
    <div className="ds-inline">
      <Button type="button" tone="secondary" onClick={() => push({ tone: 'ok', text: 'Проживание продлено до 17.09.2026', action: { label: 'Открыть бронь', href: '#toast' } })}>
        Показать «Проживание продлено»
      </Button>
      <Button type="button" tone="secondary" onClick={() => push({ tone: 'danger', text: 'Не удалось отправить остаток в Channex: очередь ждёт повтора' })}>
        Показать ошибку
      </Button>
    </div>
  );
}
export function LiveToast() {
  return (
    <ToastProvider>
      <ToastButtons />
    </ToastProvider>
  );
}

/** Уведомления как статичные образцы — для снимка и восьми состояний, без таймера. */
export function StaticToast({ item }: { item: Omit<ToastItem, 'id'> }) {
  return <Toast item={{ id: 0, ...item }} onClose={() => undefined} autoHide={false} />;
}

export function LiveTooltip() {
  return (
    <div className="ds-inline">
      <Tooltip text="Открыть карточку гостя: документы, история проживаний, счета">
        <button type="button" className="icon-button" aria-label="Карточка гостя">
          <Icon name="guests" />
        </button>
      </Tooltip>
      <Tooltip text="Остаток по счёту после предоплаты канала" side="bottom">
        <span tabIndex={0}>
          <AmountBadge amountMinor="1600000" kind="due" />
        </span>
      </Tooltip>
      <span className="ds-freshness">наведите или перейдите Tab — подсказка откроется, Escape закроет</span>
    </div>
  );
}
