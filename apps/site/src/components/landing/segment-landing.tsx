import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '../breadcrumbs';
import { Icon } from '../icon';
import { LangSwitch } from '../lang-switch';
import { typo } from '../typo';
import { getDictionary, type Locale } from '../../i18n';
import { SUBTYPES, SUBTYPE_SLUGS, type Subtype } from '../../lib/landings';
import { pageMetadata } from '../../lib/metadata';
import { registerLink } from '../../lib/site';
import { LandingFinal } from './landing-final';
import { MarketingBlock } from './marketing-block';
import { ProductPreview } from './product-preview';
import { SubtypeLinks } from './subtype-links';

/*
 * Общий каркас страницы типа бизнеса для обоих языков (вынесен из app/for/[segment]/page.tsx, 21.10.2026):
 * русский маршрут живёт без префикса, казахский на /kk/for/<тип>/. Разметка не менялась, добавлены только
 * язык словаря, префикс внутренних ссылок раздела и переключатель языка; hreflang связывает пару страниц.
 * Текст только из продукта (§19.9): ни цифр клиентов, ни цен; условий trial нет (ADR-147).
 */

/** Что у страницы своё по направлению: словарь маркетинга, родитель для крошек, фото призыва, вторая ссылка. */
const BY_DIRECTION = {
  hotels: { marketing: 'hotel', parent: 'hotel', ctaPhoto: '/photos/hotel.jpg', page: 'page' },
  salons: {
    marketing: 'salon',
    parent: 'salon',
    ctaPhoto: '/photos/reception.jpg',
    page: 'page salon-page',
  },
  restaurants: {
    marketing: 'restaurant',
    parent: 'restaurant',
    ctaPhoto: '/photos/barcounter.jpg',
    page: 'page',
  },
} as const;

export function resolveSegment(slug: string): Subtype {
  const known = SUBTYPE_SLUGS.find((candidate) => candidate === slug);
  if (!known) notFound();
  return known;
}

/** Пара адресов страницы типа: русский без префикса, казахский с /kk; x-default ведёт на русский. */
export function segmentPaths(slug: Subtype) {
  return { ru: `/for/${slug}/`, kk: `/kk/for/${slug}/` };
}

export function segmentMetadata(slug: Subtype, locale: Locale): Metadata {
  const item = getDictionary(locale).segments.items[slug];
  const paths = segmentPaths(slug);
  return pageMetadata({
    path: paths[locale === 'kk' ? 'kk' : 'ru'],
    locale,
    languages: { ru: paths.ru, kk: paths.kk, 'x-default': paths.ru },
    // обрезка того же фото 1200×630 (public/og): размер, который мессенджеры показывают без обрезки
    image: SUBTYPES[slug].photo.replace('/photos/', '/og/'),
    title: item.seoTitle ?? item.metaTitle,
    description: item.description,
  });
}

export function SegmentLanding({ slug, locale }: { slug: Subtype; locale: Locale }) {
  const t = getDictionary(locale);
  const prefix = locale === 'kk' ? '/kk' : '';
  const paths = segmentPaths(slug);
  const item = t.segments.items[slug];
  const type = SUBTYPES[slug];
  const own = BY_DIRECTION[type.direction];
  const parent = t[own.parent];
  const register = registerLink(undefined, type.vertical).href;
  // Экран продукта по вертикали: файл из public/screens и подписи словаря
  const shot =
    type.vertical === 'HOSPITALITY'
      ? { base: '/screens/calendar-week', copy: t.hotel.calendar, height: 1000 }
      : type.vertical === 'BEAUTY'
        ? { base: '/screens/salon-day', copy: t.salon.shot, height: 1000 }
        : { base: '/screens/restaurant-floor', copy: t.restaurant.shot, height: 640 };
  const secondary =
    type.direction === 'hotels'
      ? { href: '/calculator/', label: t.calculator.link }
      : { href: `${prefix}/for/${type.direction}/`, label: parent.badge };
  return (
    <div className={own.page}>
      <div className="container">
        <Breadcrumbs
          label={t.a11y.breadcrumbs}
          trail={[
            { name: t.a11y.crumbHome, path: '/' },
            { name: parent.badge, path: `${prefix}/for/${type.direction}/` },
            { name: item.metaTitle, path: paths[locale === 'kk' ? 'kk' : 'ru'] },
          ]}
        />
        <LangSwitch locale={locale} ruPath={paths.ru} kkPath={paths.kk} />
        <div className="landing">
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
            <figure className="hotel-hero__figure">
              <ProductPreview
                vertical={type.vertical}
                src={t.segments.previews[slug] ? `/previews/${slug}.svg` : undefined}
                label={t.hero.dash.label}
              />
              <figcaption>{t.hero.dash.label}</figcaption>
            </figure>
          </section>

          {/* Полоса выгод направления: у всех страниц одного направления одна и та же, «Одна платформа» последней */}
          <ul className="hotel-facts">
            {parent.facts.map((fact) => (
              <li key={fact.value} className="hotel-facts__item">
                <strong>{fact.value}</strong>
                <span>{typo(fact.text)}</span>
              </li>
            ))}
          </ul>

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
          </section>

          <section className="section section--tight" aria-labelledby="segment-day-title">
            <div className="section-heading section-heading--center">
              <p className="eyebrow">{item.metaTitle}</p>
              <h2 id="segment-day-title" className="section-heading__title">
                {typo(t.segments.dayTitle)}
              </h2>
            </div>
            <ol className="steps">
              {t.segments.day[type.direction].map((step, index) => (
                <li key={step.title} className="step glass">
                  <span className="step__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3 className="card__title">{typo(step.title)}</h3>
                  <p className="card__text">{typo(step.text)}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Настоящий экран продукта своей вертикали: календарь размещений, день салона, план зала */}
          <section className="hotel-shot" aria-labelledby="segment-calendar-title">
            <div className="section-heading section-heading--center">
              <p className="eyebrow">{shot.copy.eyebrow}</p>
              <h2 id="segment-calendar-title" className="section-heading__title">
                {typo(shot.copy.title)}
              </h2>
              <p className="section-heading__lead">{typo(shot.copy.lead)}</p>
            </div>
            <figure className="hotel-shot__frame">
              <picture>
                <source srcSet={`${shot.base}-dark.png`} media="(prefers-color-scheme: dark)" />
                <img
                  src={`${shot.base}-light.png`}
                  alt={shot.copy.alt}
                  width={1440}
                  height={shot.height}
                  loading="lazy"
                />
              </picture>
              <figcaption>{shot.copy.note}</figcaption>
            </figure>
          </section>

          {item.about ? (
            /* Фотополоса «о формате»: свой снимок подтипа (из public/photos, KIE) и текст рядом.
               Блок .hotel-growth уже в реестре DESIGN.md §19.5, новых стилей нет. */
            <section className="hotel-growth glass" aria-labelledby="segment-about-title">
              <div className="hotel-growth__art hotel-growth__art--photo">
                <img src={type.photo} alt="" loading="lazy" width={1184} height={864} />
              </div>
              <div>
                <p className="eyebrow">{item.metaTitle}</p>
                <h2 id="segment-about-title" className="hotel-growth__title">
                  {typo(item.about.title)}
                </h2>
                {item.about.text.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)} className="hotel-growth__text">
                    {typo(paragraph)}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          <MarketingBlock
            id="marketing"
            copy={t.marketing[own.marketing]}
            eyebrow={t.marketing.eyebrow}
            soon={t.marketing.soon}
          />

          <SubtypeLinks
            direction={type.direction}
            title={t.segments.alsoTitle}
            exclude={slug}
            withDirection
            locale={locale}
          />

          <LandingFinal
            faq={{ title: t.hotel.faqTitle, items: item.faq ?? [] }}
            cta={{
              title: t.segments.ctaTitle,
              text: t.segments.ctaText,
              note: t.final.note,
              register: { href: register, label: t.nav.register },
              secondary,
              photo: { src: own.ctaPhoto, alt: '' },
            }}
          />
        </div>
      </div>
    </div>
  );
}
