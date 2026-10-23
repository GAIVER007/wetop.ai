import Link from 'next/link';
import { DIRECTIONS, subtypesOf } from '../lib/landings';
import { getDictionary, type Locale } from '../i18n';
import { companyName, loginLink } from '../lib/site';
import { getPublishedPosts } from '../lib/posts';
import { Wordmark } from './brand';
import { typo } from './typo';
import styles from './site-footer.module.css';

/*
 * Навигация, направления и заметные правовые ссылки. Блог виден при опубликованных статьях.
 */
const DIRECTION_COPY = { hotels: 'hotel', salons: 'salon', restaurants: 'restaurant' } as const;

export function SiteFooter({ locale = 'ru' }: { locale?: Locale }) {
  const t = getDictionary(locale);
  // Казахские страницы направлений есть у всех 30 адресов «для кого»; главная, блог и правовые только русские
  const prefix = locale === 'kk' ? '/kk' : '';
  // Год сборки: сайт статический, пересобирается при каждой выкладке.
  const year = new Date().getFullYear();
  const owner = companyName() || t.meta.siteName;
  const hasPosts = getPublishedPosts().length > 0;

  return (
    <footer id="contacts" className={`site-footer ${styles.footer}`}>
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
              {hasPosts ? (
                <li>
                  <Link href="/blog/">{t.nav.blog}</Link>
                </li>
              ) : null}
              <li>
                <a href={loginLink().href} data-auth="login">
                  {t.nav.login}
                </a>
              </li>
            </ul>
          </nav>
          <p className="site-footer__copy">
            © {year} {owner}
          </p>
        </div>
        {/* Все лендинги направлений и типов бизнеса: внутренние ссылки для людей и поисковиков */}
        <nav className="site-footer__directions" aria-label={t.footer.directions}>
          {DIRECTIONS.map((direction) => {
            const own = t[DIRECTION_COPY[direction]];
            return (
              <div key={direction}>
                <Link className="site-footer__direction" href={`${prefix}/for/${direction}/`}>
                  {own.badge}
                </Link>
                <ul>
                  {subtypesOf(direction).map((slug) => (
                    <li key={slug}>
                      <Link href={`${prefix}/for/${slug}/`}>{t.segments.items[slug].metaTitle}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        <nav className={`site-footer__legal ${styles.legal}`} aria-label={t.a11y.legalNav}>
          <Link href="/privacy/">{t.footer.privacy}</Link>
          <Link href="/terms/">{t.footer.terms}</Link>
        </nav>
      </div>
    </footer>
  );
}
