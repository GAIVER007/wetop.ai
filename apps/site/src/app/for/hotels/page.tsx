import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '../../../components/icon';
import { DashMock } from '../../../components/landing/dash-mock';
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

        <section className="hotel-growth glass" aria-labelledby="hotel-growth-title">
          <div className="hotel-growth__art">
            <HotelArt />
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

        <section className="section section--tight faq" aria-labelledby="hotel-faq-title">
          <div className="faq__layout">
            <div className="section-heading">
              <p className="eyebrow">{t.faq.eyebrow}</p>
              <h2 id="hotel-faq-title" className="section-heading__title">
                {s.faqTitle}
              </h2>
            </div>
            <div className="faq__list">
              {s.faq.map((item) => (
                <details key={item.q}>
                  <summary>
                    <span>{typo(item.q)}</span>
                    <span aria-hidden="true">+</span>
                  </summary>
                  <p>{typo(item.a)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <div className="cta glass glass--strong">
          <div className="cta__copy">
            <h2 className="cta__title">{typo(s.ctaTitle)}</h2>
            <p className="cta__text">{typo(s.ctaText)}</p>
            <div className="cta__actions">
              <a className="btn btn--primary btn--lg" href={register} data-auth="register">
                {t.nav.register}
                <Icon name="arrowRight" size={18} />
              </a>
              <Link className="link-arrow" href="/calculator/">
                {t.calculator.link}
              </Link>
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

/** Стойка и кровать: рисунок на SVG в фирменных тонах (§19.9: вместо фото и стоков). */
function HotelArt() {
  return (
    <span aria-hidden="true">
      <svg
        viewBox="0 0 240 200"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* стойка ресепшн с колокольчиком */}
        <path d="M18 108h92v68H18z" />
        <path d="M18 108l10-16h72l10 16" opacity="0.6" strokeWidth="2" />
        <path d="M54 100a10 10 0 0 1 20 0" strokeWidth="2" />
        <path d="M50 100h28M62 86v-4" strokeWidth="2" />
        {/* ключ на стойке */}
        <circle cx="94" cy="128" r="5" strokeWidth="2" opacity="0.6" />
        <path d="M94 133v12m0-4h5" strokeWidth="2" opacity="0.6" />
        {/* кровать */}
        <path d="M134 128V96m0 32h88m-88 0v48m88-48v48" />
        <path d="M134 112h16a10 10 0 0 1 10 10v6" strokeWidth="2" />
        <rect x="140" y="100" width="18" height="8" rx="4" strokeWidth="2" />
        <path d="M160 128h62a0 0 0 0 1 0 0v0a12 12 0 0 0-12-12h-50Z" strokeWidth="2" opacity="0.6" />
        {/* звезда над кроватью */}
        <path d="M186 48l4 8 8 1-6 6 2 9-8-5-8 5 2-9-6-6 8-1z" strokeWidth="2" opacity="0.5" />
        <path d="M10 176h220" opacity="0.4" strokeWidth="2" />
      </svg>
    </span>
  );
}
