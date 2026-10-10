import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Icon } from '../../../components/icon';
import { LandingFinal } from '../../../components/landing/landing-final';
import { typo } from '../../../components/typo';
import { getDictionary } from '../../../i18n';
import type { SegmentSlug } from '../../../i18n/types';
import { pageMetadata } from '../../../lib/metadata';
import { registerLink } from '../../../lib/site';

/*
 * Страницы типов гостиничных объектов (/for/hostels/, /for/mini-hotels/, /for/apart-hotels/), с 10.10.2026
 * на каркасе лендинга «Для гостиниц» (`app/for/hotels/page.tsx`): герой с цветным фото (свой файл из KIE,
 * не сток), возможности, настоящий экран календаря, честная строка «Пока нет», вопросы и общий финал.
 * Текст только из продукта (§19.9): ни цифр клиентов, ни цен; «7 дней» по ADR-098, один раз на экран.
 */
export const dynamicParams = false;

type Props = { params: Promise<{ segment: string }> };

/** Без salons, hotels и restaurants: у направлений свои лендинги в `app/for/<slug>/page.tsx`. */
const SLUGS = ['hostels', 'mini-hotels', 'apart-hotels'] as const;
type Slug = (typeof SLUGS)[number];

const PHOTO: Record<Slug, string> = {
  hostels: '/photos/hostel.jpg',
  'mini-hotels': '/photos/minihotel.jpg',
  'apart-hotels': '/photos/aparthotel.jpg',
};

export function generateStaticParams(): Array<{ segment: SegmentSlug }> {
  return SLUGS.map((segment) => ({ segment }));
}

function resolve(slug: string): Slug {
  const known = SLUGS.find((candidate) => candidate === slug);
  if (!known) notFound();
  return known;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segment } = await params;
  const item = getDictionary().segments.items[resolve(segment)];
  return pageMetadata({
    path: `/for/${segment}/`,
    title: item.metaTitle,
    description: item.description,
  });
}

export default async function SegmentPage({ params }: Props) {
  const slug = resolve((await params).segment);
  const t = getDictionary();
  const item = t.segments.items[slug];
  const register = registerLink(undefined, 'HOSPITALITY').href;
  return (
    <div className="page">
      <div className="container">
        <section className="hotel-hero" aria-labelledby="segment-title">
          <div>
            <p className="eyebrow">{item.metaTitle}</p>
            <h1 id="segment-title" className="page-header__title">
              {typo(item.title)}
            </h1>
            <p className="page-header__lead">{typo(item.lead)}</p>
            <div className="hotel-hero__actions">
              <a className="btn btn--primary btn--lg" href={register} data-auth="register">
                {t.hotel.primary}
                <Icon name="arrowRight" size={18} />
              </a>
              <a className="btn btn--secondary btn--lg" href="#segment-features">
                {t.hotel.secondary}
                <Icon name="arrowDown" size={18} />
              </a>
            </div>
            <ul className="hotel-hero__chips">
              {item.cards.slice(0, 3).map((card) => (
                <li key={card.title}>
                  <Icon name="check" size={15} />
                  {card.title}
                </li>
              ))}
            </ul>
          </div>
          <figure className="hotel-hero__figure hotel-hero__photo">
            <img src={PHOTO[slug]} alt={item.photoAlt ?? ''} width={1184} height={864} />
          </figure>
        </section>

        <section
          id="segment-features"
          className="section section--tight"
          aria-labelledby="segment-features-title"
        >
          <div className="section-heading section-heading--center">
            <p className="eyebrow">{t.nav.features}</p>
            <h2 id="segment-features-title" className="section-heading__title">
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
            <p className="card glass glass--quiet card__text">
              <strong>{t.segments.limitsLabel}:</strong> {typo(item.limits)}
            </p>
          ) : null}
        </section>

        <section className="hotel-shot" aria-labelledby="segment-calendar-title">
          <div className="section-heading section-heading--center">
            <p className="eyebrow">{t.hotel.calendar.eyebrow}</p>
            <h2 id="segment-calendar-title" className="section-heading__title">
              {typo(t.hotel.calendar.title)}
            </h2>
            <p className="section-heading__lead">{typo(t.hotel.calendar.lead)}</p>
          </div>
          <figure className="hotel-shot__frame">
            <picture>
              <source srcSet="/screens/calendar-week-dark.png" media="(prefers-color-scheme: dark)" />
              <img
                src="/screens/calendar-week-light.png"
                alt={t.hotel.calendar.alt}
                width={1440}
                height={1000}
                loading="lazy"
              />
            </picture>
            <figcaption>{t.hotel.calendar.note}</figcaption>
          </figure>
        </section>

        <LandingFinal
          faq={{ title: t.hotel.faqTitle, items: item.faq ?? [] }}
          cta={{
            title: t.segments.ctaTitle,
            text: t.segments.ctaText,
            note: t.final.note,
            register: { href: register, label: t.nav.register },
            secondary: { href: '/calculator/', label: t.calculator.link },
            photo: { src: '/photos/hotel.jpg', alt: '' },
          }}
        />
      </div>
    </div>
  );
}
