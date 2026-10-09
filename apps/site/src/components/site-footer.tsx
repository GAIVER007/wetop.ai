import Link from 'next/link';
import { getDictionary } from '../i18n';
import { companyName, contactLinks, loginLink } from '../lib/site';
import { getPublishedPosts } from '../lib/posts';
import { Wordmark } from './brand';
import { typo } from './typo';

/*
 * Подвал (LAND2, ТЗ §10): бренд, ссылки продукта, правовые страницы и контакты, нижняя строка с ©.
 * «Блог» только при опубликованных статьях; контакты только заполненные в site.config.ts.
 */
export function SiteFooter() {
  const t = getDictionary();
  // Год сборки: сайт статический, пересобирается при каждой выкладке.
  const year = new Date().getFullYear();
  const owner = companyName() || t.meta.siteName;
  const hasPosts = getPublishedPosts().length > 0;
  const contacts = contactLinks();

  return (
    <footer id="contacts" className="site-footer">
      <div className="container">
        <div className="site-footer__panel glass glass--quiet">
          <div className="site-footer__brand">
            <Link href="/" className="site-header__brand" aria-label={t.a11y.home}>
              <Wordmark id="brand-footer" />
            </Link>
            <p>{typo(t.footer.tagline)}</p>
          </div>
          <nav aria-label={t.a11y.footerNav} className="site-footer__nav">
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
            <ul className="site-footer__links">
              <li>
                <Link href="/privacy/">{t.footer.privacy}</Link>
              </li>
              <li>
                <Link href="/terms/">{t.footer.terms}</Link>
              </li>
              {contacts.map((contact) => (
                <li key={contact.href}>
                  <a href={contact.href}>{contact.label}</a>
                </li>
              ))}
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
