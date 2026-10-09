import Link from 'next/link';
import { getDictionary } from '../i18n';
import { companyName, loginLink } from '../lib/site';
import { getPublishedPosts } from '../lib/posts';
import { Wordmark } from './brand';
import { typo } from './typo';

/*
 * Подвал одной строкой (по снимку владельца): бренд и подпись слева, ссылки по центру, © справа;
 * ниже мелкая строка с правовыми страницами. «Блог» — только при опубликованных статьях.
 */
export function SiteFooter() {
  const t = getDictionary();
  // Год сборки: сайт статический, пересобирается при каждой выкладке.
  const year = new Date().getFullYear();
  const owner = companyName() || t.meta.siteName;
  const hasPosts = getPublishedPosts().length > 0;

  return (
    <footer id="contacts" className="site-footer">
      <div className="container">
        <div className="site-footer__row">
          <div className="site-footer__brand">
            <Link href="/" className="site-header__brand" aria-label={t.a11y.home}>
              <Wordmark id="brand-footer" />
            </Link>
            <p>{typo(t.footer.tagline)}</p>
          </div>
          <nav aria-label={t.a11y.footerNav}>
            <ul className="site-footer__links">
              <li>
                <a href="/#product">{t.footer.product}</a>
              </li>
              <li>
                <a href="/#features">{t.footer.features}</a>
              </li>
              <li>
                <Link href="/calculator/">{t.calculator.link}</Link>
              </li>
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
          <p className="site-footer__copy">
            © {year} {owner}
          </p>
        </div>
        <div className="site-footer__legal">
          <Link href="/privacy/">{t.footer.privacy}</Link>
          <Link href="/terms/">{t.footer.terms}</Link>
        </div>
      </div>
    </footer>
  );
}
