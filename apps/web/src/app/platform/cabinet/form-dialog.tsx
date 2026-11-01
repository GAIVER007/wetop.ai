'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { trapDialogFocus } from '../../../components/overlay';
import { Button } from '../../../components/ui';
import { useT } from '../../../i18n/locale-provider';

/**
 * Кнопка, открывающая окно с формой (владелец 30.10.2026, «Деньги»: формы не висят на странице, поля в окне, одна
 * кнопка). Нативный <dialog>: фокус внутри, Escape закрывает, фокус возвращается на кнопку. Окно закрывается само,
 * когда форма внутри сообщила об успехе (`data-saved` у результата).
 */
export function FormDialog({
  label,
  title,
  tone = 'primary',
  size,
  testId,
  children,
}: {
  label: string;
  title: string;
  tone?: 'primary' | 'secondary' | undefined;
  /** `sm`: кнопка в строке таблицы, чтобы строка не распиралась */
  size?: 'sm' | undefined;
  testId: string;
  children: ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = dialog.current;
    if (!el || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    el.querySelector<HTMLElement>('input, select')?.focus();
    // форма сообщила об успехе: закрываем окно, строка уже в таблице после обновления страницы
    const saved = new MutationObserver(() => {
      if (el.querySelector('[data-saved]')) setOpen(false);
    });
    saved.observe(el, { subtree: true, childList: true });
    return () => {
      saved.disconnect();
      el.close();
      previous?.focus();
    };
  }, [open]);
  return (
    <>
      <Button type="button" tone={tone} size={size} onClick={() => setOpen(true)} data-testid={`${testId}-open`}>
        {label}
      </Button>
      <dialog
        ref={dialog}
        className="confirm-dialog"
        aria-labelledby={titleId}
        data-testid={testId}
        onKeyDown={trapDialogFocus}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
      >
        {open && (
          <div className="confirm-dialog__body">
            <div className="cabinet-dialog__head">
              <h2 id={titleId} className="confirm-dialog__title">
                {title}
              </h2>
              <Button type="button" tone="ghost" size="sm" onClick={() => setOpen(false)}>
                {t('Закрыть')}
              </Button>
            </div>
            {children}
          </div>
        )}
      </dialog>
    </>
  );
}
