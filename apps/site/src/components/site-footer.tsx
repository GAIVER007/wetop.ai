import Link from 'next/link';
import { getDictionary } from '../i18n';
import { companyName, loginLink } from '../lib/site';
import { getPublishedPosts } from '../lib/posts';
import { Wordmark } from './brand';
import { typo } from './typo';

/*
 * Подвал — стеклянная плита и нижняя строка: слева ©, по центру звезда, справа девиз (оба снимка
 * направления). Знак подвала берёт свой `id` градиента: два одинаковых в одном документе не бывает.
 */
export function SiteFooter() {
  const t = getDictionary();
  // Год сборки: сайт статический, пересобирается при каждой выкладке.
  const year = new Date().getFullYear();
  const owner = companyName() || t.meta.siteName;
  // «Блог» в подвале — только при опубликованных статьях (С2, 20.09.2026)
  const hasPosts = getPublishedPosts().length > 0;

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__panel glass glass--quiet">
          <div className="site-footer__brand">
            <Link href="/" className="site-header__brand" aria-label={t.a11y.home}>
              <Wordmark id="brand-footer" />
            </Link>
            <p>{typo(t.footer.tagline)}</p>
          </div>
          <nav aria-label={t.a11y.footerNav}>
            <ul className="site-footer__links">
              {hasPosts ? (
                <li>
                  <Link href="/blog/">{t.nav.blog}</Link>
                </li>
              ) : null}
              <li>
                <a href={loginLink().href}>{t.nav.login}</a>
              </li>
            </ul>
          </nav>
          <div className="site-footer__bar">
            <p className="site-footer__copy">
              © {year} {owner}
            </p>
            <span className="site-footer__star" aria-hidden="true">
              ✦
            </span>
            <p className="site-footer__motto">{t.footer.motto}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
