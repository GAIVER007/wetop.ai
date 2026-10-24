import { ProductPreview } from '../../../components/landing/product-preview';
import type { Metadata } from 'next';
import { Icon } from '../../../components/icon';
import { LandingFinal } from '../../../components/landing/landing-final';
import { MarketingBlock } from '../../../components/landing/marketing-block';
import { SubtypeLinks } from '../../../components/landing/subtype-links';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { typo } from '../../../components/typo';
import { getDictionary, type Locale } from '../../../i18n';
import { LangSwitch } from '../../../components/lang-switch';
import { pageMetadata } from '../../../lib/metadata';
import { registerLink } from '../../../lib/site';

/*
 * Лендинг «Для ресторанов» (10.10.2026): каркас гостиничного (`app/for/hotels/page.tsx`) в базовой
 * палитре; в герое цветное фото зала (сгенерировано через KIE по решению владельца, свой файл) вместо
 * мокапа. Возможности — ресторанный модуль (ADR-159, DATA_MODEL §33): зал, брони, заказы и кухня,
 * меню с техкартами, смены и зарплата. Текст по §19.9; условий trial нет (ADR-147).
 * Блоки переиспользуют классы `.hotel-*` групповыми селекторами (реестр §19.5, строка `.restaurant-*`).
 */
export function restaurantsDirectionMetadata(locale: Locale): Metadata {
  const t = getDictionary(locale);
  return pageMetadata({
    path: locale === 'kk' ? '/kk/for/restaurants/' : '/for/restaurants/',
    locale,
    languages: {
      ru: '/for/restaurants/',
      kk: '/kk/for/restaurants/',
      'x-default': '/for/restaurants/',
    },
    image: '/og/restaurant.jpg',
    title: t.restaurant.metaTitle,
    description: t.restaurant.description,
  });
}

export const metadata: Metadata = restaurantsDirectionMetadata('ru');

export function RestaurantLanding({ locale = 'ru' }: { locale?: Locale }) {
  const t = getDictionary(locale);
  const prefix = locale === 'kk' ? '/kk' : '';
  const s = t.restaurant;
  const register = registerLink(undefined, 'FOOD_SERVICE').href;
  return (
    <div className="page">
      <div className="container">
        <Breadcrumbs
          label={t.a11y.breadcrumbs}
          trail={[
            { name: t.a11y.crumbHome, path: '/' },
            { name: t.restaurant.badge, path: `${prefix}/for/restaurants/` },
          ]}
        />
        <LangSwitch locale={locale} ruPath="/for/restaurants/" kkPath="/kk/for/restaurants/" />
        <div className="landing">
          <section className="hotel-hero restaurant-hero" aria-labelledby="restaurant-title">
            <div>
              <p className="eyebrow">{s.badge}</p>
              <h1 id="restaurant-title" className="page-header__title">
                {typo(s.title)}
              </h1>
              <p className="page-header__lead">{typo(s.lead)}</p>
              <div className="hotel-hero__actions">
                <a className="btn btn--primary btn--lg" href={register} data-auth="register">
                  {s.primary}
                  <Icon name="arrowRight" size={18} />
                </a>
                <a className="btn btn--secondary btn--lg" href="#restaurant-features">
                  {s.secondary}
                  <Icon name="arrowDown" size={18} />
                </a>
              </div>
              <ul className="hotel-hero__chips">
                {s.chips.map((chip) => (
                  <li key={chip}>
                    <Icon name="check" size={15} />
                    {chip}
                  </li>
                ))}
              </ul>
            </div>
            <figure className="hotel-hero__figure">
              <ProductPreview vertical="FOOD_SERVICE" label={t.hero.dash.label} />
              <figcaption>{t.hero.dash.label}</figcaption>
            </figure>
          </section>

          <ul className="hotel-facts">
            {s.facts.map((fact) => (
              <li key={fact.value} className="hotel-facts__item">
                <strong>{fact.value}</strong>
                <span>{typo(fact.text)}</span>
              </li>
            ))}
          </ul>

          <section
            id="restaurant-features"
            className="section section--tight"
            aria-labelledby="restaurant-features-title"
          >
            <div className="section-heading section-heading--center">
              <p className="eyebrow">{t.nav.features}</p>
              <h2 id="restaurant-features-title" className="section-heading__title">
                {typo(s.featuresTitle)}
              </h2>
              <p className="section-heading__lead">{typo(s.featuresLead)}</p>
            </div>
            <ul className="card-grid card-grid--3">
              {s.features.map((card) => (
                <li key={card.title} className="card glass">
                  <span className="icon-tile">
                    <Icon name={card.icon} />
                  </span>
                  <h3 className="card__title">
                    {typo(card.title)} {card.soon ? <span className="tag">{s.soon}</span> : null}
                  </h3>
                  <p className="card__text">{typo(card.text)}</p>
                  <ul className="verticals__capabilities">
                    {card.points.map((point) => (
                      <li key={point}>
                        <Icon name="check" size={15} />
                        {typo(point)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          <section className="hotel-growth glass" aria-labelledby="restaurant-growth-title">
            <div className="hotel-growth__art hotel-growth__art--photo">
              <img src="/photos/barcounter.jpg" alt="" loading="lazy" width={1184} height={864} />
              <span className="hotel-growth__float">
                <strong>{s.growth.float.value}</strong>
                {s.growth.float.text}
              </span>
            </div>
            <div>
              <p className="eyebrow">{s.growth.badge}</p>
              <h2 id="restaurant-growth-title" className="hotel-growth__title">
                {typo(s.growth.title)}
              </h2>
              <p className="hotel-growth__text">{typo(s.growth.text)}</p>
              <ul className="hotel-growth__points">
                {s.growth.points.map((point) => (
                  <li key={point}>
                    <Icon name="check" size={15} />
                    {typo(point)}
                  </li>
                ))}
              </ul>
              <a className="btn btn--primary" href={register} data-auth="register">
                {s.growth.action}
                <Icon name="arrowRight" size={16} />
              </a>
            </div>
          </section>

          {/* Настоящий экран продукта: план зала с демо-данными, светлая и тёмная темы */}
          <section className="hotel-shot" aria-labelledby="restaurant-shot-title">
            <div className="section-heading section-heading--center">
              <p className="eyebrow">{t.restaurant.shot.eyebrow}</p>
              <h2 id="restaurant-shot-title" className="section-heading__title">
                {typo(t.restaurant.shot.title)}
              </h2>
              <p className="section-heading__lead">{typo(t.restaurant.shot.lead)}</p>
            </div>
            <figure className="hotel-shot__frame">
              <picture>
                <source
                  srcSet="/screens/restaurant-floor-dark.png"
                  media="(prefers-color-scheme: dark)"
                />
                <img
                  src="/screens/restaurant-floor-light.png"
                  alt={t.restaurant.shot.alt}
                  width={1440}
                  height={640}
                  loading="lazy"
                />
              </picture>
              <figcaption>{t.restaurant.shot.note}</figcaption>
            </figure>
          </section>

          <SubtypeLinks
            direction="restaurants"
            title={t.segments.typesTitle.restaurants}
            locale={locale}
          />

          <MarketingBlock
            id="marketing"
            copy={t.marketing.restaurant}
            eyebrow={t.marketing.eyebrow}
            soon={t.marketing.soon}
          />

          <LandingFinal
            faq={{ title: s.faqTitle, items: s.faq }}
            cta={{
              title: s.ctaTitle,
              text: s.ctaText,
              note: t.final.note,
              register: { href: register, label: t.nav.register },
              secondary: { href: '/', label: t.segments.home },
              photo: { src: '/photos/barcounter.jpg', alt: '' },
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function RestaurantLandingPage() {
  return <RestaurantLanding locale="ru" />;
}
