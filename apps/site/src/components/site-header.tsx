import Link from 'next/link';
import { getDictionary } from '../i18n';
import { loginLink, trialLink } from '../lib/site';
import { getPublishedPosts } from '../lib/posts';
import { Wordmark } from './brand';
import { MobileMenu } from './mobile-menu';

export function SiteHeader() {
  const t = getDictionary();
  const login = loginLink();
  const trial = trialLink();
  // Якоря ведут на главную: из блога ссылка «Возможности» открывает главную сразу на нужном разделе.
  // «Блог» — только когда есть опубликованные статьи (С2, 20.09.2026): пустую страницу в меню не зовём.
  const hasPosts = getPublishedPosts().length > 0;
  const links = [
    { href: '/#audience', label: t.nav.audience },
    { href: '/#features', label: t.nav.features },
    { href: '/#start', label: t.nav.start },
    ...(hasPosts ? [{ href: '/blog/', label: t.nav.blog }] : []),
  ];

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="site-header__brand" aria-label={t.a11y.home}>
          <Wordmark />
        </Link>
        <nav className="site-nav" aria-label={t.a11y.mainNav}>
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          <a className="btn btn--ghost btn--sm site-header__login" href={login.href}>
            {t.nav.login}
          </a>
          <a className="btn btn--primary btn--sm site-header__trial" href={trial.href}>
            {t.nav.trial}
          </a>
          <MobileMenu
            links={links}
            login={{ href: login.href, label: t.nav.login }}
            trial={{ href: trial.href, label: t.nav.trial }}
            labels={{ button: t.a11y.menu, nav: t.a11y.mainNav }}
          />
        </div>
      </div>
    </header>
  );
}
