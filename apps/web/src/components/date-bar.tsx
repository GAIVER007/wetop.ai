'use client';
import type { ComponentProps, InputHTMLAttributes } from 'react';
import { useT } from '../i18n/locale-provider';
import { Icon } from './icon';
import { Button, Field, Input } from './ui';
import { DateInput } from './date-field';

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
  compact = false,
  calendar = false,
  presets,
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
  /** подпись «Дата» только для программы чтения: полоса дня одной строкой в панели экрана */
  compact?: boolean;
  calendar?: boolean;
  /** быстрые кнопки в календаре (только с `calendar`) */
  presets?: ComponentProps<typeof DateInput>['presets'];
}) {
  const t = useT();
  const DateControl = calendar ? DateInput : Input;
  return (
    <div className={className ? `date-bar ${className}` : 'date-bar'}>
      {onToday && (
        <Button tone="secondary" type="button" onClick={onToday}>
          {t('Сегодня')}
        </Button>
      )}
      <Button tone="ghost" type="button" aria-label={t('Предыдущий день')} onClick={onPrevious}>
        <Icon name="back" />
      </Button>
      <Field label={compact ? <span className="sr-only">{t('Дата')}</span> : t('Дата')}>
        <DateControl
          {...(calendar && presets ? { presets } : {})}
          {...inputProps}
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) onDateChange(e.target.value);
          }}
        />
      </Field>
      <Button tone="ghost" type="button" aria-label={t('Следующий день')} onClick={onNext}>
        <Icon name="chevron" />
      </Button>
    </div>
  );
}
