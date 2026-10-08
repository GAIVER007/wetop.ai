'use client';
import { useRef } from 'react';
import { rovingIndex } from './tabs';

/**
 * Переключатель (MV8.5 DS1b, DESIGN.md §8.1): выбор одного из нескольких. Кнопки с `aria-pressed`,
 * выбрана ровно одна; стрелки, Home и End выбирают и переводят фокус, Tab попадает только на выбранную.
 */
export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Значение после клавиши; null — клавиша не наша */
export function segmentAfterKey<T extends string>(
  options: ReadonlyArray<SegmentOption<T>>,
  value: T,
  key: string,
): T | null {
  const next = rovingIndex(
    key,
    options.findIndex((o) => o.value === value),
    options.length,
  );
  return next < 0 ? null : options[next]!.value;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  disabled,
  className,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<SegmentOption<T>>;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  disabled?: boolean | undefined;
  className?: string | undefined;
}) {
  const group = useRef<HTMLDivElement>(null);
  const cls = ['seg', size === 'sm' && 'seg--sm', className].filter(Boolean).join(' ');
  return (
    <div ref={group} className={cls} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="seg__item"
          aria-pressed={option.value === value}
          disabled={disabled}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(e) => {
            const next = segmentAfterKey(options, value, e.key);
            if (next === null) return;
            e.preventDefault();
            onChange(next);
            const items = group.current?.querySelectorAll<HTMLButtonElement>('.seg__item');
            items?.[options.findIndex((o) => o.value === next)]?.focus();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
