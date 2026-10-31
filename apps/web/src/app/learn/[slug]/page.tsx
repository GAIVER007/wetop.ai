import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Page } from '../../../components/page';
import { guideBySlug, guideLang, guidePages, type GuideLang } from '../../../lib/guides';
import { currentLocale, serverT } from '../../../i18n/server';
import '../learn.css';

/**
 * Одна инструкция целиком (вариант B): все страницы подряд, сверху язык, «Скачать PDF» и «Все инструкции».
 * Язык по умолчанию как у интерфейса, переключатель меняет только инструкцию.
 */
export default async function GuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const guide = guideBySlug(slug);
  if (!guide) notFound();
  const t = await serverT();
  const lang: GuideLang = query.lang === 'en' || query.lang === 'ru' ? query.lang : guideLang(await currentLocale());
  const pages = guidePages(guide, lang);
  return (
    <Page
      width="medium"
      title={t(guide.title)}
      subtitle={t(guide.description)}
      crumbs={<Link href="/learn">{t('Все инструкции')}</Link>}
      actions={
        <div className="learn-actions">
          <nav className="seg" aria-label={t('Язык инструкции')}>
            {(['ru', 'en'] as const).map((l) => (
              <Link key={l} className="seg__item" href={`/learn/${guide.slug}?lang=${l}`} aria-current={l === lang ? 'page' : undefined} aria-pressed={l === lang}>
                {l === 'ru' ? t('Русский') : 'English'}
              </Link>
            ))}
          </nav>
          <a className="btn btn--secondary" href={guide.files[lang].pdf} download data-testid="learn-download">
            {t('Скачать PDF')}
          </a>
        </div>
      }
    >
      <ol className="learn-pages" data-testid="learn-pages" aria-label={t('Страницы инструкции')}>
        {pages.map((src, i) => (
          <li key={src}>
            {/* готовая картинка страницы из public, без оптимизатора */}
            <img src={src} alt={t('Страница {n} из {total}', { n: i + 1, total: pages.length })} width={1100} height={1556} loading={i < 2 ? 'eager' : 'lazy'} />
          </li>
        ))}
      </ol>
      <p className="learn-back">
        <Link className="btn btn--secondary" href="/learn">{t('Все инструкции')}</Link>
      </p>
    </Page>
  );
}
