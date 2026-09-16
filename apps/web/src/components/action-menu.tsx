'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icon';
import { cx } from './ui';

export interface ActionMenuItem {
  label: ReactNode;
  onSelect?: (() => void) | undefined;
  href?: string | undefined;
  tone?: 'danger' | undefined;
  disabled?: boolean | undefined;
}

/**
 * Меню действий (DESIGN.md §8, §12): кнопка «⋯» и список пунктов. Дублирует перетаскивание и жесты
 * пунктами «Переселить / Продлить / Отменить» — с планшета и с клавиатуры. Стрелки ходят по пунктам,
 * Escape закрывает и возвращает фокус на кнопку, клик мимо закрывает.
 */
export function ActionMenu({
  items,
  label = 'Действия',
  size,
  className,
}: {
  items: ActionMenuItem[];
  label?: string;
  size?: 'sm' | undefined;
  className?: string | undefined;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!list.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[active]?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, active]);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const move = (dir: 1 | -1) => {
    if (!enabled.length) return;
    const pos = enabled.indexOf(active);
    const next = enabled[(pos + dir + enabled.length) % enabled.length]!;
    setActive(next);
  };
  return (
    <span className={cx('action-menu', className)}>
      <button
        ref={button}
        type="button"
        className={cx('btn btn--secondary action-menu__button', size && `btn--${size}`)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => {
          setActive(enabled[0] ?? 0);
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(e.key === 'ArrowDown' ? (enabled[0] ?? 0) : (enabled.at(-1) ?? 0));
            setOpen(true);
          }
        }}
      >
        <Icon name="more" />
      </button>
      <div
        ref={list}
        id={id}
        role="menu"
        aria-label={label}
        className={cx('action-menu__list', open && 'is-open')}
        hidden={!open}
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
            setActive(enabled.at(-1) ?? 0);
          } else if (e.key === 'Tab') close();
        }}
      >
        {items.map((it, i) => {
          const common = {
            role: 'menuitem' as const,
            tabIndex: i === active ? 0 : -1,
            className: cx('action-menu__item', it.tone && `action-menu__item--${it.tone}`),
            'aria-disabled': it.disabled || undefined,
          };
          if (it.href && !it.disabled)
            return (
              <a key={i} href={it.href} {...common} onClick={() => setOpen(false)}>
                {it.label}
              </a>
            );
          return (
            <button
              key={i}
              type="button"
              {...common}
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect?.();
                button.current?.focus();
              }}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </span>
  );
}
