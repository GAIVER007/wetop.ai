// Заглушка next/link для сборки дизайн-системы: вне приложения Next роутера нет,
// а ссылка в макете должна оставаться ссылкой. Подключается через compilerOptions.paths
// в .design-sync/ds/tsconfig.json — код продукта не меняется.
import type { AnchorHTMLAttributes, ReactNode } from 'react';

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children?: ReactNode;
  prefetch?: unknown;
  replace?: unknown;
  scroll?: unknown;
  shallow?: unknown;
  passHref?: unknown;
  legacyBehavior?: unknown;
  locale?: unknown;
};

export default function Link({
  href,
  children,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  shallow: _shallow,
  passHref: _passHref,
  legacyBehavior: _legacyBehavior,
  locale: _locale,
  ...rest
}: LinkProps) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
