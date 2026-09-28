'use client';
import { useRouter } from 'next/navigation';
import { useRef, type MouseEvent, type ReactNode } from 'react';

/** Щелчок по этим элементам — их собственное действие, строка его не перехватывает */
const OWN_ACTION = 'a, button, input, select, textarea, label, summary, [role="button"]';
/**
 * Двойной щелчок отделяется от одиночного паузой: панель, открытая первым щелчком, накрыла бы строку
 * подложкой, и второй щелчок закрыл бы её вместо перехода на полную страницу.
 */
const DOUBLE_CLICK_MS = 250;

/**
 * Строки списка броней (ADR-106, R3; ТЗ «Брони v2» §18, §21): щелчок по любой ячейке открывает
 * быстрый просмотр — ту же панель, что ссылка первой ячейки; двойной щелчок — полная страница брони.
 * Клавиатура не меняется: фокус и Enter — на ссылке первой ячейки.
 */
export function PreviewRows({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pending = useRef<number | null>(null);
  const hrefOf = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest(OWN_ACTION)) return null;
    return (
      target.closest('tr')?.querySelector<HTMLAnchorElement>('a.dir-guest')?.getAttribute('href') ??
      null
    );
  };
  const cancelPending = () => {
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = null;
  };
  return (
    <tbody
      onClick={(event) => {
        const href = hrefOf(event);
        if (!href || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        // выделяли текст (номер брони, телефон) — это копирование, а не открытие
        if (window.getSelection()?.toString()) return;
        cancelPending();
        pending.current = window.setTimeout(() => {
          pending.current = null;
          router.push(href, { scroll: false });
        }, DOUBLE_CLICK_MS);
      }}
      onDoubleClick={(event) => {
        const href = hrefOf(event);
        if (!href) return;
        cancelPending();
        window.getSelection()?.removeAllRanges();
        window.location.assign(href);
      }}
    >
      {children}
    </tbody>
  );
}
