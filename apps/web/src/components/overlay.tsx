'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './icon';
export function Overlay({
  open,
  onClose,
  title,
  children,
  drawer = false,
  className = '',
  trapFocus = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  drawer?: boolean;
  className?: string;
  trapFocus?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={`ui-overlay ${drawer ? 'ui-drawer' : ''} ${className}`}
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (!trapFocus || e.key !== 'Tab') return;
        const element = e.currentTarget;
        if ((e.target as HTMLElement).closest('dialog') !== element) return;
        const controls = [
          ...element.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((control) => control.getClientRects().length > 0 && !control.closest('[inert]'));
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        // Нативный cancel не всплывает, но React доставляет его и родителям по дереву компонентов:
        // Escape в окне подтверждения внутри панели закрывал и панель (найдено B3, 20.09).
        // Панель реагирует только на свой cancel — одно нажатие закрывает одно окно (DESIGN.md §12).
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="overlay-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={`Закрыть: ${title}`}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {open && <div className="overlay-content">{children}</div>}
    </dialog>
  );
}
