'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './ui';

/**
 * Окно подтверждения (DESIGN.md §1 п. 5, §8, §15): только для необратимого — переселение в другую
 * категорию, отмена со штрафом. Всегда называет действие, показывает последствие и сумму до нажатия
 * (план, Д5 — суммы считает сервер эндпоинтом чтения, окно их только показывает). Заменяет `window.confirm`.
 * Нативный `<dialog>`: фокус внутри, Escape = отмена, фокус возвращается на вызвавшую кнопку.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  consequence,
  amount,
  confirmLabel,
  cancelLabel = 'Отмена',
  tone = 'primary',
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** Что именно произойдёт — одно-два предложения */
  children?: ReactNode;
  /** Необратимое последствие, коротко: «Штраф 15 000 ₸ останется на счёте» */
  consequence?: ReactNode;
  /** Сумма, которую увидит гость или счёт — плашкой */
  amount?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | undefined;
  /** Кнопка занята: «Отменяю…» вместо подписи, оба действия заблокированы */
  pending?: string | undefined;
  error?: string | null | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const textId = useId();
  useEffect(() => {
    const el = dialog.current;
    if (!el || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
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
      aria-describedby={textId}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
    >
      {open && (
        <form
          method="dialog"
          className="confirm-dialog__body"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) onConfirm();
          }}
        >
          <h2 id={titleId} className="confirm-dialog__title">
            {title}
          </h2>
          <div id={textId} className="confirm-dialog__text">
            {children}
            {consequence && <p className="confirm-dialog__consequence">{consequence}</p>}
          </div>
          {amount && <div className="confirm-dialog__amount">{amount}</div>}
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          <div className="confirm-dialog__actions">
            <Button type="button" tone="secondary" onClick={onCancel} disabled={!!pending}>
              {cancelLabel}
            </Button>
            <Button type="submit" tone={tone === 'danger' ? 'danger' : 'primary'} disabled={!!pending} autoFocus>
              {pending ?? confirmLabel}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
