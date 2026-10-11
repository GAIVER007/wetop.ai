'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button, type ButtonTone } from './ui';

/**
 * Окно подтверждения (DESIGN.md §8, §15): вместо `window.confirm`. Только для необратимого —
 * отмена со штрафом, переселение с пересчётом, удаление. В теле — сумма и последствие, кнопка
 * названа действием («Отменить бронь», не «ОК»). Нативный <dialog>: фокус внутри, Escape = отказ,
 * фокус возвращается туда, откуда открыли.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Оставить как есть',
  tone = 'danger',
  pending = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ButtonTone | undefined;
  /** пока команда идёт — кнопки отключены, на главной текст «Выполняю…» */
  pending?: boolean | undefined;
  confirmDisabled?: boolean | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  useEffect(() => {
    const el = dialog.current;
    if (!el || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      el.close();
      previous?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={children ? bodyId : undefined}
      data-testid="confirm-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
    >
      {open && (
        <div className="confirm-dialog__body">
          <h2 id={titleId} className="confirm-dialog__title">
            {title}
          </h2>
          {children && (
            <div id={bodyId} className="confirm-dialog__text">
              {children}
            </div>
          )}
          <div className="confirm-dialog__actions">
            <Button
              type="button"
              tone="secondary"
              onClick={onCancel}
              disabled={pending}
              data-autofocus
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              tone={tone}
              onClick={onConfirm}
              disabled={pending || confirmDisabled}
            >
              {pending ? 'Выполняю…' : confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
