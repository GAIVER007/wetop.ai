import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '../../../components/icon';
import { typo } from '../../../components/typo';
import { getDictionary } from '../../../i18n';
import type { SegmentSlug } from '../../../i18n/types';
import { pageMetadata } from '../../../lib/metadata';
import { registerLink } from '../../../lib/site';

/*
 * Страницы «для кого»: три направления (/for/hotels/, /for/salons/, /for/restaurants/, поручение
 * владельца 09.10.2026: подстраница с чётким описанием системы для каждого направления) и три типа
 * гостиничных объектов (/for/hostels/, /for/mini-hotels/, /for/apart-hotels/, срез D2).
 * Собраны из блоков главной: `.page`, `.card-grid`, `.card`, `.tag-list`, `.cta`. Новых блоков нет (DESIGN.md §19.5).
 * Текст — только из продукта (§19.9): ни цифр клиентов, ни цен.
 */
export const dynamicParams = false;

type Props = { params: Promise<{ segment: string }> };

const SLUGS: SegmentSlug[] = [
  'hotels',
  'salons',
  'restaurants',
  'hostels',
  'mini-hotels',
  'apart-hotels',
];

/** Направление регистрации для CTA страницы: салоны и рестораны предвыбирают свою вертикаль. */
const VERTICAL: Partial<Record<SegmentSlug, 'BEAUTY' | 'FOOD_SERVICE'>> = {
  salons: 'BEAUTY',
  restaurants: 'FOOD_SERVICE',
};

export function generateStaticParams(): Array<{ segment: SegmentSlug }> {
  return SLUGS.map((segment) => ({ segment }));
}

function resolve(slug: string) {
  if (!SLUGS.includes(slug as SegmentSlug)) notFound();
  return getDictionary().segments.items[slug as SegmentSlug];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segment } = await params;
  const item = resolve(segment);
  return pageMetadata({
    path: `/for/${segment}/`,
    title: item.metaTitle,
    description: item.description,
  });
}

export default async function SegmentPage({ params }: Props) {
  const { segment } = await params;
  const t = getDictionary();
  const item = resolve(segment);
  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <p className="eyebrow">{t.segments.eyebrow}</p>
          <h1 className="page-header__title">{typo(item.title)}</h1>
          <p className="page-header__lead">{typo(item.lead)}</p>
        </header>
        <section className="section section--tight" aria-labelledby="segment-features">
          <div className="section-heading">
            <h2 id="segment-features" className="section-heading__title">
              {typo(t.segments.featuresTitle)}
            </h2>
          </div>
          <ul className="card-grid card-grid--3">
            {item.cards.map((card) => (
              <li key={card.title} className="card glass">
                <span className="icon-tile">
                  <Icon name={card.icon} />
                </span>
                <h3 className="card__title">{typo(card.title)}</h3>
                <p className="card__text">{typo(card.text)}</p>
                {card.tags ? (
                  <ul className="tag-list">
                    {card.tags.map((tag) => (
                      <li key={tag} className="tag">
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          {item.limits ? (
            <div className="card glass glass--quiet">
              <p className="card__text">
                <strong>{t.segments.limitsLabel}:</strong> {typo(item.limits)}
              </p>
            </div>
          ) : null}
        </section>
        <div className="cta glass glass--strong">
          <div className="cta__copy">
            <h2 className="cta__title">{typo(t.segments.ctaTitle)}</h2>
            <p className="cta__text">{typo(t.segments.ctaText)}</p>
            <div className="cta__actions">
              <a
                className="btn btn--primary btn--lg"
                href={registerLink(undefined, VERTICAL[segment as SegmentSlug] ?? 'HOSPITALITY').href}
                data-auth="register"
              >
                {t.nav.register}
                <Icon name="arrowRight" size={18} />
              </a>
              {VERTICAL[segment as SegmentSlug] ? null : (
                <Link className="link-arrow" href="/calculator/">
                  {t.calculator.link}
                </Link>
              )}
              <Link className="link-arrow" href="/">
                {t.segments.home}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
