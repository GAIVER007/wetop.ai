'use client';
import { useEffect, useId, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../components/icon';

/**
 * Панель места рядом со списком (снимок владельца 09.10): на широком экране закреплена колонкой справа,
 * список остаётся доступен и кликабелен; на узком (до 960 px) та же панель выезжает поверх (CSS). Закрытие шагом
 * назад, как у RouteDrawer: Escape, кнопка «Закрыть». Не модальна: фокус не запирается.
 */
export function DockedPanel({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // открытое меню или окно внутри панели закрывает Escape первым
      if ((e.target as HTMLElement | null)?.closest('[role="menu"], dialog[open]')) return;
      if (document.querySelector('dialog[open]')) return;
      router.back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [router]);
  return (
    <aside className="fund-aside" aria-labelledby={titleId} data-testid="unit-aside">
      <header className="fund-aside__head">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={`Закрыть: ${title}`}
          onClick={() => router.back()}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="fund-aside__body">{children}</div>
    </aside>
  );
}
