'use client';
import { cloneElement, useId, useState, type ReactElement, type ReactNode } from 'react';
import { cx } from './ui';

/**
 * Подсказка (DESIGN.md §8, план §3.2 «подсказка открывается и фокусом с клавиатуры»): замена
 * нативному `title`, который виден только мышью. Открывается по наведению и по фокусу, закрывается
 * по Escape; связана с элементом через `aria-describedby`, поэтому читается вслух. Только для
 * пояснений — смысл, без которого нельзя работать, пишется словом рядом (§1 п. 4).
 */
export function Tooltip({
  text,
  children,
  side = 'top',
}: {
  text: ReactNode;
  children: ReactElement<Record<string, unknown>>;
  side?: 'top' | 'bottom' | undefined;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  const child = children.props;
  const trigger = cloneElement(children, {
    'aria-describedby': open ? id : (child['aria-describedby'] as string | undefined),
    onMouseEnter: (e: unknown) => {
      show();
      (child['onMouseEnter'] as ((e: unknown) => void) | undefined)?.(e);
    },
    onMouseLeave: (e: unknown) => {
      hide();
      (child['onMouseLeave'] as ((e: unknown) => void) | undefined)?.(e);
    },
    onFocus: (e: unknown) => {
      show();
      (child['onFocus'] as ((e: unknown) => void) | undefined)?.(e);
    },
    onBlur: (e: unknown) => {
      hide();
      (child['onBlur'] as ((e: unknown) => void) | undefined)?.(e);
    },
    onKeyDown: (e: { key: string }) => {
      if (e.key === 'Escape') hide();
      (child['onKeyDown'] as ((e: unknown) => void) | undefined)?.(e);
    },
  });
  return (
    <span className="tooltip-anchor">
      {trigger}
      <span role="tooltip" id={id} hidden={!open} className={cx('tooltip', `tooltip--${side}`)}>
        {text}
      </span>
    </span>
  );
}
