'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './icon';

const DAY = 86_400_000;
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const months = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];
const monthTitles = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number): string {
  return iso(new Date(parseDate(value)!.getTime() + amount * DAY));
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function formatDate(value: string): string {
  const date = parseDate(value);
  return date
    ? `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`
    : value;
}

function formatCompactRange(from: string, to: string): string {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return `${from} – ${to}`;
  const firstDay = start.getUTCDate();
  const lastDay = end.getUTCDate();
  const firstYear = start.getUTCFullYear();
  const lastYear = end.getUTCFullYear();
  const firstMonth = start.getUTCMonth();
  const lastMonth = end.getUTCMonth();
  if (from === to) return `${firstDay} ${months[firstMonth]} ${firstYear}`;
  if (firstYear === lastYear && firstMonth === lastMonth)
    return `${firstDay}–${lastDay} ${months[firstMonth]} ${firstYear}`;
  const monthShort = (month: number) => months[month]?.slice(0, 3) ?? '';
  if (firstYear === lastYear)
    return `${firstDay} ${monthShort(firstMonth)} – ${lastDay} ${monthShort(lastMonth)} ${firstYear}`;
  return `${firstDay} ${monthShort(firstMonth)} ${String(firstYear).slice(-2)} – ${lastDay} ${monthShort(lastMonth)} ${String(lastYear).slice(-2)}`;
}

export type DateRangePreset = 'today' | '7' | '14' | '30' | 'month' | 'custom';

export function presetRange(
  preset: DateRangePreset,
  today: string,
): { from: string; to: string } | null {
  const date = parseDate(today);
  if (!date || preset === 'custom') return null;
  if (preset === 'month') {
    return {
      from: iso(monthStart(date)),
      to: iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))),
    };
  }
  return { from: today, to: addDays(today, (preset === 'today' ? 1 : Number(preset)) - 1) };
}

function activePreset(from: string, to: string, today: string): DateRangePreset {
  for (const preset of ['today', '7', '14', '30', 'month'] as const) {
    const range = presetRange(preset, today);
    if (range?.from === from && range.to === to) return preset;
  }
  return 'custom';
}

const presets: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: '7', label: '7 дней' },
  { value: '14', label: '14 дней' },
  { value: '30', label: '30 дней' },
  { value: 'month', label: 'Текущий месяц' },
  { value: 'custom', label: 'Произвольный период' },
];

/** Один контрол периода. Today передаёт экран по часовому поясу объекта. */
export function DateRangePopover({
  from,
  to,
  today,
  maxDays,
  action,
  triggerTestId,
  compactOnMobile = false,
}: {
  from: string;
  to: string;
  today: string;
  maxDays?: number;
  action?: string;
  triggerTestId?: string;
  compactOnMobile?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const id = useId();
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>(() =>
    activePreset(from, to, today),
  );
  const [view, setView] = useState(() =>
    monthStart(parseDate(from) ?? parseDate(today) ?? new Date()),
  );
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStart(from);
    setEnd(to);
    setView(monthStart(parseDate(from) ?? parseDate(today) ?? new Date()));
    setSelectedPreset(activePreset(from, to, today));
    setSelectingEnd(false);
    setError('');
    if (ref.current) ref.current.open = false;
  }, [from, to, today]);

  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (!ref.current?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        ref.current.open = false;
        trigger.current?.focus();
      } else if (event.target instanceof Node && !ref.current.contains(event.target)) {
        ref.current.open = false;
      }
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  const first = monthStart(view);
  const gridStart = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY);
  const days = Array.from(
    { length: 42 },
    (_, index) => new Date(gridStart.getTime() + index * DAY),
  );
  const valid = parseDate(start) && parseDate(end) && start <= end;
  const count = valid
    ? Math.round((parseDate(end)!.getTime() - parseDate(start)!.getTime()) / DAY) + 1
    : 0;
  const chooseDay = (value: string) => {
    setSelectedPreset('custom');
    setError('');
    if (!selectingEnd || value < start) {
      setStart(value);
      setEnd(value);
      setSelectingEnd(true);
    } else {
      setEnd(value);
      setSelectingEnd(false);
    }
  };
  const changeMonth = (amount: number) =>
    setView(new Date(Date.UTC(view.getUTCFullYear(), view.getUTCMonth() + amount, 1)));

  return (
    <details
      className={`date-range${compactOnMobile ? ' date-range--compact-mobile' : ''}`}
      ref={ref}
    >
      <summary
        ref={trigger}
        data-testid={triggerTestId}
        aria-label="Выбрать период"
        aria-controls={`${id}-panel`}
      >
        <Icon name="board" />
        <span className="date-range__label-full">
          {formatDate(from)} – {formatDate(to)}
        </span>
        {compactOnMobile && (
          <span className="date-range__label-compact">{formatCompactRange(from, to)}</span>
        )}
        <Icon name="down" />
      </summary>
      <div className="date-range__panel" id={`${id}-panel`}>
        <form
          method="get"
          action={action}
          onSubmit={(event) => {
            if (!valid || (maxDays && count > maxDays)) {
              event.preventDefault();
              setError(!valid ? 'Выберите корректный период' : `Не более ${maxDays} дней`);
            }
          }}
        >
          <div className="date-range__body">
            <div className="date-range__presets" role="group" aria-label="Готовые периоды">
              <strong>Выберите период</strong>
              {presets.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className="date-range__preset"
                  aria-pressed={selectedPreset === value}
                  onClick={() => {
                    const range = presetRange(value, today);
                    setSelectedPreset(value);
                    setError('');
                    setSelectingEnd(value === 'custom');
                    if (range) {
                      setStart(range.from);
                      setEnd(range.to);
                      setView(monthStart(parseDate(range.from)!));
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="date-range__calendar" aria-label="Календарь периода">
              <div className="date-range__month">
                <button type="button" onClick={() => changeMonth(-1)} aria-label="Предыдущий месяц">
                  <Icon name="back" />
                </button>
                <strong>
                  {monthTitles[view.getUTCMonth()]} {view.getUTCFullYear()}
                </strong>
                <button type="button" onClick={() => changeMonth(1)} aria-label="Следующий месяц">
                  <Icon name="chevron" />
                </button>
              </div>
              <div className="date-range__days">
                {weekdays.map((day) => (
                  <span key={day} className="date-range__weekday">
                    {day}
                  </span>
                ))}
                {days.map((day) => {
                  const value = iso(day);
                  return (
                    <button
                      key={value}
                      type="button"
                      className="date-range__day"
                      data-outside={day.getUTCMonth() !== view.getUTCMonth()}
                      data-in-range={value >= start && value <= end}
                      data-edge={value === start || value === end}
                      data-today={value === today}
                      aria-label={formatDate(value)}
                      aria-pressed={value === start || value === end}
                      onClick={() => chooseDay(value)}
                    >
                      {day.getUTCDate()}
                    </button>
                  );
                })}
              </div>
              <div className="date-range__inputs">
                <label>
                  С
                  <input
                    name="from"
                    type="date"
                    aria-label="Период: с"
                    value={start}
                    onChange={(event) => {
                      setStart(event.target.value);
                      setSelectedPreset('custom');
                      setError('');
                    }}
                    required
                  />
                </label>
                <label>
                  По
                  <input
                    name="to"
                    type="date"
                    aria-label="Период: по"
                    value={end}
                    onChange={(event) => {
                      setEnd(event.target.value);
                      setSelectedPreset('custom');
                      setError('');
                    }}
                    required
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="date-range__footer">
            <span aria-live="polite">
              {valid ? `${formatDate(start)} – ${formatDate(end)} (${count} дн.)` : 'Выберите даты'}
            </span>
            <button className="btn btn--primary" type="submit">
              Применить
            </button>
            {error && <p role="alert">{error}</p>}
          </div>
        </form>
      </div>
    </details>
  );
}
