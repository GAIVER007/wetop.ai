import type { Metadata } from 'next';
import { Icon } from '../../../components/icon';
import { DashMock } from '../../../components/landing/dash-mock';
import { LandingFinal } from '../../../components/landing/landing-final';
import { typo } from '../../../components/typo';
import { getDictionary } from '../../../i18n';
import { pageMetadata } from '../../../lib/metadata';
import { registerLink } from '../../../lib/site';

/*
 * Лендинг «Для гостиниц» (10.10.2026): тот же каркас, что у одобренного салонного
 * (`app/for/salons/page.tsx`), в базовой палитре сайта: герой с общим дашборд-мокапом «Сегодня»
 * (`DashMock`), полоса фактов продукта, восемь возможностей, блок роста с рисунком на SVG,
 * вопросы и призыв. Текст только из продукта (§19.9): ни чисел клиентов, ни кейсов, ни тарифов;
 * «7 дней бесплатно» по ADR-098.
 */
export const metadata: Metadata = pageMetadata({
  path: '/for/hotels/',
  title: getDictionary().hotel.metaTitle,
  description: getDictionary().hotel.description,
});

export default function HotelLandingPage() {
  const t = getDictionary();
  const s = t.hotel;
  const register = registerLink(undefined, 'HOSPITALITY').href;
  return (
    <div className="page">
      <div className="container">
        <section className="hotel-hero" aria-labelledby="hotel-title">
          <div>
            <p className="eyebrow">{s.badge}</p>
            <h1 id="hotel-title" className="page-header__title">
              {typo(s.title)}
            </h1>
            <p className="page-header__lead">{typo(s.lead)}</p>
            <div className="hotel-hero__actions">
              <a className="btn btn--primary btn--lg" href={register} data-auth="register">
                {s.primary}
                <Icon name="arrowRight" size={18} />
              </a>
              <a className="btn btn--secondary btn--lg" href="#hotel-features">
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
            <DashMock />
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
          id="hotel-features"
          className="section section--tight"
          aria-labelledby="hotel-features-title"
        >
          <div className="section-heading section-heading--center">
            <p className="eyebrow">{t.nav.features}</p>
            <h2 id="hotel-features-title" className="section-heading__title">
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

        <section className="hotel-shot" aria-labelledby="hotel-calendar-title">
          <div className="section-heading section-heading--center">
            <p className="eyebrow">{s.calendar.eyebrow}</p>
            <h2 id="hotel-calendar-title" className="section-heading__title">
              {typo(s.calendar.title)}
            </h2>
            <p className="section-heading__lead">{typo(s.calendar.lead)}</p>
          </div>
          <figure className="hotel-shot__frame">
            {/* Настоящий экран стойки с демо-данными: светлая и тёмная темы (design/reference/current) */}
            <picture>
              <source srcSet="/screens/calendar-week-dark.png" media="(prefers-color-scheme: dark)" />
              <img
                src="/screens/calendar-week-light.png"
                alt={s.calendar.alt}
                width={1440}
                height={1000}
                loading="lazy"
              />
            </picture>
            <figcaption>{s.calendar.note}</figcaption>
          </figure>
        </section>

        <section className="hotel-growth glass" aria-labelledby="hotel-growth-title">
          <div className="hotel-growth__art hotel-growth__art--photo">
            <img src="/photos/hotel.jpg" alt="" loading="lazy" width={1184} height={864} />
            <span className="hotel-growth__float">
              <strong>{s.growth.float.value}</strong>
              {s.growth.float.text}
            </span>
          </div>
          <div>
            <p className="eyebrow">{s.growth.badge}</p>
            <h2 id="hotel-growth-title" className="hotel-growth__title">
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
            secondary: { href: '/calculator/', label: t.calculator.link },
          }}
        />
      </div>
    </div>
  );
}
