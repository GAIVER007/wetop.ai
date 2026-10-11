'use client';
import type { InputHTMLAttributes } from 'react';
import { Icon } from './icon';
import { Button, Field, Input } from './ui';

/**
 * Переход по дням (MV8.5 DS1c, DESIGN.md §8.2): «Сегодня» по желанию, предыдущий день, поле «Дата»,
 * следующий день. Компонент только показывает и сообщает: куда перейти и когда, решает экран (адрес,
 * пояс объекта и правила дня остаются у него). Один на салон и ресторан.
 */
export function DateBar({
  date,
  onDateChange,
  onPrevious,
  onNext,
  onToday,
  inputProps,
  className,
}: {
  date: string;
  onDateChange: (date: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  /** без него кнопки «Сегодня» нет */
  onToday?: (() => void) | undefined;
  /** атрибуты поля даты, которые держат тесты экрана (`data-testid`) */
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> &
    Record<`data-${string}`, string>;
  className?: string;
}) {
  return (
    <div className={className ? `date-bar ${className}` : 'date-bar'}>
      {onToday && (
        <Button tone="secondary" type="button" onClick={onToday}>
          Сегодня
        </Button>
      )}
      <Button tone="ghost" type="button" aria-label="Предыдущий день" onClick={onPrevious}>
        <Icon name="back" />
      </Button>
      <Field label="Дата">
        <Input
          {...inputProps}
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) onDateChange(e.target.value);
          }}
        />
      </Field>
      <Button tone="ghost" type="button" aria-label="Следующий день" onClick={onNext}>
        <Icon name="chevron" />
      </Button>
    </div>
  );
}
