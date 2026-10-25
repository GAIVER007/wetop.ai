'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/locale-provider';

/**
 * «На весь экран» журнала (владелец 24.10.2026: «добавь везде на всех экранах квадратик, который расширяет экран
 * журнала, как в отелях, перед быстрым отчётом»). Тот же значок и подписи, что у календаря гостиницы
 * (`CalendarExpandButton compact`): журнал (`.page.journal-page`) раскрывается поверх шапки и меню на весь экран,
 * повторное нажатие или Esc возвращают обычный вид. Esc при открытом окне закрывает окно, а не полный экран.
 */
export function JournalExpandButton() {
  const t = useT();
  const button = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const page = button.current?.closest<HTMLElement>('.journal-page');
    if (!page) return;
    if (expanded) page.dataset.expanded = 'true';
    else delete page.dataset.expanded;
    if (!expanded) return () => undefined;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return;
      setExpanded(false);
      button.current?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('keydown', escape);
      delete page.dataset.expanded;
    };
  }, [expanded]);
  return (
    <button
      ref={button}
      type="button"
      className="icon-button journal-expand"
      aria-pressed={expanded}
      title={expanded ? t('Выйти из полного экрана') : t('На весь экран')}
      onClick={() => setExpanded((value) => !value)}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
      </svg>
      <span className="sr-only">{expanded ? t('Выйти из полного экрана') : t('На весь экран')}</span>
    </button>
  );
}
