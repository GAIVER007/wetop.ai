import type { Metadata } from 'next';
import { Icon } from '../../../components/icon';
import { LandingFinal } from '../../../components/landing/landing-final';
import { typo } from '../../../components/typo';
import { getDictionary } from '../../../i18n';
import { pageMetadata } from '../../../lib/metadata';
import { registerLink } from '../../../lib/site';

/*
 * Лендинг «Для ресторанов» (10.10.2026): каркас гостиничного (`app/for/hotels/page.tsx`) в базовой
 * палитре; в герое цветное фото зала (сгенерировано через KIE по решению владельца, свой файл) вместо
 * мокапа. Возможности — только влитый контур FOOD_SERVICE §28 (план зала, столы, брони, периоды);
 * меню и кухня из невлитой ветки не обещаются. Текст по §19.9; «7 дней» по ADR-098, один раз на экран.
 * Блоки переиспользуют классы `.hotel-*` групповыми селекторами (реестр §19.5, строка `.restaurant-*`).
 */
export const metadata: Metadata = pageMetadata({
  path: '/for/restaurants/',
  title: getDictionary().restaurant.metaTitle,
  description: getDictionary().restaurant.description,
});

export default function RestaurantLandingPage() {
  const t = getDictionary();
  const s = t.restaurant;
  const register = registerLink(undefined, 'FOOD_SERVICE').href;
  return (
    <div className="page">
      <div className="container">
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
          <figure className="hotel-hero__figure restaurant-hero__photo">
            <img src="/photos/restaurant.jpg" alt={s.photoAlt} width={1184} height={864} />
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
          <ul className="card-grid card-grid--4">
            {s.features.map((card) => (
              <li key={card.title} className="card glass">
                <span className="icon-tile">
                  <Icon name={card.icon} />
                </span>
                <h3 className="card__title">{typo(card.title)}</h3>
                <p className="card__text">{typo(card.text)}</p>
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
  );
}
