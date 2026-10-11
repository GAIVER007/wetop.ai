import { ThemeToggle } from './theme-toggle';
import Link from 'next/link';
import { getDictionary } from '../i18n';
import { loginLink, registerLink } from '../lib/site';
import { Wordmark } from './brand';
import { MobileMenu } from './mobile-menu';

export function SiteHeader() {
  const t = getDictionary();
  const login = loginLink();
  const register = registerLink();
  const links = [
    { href: '/#product', label: t.nav.product },
    { href: '/#audience', label: t.nav.audience },
    { href: '/#features', label: t.nav.features },
    { href: '/#sales', label: t.nav.sales },
    { href: '/#start', label: t.nav.start },
  ];

  return (
    <header className="site-header public-header">
      <div className="container site-header__inner">
        <Link href="/" className="site-header__brand" aria-label={t.a11y.home}>
          <Wordmark withDomain />
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
          <ThemeToggle />
          <a
            className="btn btn--ghost btn--sm site-header__login"
            href={login.href}
            data-auth="login"
          >
            {t.nav.login}
          </a>
          <a
            className="public-intro__primary site-header__register"
            href={register.href}
            data-auth="register"
          >
            {t.nav.register}
          </a>
          <MobileMenu
            links={links}
            login={{ href: login.href, label: t.nav.login }}
            register={{ href: register.href, label: t.nav.register }}
            labels={{ button: t.a11y.menu, nav: t.a11y.mainNav }}
          />
        </div>
      </div>
    </header>
  );
}
