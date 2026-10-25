import type { ReactNode } from 'react';
import Link from 'next/link';
import { msg } from '../i18n';
import { Labelled } from '../i18n/locale-provider';
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
  embedded,
  children,
}: {
  className?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  crumbs?: ReactNode;
  width?: 'narrow' | 'medium' | 'wide' | 'full' | undefined;
  /**
   * Страница внутри модальной панели (`RouteDrawer`): без `id="main-content"`. Цель ссылки «К содержимому» у документа
   * одна; повторный `id` в окне делал её неоднозначной. Ориентир `main` остаётся: окно модальное (`aria-modal`), за его
   * пределами читалка ничего не видит (мастер-проход UI, этап 4; полный отказ от `main` в окне ломал 40 спеков)
   */
  embedded?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <main
      {...(embedded ? {} : { id: 'main-content', tabIndex: -1 })}
      className={cx('page', width && `page--${width}`, className)}
    >
      {crumbs && <div className="page__crumbs">{crumbs}</div>}
      <header className="page__head">
        <div className="page__heading">
          <h1 className="page__title">{title}</h1>
          {subtitle && <div className="page__subtitle">{subtitle}</div>}
        </div>
        {actions && (
          <Labelled as="nav" className="page__actions" label={msg('Действия страницы')}>
            {actions}
          </Labelled>
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
