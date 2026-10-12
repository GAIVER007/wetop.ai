import type { ReactNode } from 'react';
import Link from 'next/link';
import { cx } from './ui';

/**
 * Каркас экрана: один `main` на страницу (e2e ищут `main`), заголовок `h1` — ровно та строка,
 * которую проверяют тесты, справа — контекстные ссылки и действия. Ссылки на другие разделы
 * здесь не нужны: они в верхней навигации (`TopNav`).
 */
export function Page({
  title,
  subtitle,
  actions,
  crumbs,
  width,
  className,
  children,
}: {
  className?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  crumbs?: ReactNode;
  width?: 'narrow' | 'medium' | 'wide' | 'full' | undefined;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cx('page', width && `page--${width}`, className)}
    >
      {crumbs && <div className="page__crumbs">{crumbs}</div>}
      <header className="page__head">
        <div className="page__heading">
          <h1 className="page__title">{title}</h1>
          {subtitle && <div className="page__subtitle">{subtitle}</div>}
        </div>
        {actions && (
          <nav className="page__actions" aria-label="Действия страницы">
            {actions}
          </nav>
        )}
      </header>
      {children}
    </main>
  );
}

/**
 * Крошка «назад в раздел» одного вида на всех экранах: стрелка, название раздела с заглавной (мастер-проход UI,
 * этап 2). Стрелка скрыта от читалки, имя ссылки равно названию раздела.
 */
export function BackCrumb({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href}>
      <span aria-hidden="true">← </span>
      {children}
    </Link>
  );
}
