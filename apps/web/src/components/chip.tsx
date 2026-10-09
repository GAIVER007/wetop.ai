import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Чип отбора (MV8.5 DS1b, DESIGN.md §8.1): условие, которое включают и выключают одним касанием.
 * Кнопка с `aria-pressed`; когда отбор живёт в адресе, ссылка с `aria-current="page"` у выбранной.
 * Не бейдж статуса: бейдж не нажимается. Выбранный чип спокойный (бледный акцент), не главная кнопка.
 */
type ChipProps = {
  selected: boolean;
  size?: 'sm' | 'md';
  count?: number;
  children: ReactNode;
  className?: string;
} & (
  | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>)
  | { href: string; prefetch?: boolean; disabled?: never }
);

export function Chip({ selected, size = 'md', count, children, className, ...rest }: ChipProps) {
  const cls = ['chip', size === 'sm' && 'chip--sm', className].filter(Boolean).join(' ');
  const body = (
    <>
      {children}
      {count !== undefined && <span className="chip__count">{count}</span>}
    </>
  );
  if (rest.href !== undefined) {
    const { href, prefetch } = rest;
    return (
      <Link
        href={href}
        prefetch={prefetch ?? false}
        className={cls}
        aria-current={selected ? 'page' : undefined}
      >
        {body}
      </Link>
    );
  }
  const { type, ...button } = rest;
  return (
    <button {...button} type={type ?? 'button'} className={cls} aria-pressed={selected}>
      {body}
    </button>
  );
}

/** Ряд чипов одного отбора; имя обязательно. Кнопки в `role="group"`, ссылки в `nav`. */
export function ChipGroup({
  as = 'div',
  label,
  labelledBy,
  className,
  children,
}: {
  as?: 'div' | 'nav';
  className?: string;
  children: ReactNode;
} & ({ label: string; labelledBy?: never } | { labelledBy: string; label?: never })) {
  const Tag = as;
  return (
    <Tag
      className={className ? `chip-group ${className}` : 'chip-group'}
      role={as === 'div' ? 'group' : undefined}
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      {children}
    </Tag>
  );
}

/**
 * Чип-флажок (ADR-155, DESIGN.md §8.3): выбор «есть / нет» в форме, например удобства объекта. Родной флажок внутри
 * подписи: клавиатура и состояние браузерные, значение уходит с формой (`name`, `value`). Выбранный чип выглядит
 * как выбранный `Chip`: бледный акцент, не главная кнопка.
 */
export function CheckChip({
  name,
  value,
  defaultChecked,
  disabled,
  icon,
  children,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean | undefined;
  disabled?: boolean | undefined;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="chip chip--check">
      <input
        className="chip__input"
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        disabled={disabled}
      />
      {icon}
      {children}
    </label>
  );
}
