import type { ReactNode } from 'react';
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
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  crumbs?: ReactNode;
  width?: 'narrow' | 'medium' | 'wide' | 'full' | undefined;
  children: ReactNode;
}) {
  return (
    <main id="main-content" tabIndex={-1} className={cx('page', width && `page--${width}`)}>
      {crumbs && <div className="page__crumbs">{crumbs}</div>}
      <header className="page__head">
        <div className="page__heading">
          <h1 className="page__title">{title}</h1>
          {subtitle && <div className="page__subtitle">{subtitle}</div>}
        </div>
        {actions && <nav className="page__actions">{actions}</nav>}
      </header>
      {children}
    </main>
  );
}
