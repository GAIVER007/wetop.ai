'use client';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { ToastProvider, useToast } from '../../components/toast';
import { Button, cx } from '../../components/ui';
import { formatMoney, minorToInput } from '../../lib/money';
import { displayDay } from '../../lib/display-date';
import { bulkRatesAction } from './actions';

/** Уведомления о сохранении цены живут над таблицей; сервер-компонент страницы оборачивает таблицу сюда. */
export function RatesToastScope({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

/**
 * Правка цены в ячейке (срез 7.2, макет «Rates»): клик → поле, Enter сохраняет, Escape отменяет.
 * Уходит тем же `POST /rates/bulk`, что и массовое изменение — одна строка на один день и одно число
 * гостей, поэтому проверка нуля и ошибка сервера стоят прямо у ячейки (DESIGN.md §14 «Ошибка»).
 */
export function PriceCell(props: {
  date: string;
  occupancy: number;
  minor: string | null;
  currency: string;
  accommodationTypeCode: string;
  ratePlanCode: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);
  const open = () => {
    // Тиыны не теряем: 123450 → «1234.50», 800000 → «8000». Иначе слепой Enter округлил бы цену вниз
    setValue(props.minor ? minorToInput(props.minor) : '');
    setError(null);
    setEditing(true);
  };
  const close = () => {
    setEditing(false);
    setError(null);
  };
  const save = () => {
    const price = value.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(price)) return setError('Введите цену числом');
    if (Number(price) === 0) return setError('Цена не может быть 0');
    start(async () => {
      const res = await bulkRatesAction([
        {
          accommodationTypeCode: props.accommodationTypeCode,
          ratePlanCode: props.ratePlanCode,
          dateFrom: props.date,
          dateTo: props.date,
          price,
          occupancy: props.occupancy,
        },
      ]);
      if (res.error) setError(res.error);
      else {
        setEditing(false);
        toast.push({
          text: `Цена на ${displayDay(props.date)} сохранена, ушла в Channex`,
          tone: 'ok',
        });
      }
    });
  };
  const label = `Цена ${displayDay(props.date)}, ${props.occupancy} гост.`;
  if (!editing)
    return (
      <Button
        type="button"
        tone="ghost"
        size="xs"
        className={cx('price-cell', !props.minor && 'warn-text')}
        aria-label={`${label}: изменить`}
        onClick={open}
      >
        {props.minor ? formatMoney(props.minor, props.currency) : 'нет'}
      </Button>
    );
  return (
    <span className="price-cell__edit">
      <input
        ref={input}
        className={cx('inp', 'price-cell__input', error && 'is-invalid')}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        inputMode="decimal"
        value={value}
        disabled={pending}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
        onBlur={() => {
          if (!pending && !error) close();
        }}
      />
      {error ? (
        <span className="price-cell__error" role="alert">
          {error}
        </span>
      ) : (
        <span className="price-cell__hint">
          {pending ? 'сохраняю…' : 'Enter — сохранить, Esc — отмена'}
        </span>
      )}
    </span>
  );
}
