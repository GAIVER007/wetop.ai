import type { ReactNode } from 'react';
import { Chip, ChipGroup } from './chip';
import { DateInput } from './date-field';
import { Field } from './ui';

/**
 * Выбор отрезка дат (MV8.5 DS1c, DESIGN.md §8.2): готовые отрезки и поля «С» / «По». Только вид и ввод:
 * поля стоят в форме экрана со своими именами, а когда отрезок применяется (кнопкой «Показать» или
 * сразу), решает экран. Правил отрезка компонент не знает: ошибку называет экран.
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
  error?: string | undefined;
  /** уточнения отрезка, которые экран ставит рядом (например, к чему относится дата) */
  children?: ReactNode;
  className?: string;
  /** класс ряда готовых отрезков, если экран прячет его на телефоне */
  presetsClassName?: string;
}) {
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
      <Field inline label="С">
        <DateInput key={`from-${from}`} name={fromName} defaultValue={from} aria-label="Период: с" />
      </Field>
      <Field inline label="По">
        <DateInput
          key={`to-${to}`}
          name={toName}
          rangeFromName={fromName}
          defaultValue={to}
          aria-label="Период: по"
        />
      </Field>
      {children}
      {error && (
        <p className="period-picker__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
