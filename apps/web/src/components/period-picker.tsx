import type { ReactNode } from 'react';
import { Chip, ChipGroup } from './chip';
import { DateInput } from './date-field';
import { Field } from './ui';

/**
 * Выбор отрезка дат (MV8.5 DS1c, DESIGN.md §8.2): готовые отрезки и поля «С» / «По». Только вид и ввод:
 * поля стоят в форме экрана со своими именами, а когда отрезок применяется (кнопкой «Показать» или
 * сразу), решает экран. Правил отрезка компонент не знает: ошибку называет экран (у поля через
 * `errors.from` / `errors.to`, у отрезка целиком через `errors.period`). `onFromChange` и `onToChange`
 * сообщают новую дату экрану, который меняет отрезок сразу; форма с «Показать» их не передаёт.
 */
export interface PeriodPreset {
  label: string;
  href: string;
  selected: boolean;
}

export function PeriodPicker({
  from,
  to,
  fromName,
  toName,
  presets,
  error,
  errors,
  onFromChange,
  onToChange,
  children,
  className,
  presetsClassName,
}: {
  from: string;
  to: string;
  fromName: string;
  toName: string;
  /** готовые отрезки ссылками: отрезок живёт в адресе экрана */
  presets?: PeriodPreset[];
  /** ошибка отрезка целиком (то же, что `errors.period`) */
  error?: string | undefined;
  errors?: { from?: string | undefined; to?: string | undefined; period?: string | undefined };
  onFromChange?: (value: string) => void;
  onToChange?: (value: string) => void;
  /** уточнения отрезка, которые экран ставит рядом (например, к чему относится дата) */
  children?: ReactNode;
  className?: string;
  /** класс ряда готовых отрезков, если экран прячет его на телефоне */
  presetsClassName?: string;
}) {
  const periodError = errors?.period ?? error;
  return (
    <div className={className ? `period-picker ${className}` : 'period-picker'}>
      {presets && presets.length > 0 && (
        <ChipGroup
          as="nav"
          label="Готовые периоды"
          className={presetsClassName ? `period-picker__presets ${presetsClassName}` : 'period-picker__presets'}
        >
          {presets.map((p) => (
            <Chip key={p.label} size="sm" href={p.href} selected={p.selected}>
              {p.label}
            </Chip>
          ))}
        </ChipGroup>
      )}
      <Field inline label="С" controlId={`period-${fromName}`} error={errors?.from}>
        <DateInput
          key={`from-${from}`}
          id={`period-${fromName}`}
          name={fromName}
          defaultValue={from}
          aria-label="Период: с"
          {...(onFromChange ? { onChange: (e) => onFromChange(e.target.value) } : {})}
        />
      </Field>
      <Field inline label="По" controlId={`period-${toName}`} error={errors?.to}>
        <DateInput
          key={`to-${to}`}
          id={`period-${toName}`}
          name={toName}
          rangeFromName={fromName}
          defaultValue={to}
          aria-label="Период: по"
          {...(onToChange ? { onChange: (e) => onToChange(e.target.value) } : {})}
        />
      </Field>
      {children}
      {periodError && (
        <p className="period-picker__error" role="alert">
          {periodError}
        </p>
      )}
    </div>
  );
}
