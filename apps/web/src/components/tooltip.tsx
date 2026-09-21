'use client';
import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cx } from './ui';

/**
 * Подсказка (DESIGN.md §8, §12): открывается наведением и фокусом с клавиатуры, закрывается Escape.
 * Замена нативному `title`, который не доступен с клавиатуры и на планшете. Смысл не должен держаться
 * только на подсказке (§1 п. 4): в неё идёт уточнение, а не единственное слово статуса.
 */
export function Tooltip({
  text,
  children,
  placement = 'top',
  className,
}: {
  text: ReactNode;
  /** один элемент, принимающий фокус: кнопка, ссылка, span с tabIndex */
  children: ReactElement<Record<string, unknown>>;
  placement?: 'top' | 'bottom' | undefined;
  className?: string | undefined;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!isValidElement(children)) return children;
  const child = children as ReactElement<Record<string, unknown>>;
  const trigger = cloneElement(child, {
    'aria-describedby': open ? id : undefined,
    onMouseEnter: (e: unknown) => {
      (child.props['onMouseEnter'] as ((e: unknown) => void) | undefined)?.(e);
      setOpen(true);
    },
    onMouseLeave: (e: unknown) => {
      (child.props['onMouseLeave'] as ((e: unknown) => void) | undefined)?.(e);
      setOpen(false);
    },
    onFocus: (e: unknown) => {
      (child.props['onFocus'] as ((e: unknown) => void) | undefined)?.(e);
      setOpen(true);
    },
    onBlur: (e: unknown) => {
      (child.props['onBlur'] as ((e: unknown) => void) | undefined)?.(e);
      setOpen(false);
    },
    onKeyDown: (e: { key: string }) => {
      (child.props['onKeyDown'] as ((e: unknown) => void) | undefined)?.(e);
      if (e.key === 'Escape') setOpen(false);
    },
  });
  return (
    <span className={cx('tooltip-host', className)}>
      {trigger}
      <span
        role="tooltip"
        id={id}
        className={cx('tooltip', `tooltip--${placement}`, open && 'is-open')}
        aria-hidden={!open}
      >
        {text}
      </span>
    </span>
  );
}
