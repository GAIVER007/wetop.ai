'use client';
import { useState } from 'react';
import { ActionMenu } from '../../components/action-menu';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { ErrorState } from '../../components/error-state';
import { ToastProvider, ToastRegion, useToast } from '../../components/toast';
import { Tooltip } from '../../components/tooltip';
import { Button } from '../../components/ui';

/** Живые примеры компонентов с состоянием: окно, уведомление, меню, подсказка. */
export function ConfirmDemo() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="row" data-state="live">
      <Button type="button" tone="danger" onClick={() => setOpen(true)}>
        Отменить бронь…
      </Button>
      {result && (
        <span className="notice" role="status">
          {result}
        </span>
      )}
      <ConfirmDialog
        open={open}
        title="Отменить бронь 20260913-TESTAA?"
        confirmLabel="Отменить бронь"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setPending(true);
          setTimeout(() => {
            setPending(false);
            setOpen(false);
            setResult('Бронь отменена, штраф 8 000 ₸ начислен');
          }, 600);
        }}
      >
        Ячейка R01 освободится на 16–19 сент. По политике тарифа будет начислен штраф{' '}
        <strong>8 000 ₸</strong>; предоплата 24 000 ₸ останется на счёте.
      </ConfirmDialog>
    </div>
  );
}

function ToastButtons() {
  const { toast } = useToast();
  return (
    <div className="row" data-state="live">
      <Button
        type="button"
        tone="secondary"
        onClick={() => toast({ text: 'Гость заселён, R01', tone: 'success' })}
      >
        Показать «заселён»
      </Button>
      <Button
        type="button"
        tone="secondary"
        onClick={() =>
          toast({
            text: 'Ответ сервера не получен. Обновите данные и проверьте результат.',
            tone: 'danger',
          })
        }
      >
        Показать ошибку
      </Button>
    </div>
  );
}
export function ToastDemo() {
  return (
    <ToastProvider>
      <ToastButtons />
    </ToastProvider>
  );
}

export function ToastStatic() {
  const items = [
    { id: 1, text: 'Гость заселён, R01', tone: 'success' as const },
    { id: 2, text: 'Остаток отправлен в Channex', tone: 'info' as const },
    {
      id: 3,
      text: 'Гражданство не указано — заселение без него не пройдёт',
      tone: 'warning' as const,
    },
    {
      id: 4,
      text: 'Ответ сервера не получен. Обновите данные и проверьте результат.',
      tone: 'danger' as const,
    },
  ];
  return <ToastRegion className="toast-region--static" items={items} dismiss={() => {}} />;
}

export function MenuDemo() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <div className="row" data-state="live">
      <ActionMenu
        label="Действия с бронью"
        items={[
          { label: 'Переселить…', onSelect: () => setLast('Переселить') },
          { label: 'Продлить на ночь', onSelect: () => setLast('Продлить') },
          { label: 'Открыть карточку', href: '#card' },
          { label: 'Заселить', disabled: true },
          { label: 'Отменить бронь…', tone: 'danger', onSelect: () => setLast('Отменить') },
        ]}
      />
      <span className="hint" role="status" data-testid="menu-result">
        {last ? `выбрано: ${last}` : 'ничего не выбрано'}
      </span>
    </div>
  );
}

export function TooltipDemo() {
  return (
    <div className="row" data-state="live">
      <Tooltip text="Предоплата 24 000 ₸ пришла из Booking.com 12 сент.">
        <Button type="button" tone="secondary">
          Оплачено каналом
        </Button>
      </Tooltip>
      <Tooltip
        text="Заселение без гражданства не пройдёт: поле обязательно с 12.09"
        placement="bottom"
      >
        <span className="badge badge--warn" tabIndex={0}>
          нет гражданства
        </span>
      </Tooltip>
    </div>
  );
}

/**
 * Disabled controls cannot receive focus themselves. Keep the focusable wrapper and Tooltip in the
 * same client boundary so React renders identical markup on the server and during hydration.
 */
export function DisabledTooltipDemo() {
  return (
    <Tooltip text="Заселение без гражданства не пройдёт">
      <span tabIndex={0} className="kit-disabled-host">
        <Button type="button" disabled>
          Заселить
        </Button>
      </span>
    </Tooltip>
  );
}

/**
 * Экран сбоя из каталога: `Error` нельзя передать из серверного компонента, поэтому он собирается
 * здесь. `digest` — как у `ApiError`: `API_503` — нет связи, `API_404` — отклонённый запрос.
 */
export function ErrorDemo({ digest }: { digest: string }) {
  const [attempt, setAttempt] = useState(0);
  const error = Object.assign(new Error('Синтетический отказ API'), { digest });
  return (
    <div data-attempt={attempt}>
      <ErrorState error={error} retry={() => setAttempt((n) => n + 1)} />
    </div>
  );
}
