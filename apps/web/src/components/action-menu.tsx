'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icon';
import { cx } from './ui';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: Parameters<typeof Icon>[0]['name'];
  /** «Отменить со штрафом» — красным, последним */
  tone?: 'danger' | undefined;
  disabled?: boolean | undefined;
  hint?: string | undefined;
  onSelect?: (() => void) | undefined;
}

/**
 * Меню действий (DESIGN.md §8): кнопка «Действия» или «⋯» → список пунктов. Дублирует перетаскивание
 * на шахматке пунктом «Переселить» (§12). Клавиатура: стрелки, Home/End, Enter, Escape возвращает фокус
 * на кнопку; клик мимо закрывает. Роли WAI-ARIA `menu` / `menuitem`.
 */
export function ActionMenu({
  label = 'Действия',
  items,
  compact,
  align = 'end',
  className,
}: {
  label?: string;
  items: ActionMenuItem[];
  /** Только значок «⋯» с aria-label */
  compact?: boolean | undefined;
  align?: 'start' | 'end' | undefined;
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[active]?.focus();
  }, [open, active]);
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const move = (dir: 1 | -1) => {
    if (!enabled.length) return;
    const pos = enabled.indexOf(active);
    setActive(enabled[(pos + dir + enabled.length) % enabled.length]!);
  };
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  return (
    <div ref={root} className={cx('action-menu', className)}>
      <button
        ref={button}
        type="button"
        className={cx(compact ? 'icon-button' : 'btn btn--secondary')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label={compact ? label : undefined}
        onClick={() => {
          setActive(enabled[0] ?? 0);
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(e.key === 'ArrowDown' ? (enabled[0] ?? 0) : (enabled[enabled.length - 1] ?? 0));
            setOpen(true);
          }
        }}
      >
        {compact ? <Icon name="more" /> : <>{label} <Icon name="down" width={16} height={16} /></>}
      </button>
      {open && (
        <div
          id={`${id}-menu`}
          role="menu"
          aria-label={label}
          className={cx('action-menu__list', align === 'start' && 'action-menu__list--start')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              move(1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              move(-1);
            } else if (e.key === 'Home') {
              e.preventDefault();
              setActive(enabled[0] ?? 0);
            } else if (e.key === 'End') {
              e.preventDefault();
              setActive(enabled[enabled.length - 1] ?? 0);
            } else if (e.key === 'Tab') close();
          }}
        >
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              disabled={it.disabled}
              aria-disabled={it.disabled || undefined}
              className={cx('action-menu__item', it.tone === 'danger' && 'action-menu__item--danger')}
              data-id={it.id}
              onMouseEnter={() => !it.disabled && setActive(i)}
              onClick={() => {
                if (it.disabled) return;
                setOpen(false);
                button.current?.focus();
                it.onSelect?.();
              }}
            >
              {it.icon && <Icon name={it.icon} width={16} height={16} />}
              <span>
                {it.label}
                {it.hint && <small>{it.hint}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type { ReactNode as ActionMenuChildren };
