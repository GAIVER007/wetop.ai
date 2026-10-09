'use client';
import { useState } from 'react';
import { ActionMenu } from '../../components/action-menu';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { ErrorState } from '../../components/error-state';
import { ToastProvider, ToastRegion, useToast } from '../../components/toast';
import { Tooltip } from '../../components/tooltip';
import { Button } from '../../components/ui';
import { Chip, ChipGroup } from '../../components/chip';
import { Segmented } from '../../components/segmented';
import { DateBar } from '../../components/date-bar';

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
    { id: 2, text: 'Остаток отправлен в каналы', tone: 'info' as const },
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

/**
 * Живой переключатель тем витрины: светлая, тёмная, с повышенной контрастностью.
 * По умолчанию показывает все темы.
 */
export function ThemeSwitcher({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'all' | 'light' | 'dark' | 'contrast'>('all');
  return (
    <div>
      <div className="kit-theme-bar" role="toolbar" aria-label="Переключение тем витрины">
        <span className="kit-theme-bar__label">Режим просмотра:</span>
        <div className="kit-theme-bar__seg">
          <button
            type="button"
            aria-pressed={theme === 'all'}
            className={`btn btn--sm ${theme === 'all' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTheme('all')}
          >
            Все темы
          </button>
          <button
            type="button"
            aria-pressed={theme === 'light'}
            className={`btn btn--sm ${theme === 'light' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTheme('light')}
          >
            Только светлая
          </button>
          <button
            type="button"
            aria-pressed={theme === 'dark'}
            className={`btn btn--sm ${theme === 'dark' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTheme('dark')}
          >
            Только тёмная
          </button>
          <button
            type="button"
            aria-pressed={theme === 'contrast'}
            className={`btn btn--sm ${theme === 'contrast' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTheme('contrast')}
          >
            Повышенная контрастность
          </button>
        </div>
      </div>
      <div className={`kit-themes ${theme !== 'all' ? `kit-themes--filter-${theme}` : ''}`}>
        {children}
      </div>
    </div>
  );
}

/** Переключатель с живым выбором: стрелки, Home, End (DS1b) */
export function SegmentedDemo({ label, disabled }: { label: string; disabled?: boolean }) {
  const [view, setView] = useState<'compact' | 'normal' | 'detailed'>('normal');
  return (
    <Segmented
      label={label}
      value={view}
      onChange={setView}
      disabled={disabled}
      options={[
        { value: 'compact', label: 'Компактный' },
        { value: 'normal', label: 'Обычный' },
        { value: 'detailed', label: 'Подробный' },
      ]}
    />
  );
}

/** Чипы с живым выбором: кнопки с aria-pressed (DS1b) */
export function ChipDemo({ label }: { label: string }) {
  const [on, setOn] = useState<string[]>(['arrivals']);
  const toggle = (id: string) =>
    setOn((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  return (
    <ChipGroup label={label}>
      <Chip selected={on.includes('arrivals')} count={3} onClick={() => toggle('arrivals')}>
        Заезды сегодня
      </Chip>
      <Chip selected={on.includes('debt')} count={12} onClick={() => toggle('debt')}>
        С долгом
      </Chip>
      <Chip selected={on.includes('rooms')} onClick={() => toggle('rooms')}>
        Номера
      </Chip>
    </ChipGroup>
  );
}

/** День для страницы компонентов: тот же `DateBar`, дата меняется на месте, без адреса */
export function DateBarDemo({ withToday }: { withToday?: boolean }) {
  const start = '2026-10-12';
  const [date, setDate] = useState(start);
  const shift = (n: number) => {
    const at = new Date(`${date}T12:00:00Z`);
    at.setUTCDate(at.getUTCDate() + n);
    return at.toISOString().slice(0, 10);
  };
  return (
    <DateBar
      date={date}
      onDateChange={setDate}
      onPrevious={() => setDate(shift(-1))}
      onNext={() => setDate(shift(1))}
      onToday={withToday ? () => setDate(start) : undefined}
    />
  );
}
