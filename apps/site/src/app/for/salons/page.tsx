import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '../../../components/icon';
import { typo } from '../../../components/typo';
import { getDictionary } from '../../../i18n';
import { pageMetadata } from '../../../lib/metadata';
import { registerLink } from '../../../lib/site';

/*
 * Лендинг «Для салонов красоты» (ТЗ владельца 10.10.2026, план plans/salon-landing-2026-10-10.md):
 * герой с мокапом записей, полоса фактов, восемь возможностей, блок роста, вопросы и призыв.
 * Текст только из продукта (§19.9): чисел клиентов, кейсов и тарифов из макета здесь нет
 * (Q-SALON-1, Q-SALON-2); «14 дней» макета заменено на «7 дней» (ADR-098); фото заменены
 * мокапом и рисунком на SVG, появятся свои фото — меняются мокап героя и SalonArt (Q-SALON-3).
 */
export const metadata: Metadata = pageMetadata({
  path: '/for/salons/',
  title: getDictionary().salon.metaTitle,
  description: getDictionary().salon.description,
});

export default function SalonLandingPage() {
  const t = getDictionary();
  const s = t.salon;
  const register = registerLink(undefined, 'BEAUTY').href;
  return (
    <div className="page salon-page">
      <div className="container">
        <section className="salon-hero" aria-labelledby="salon-title">
          <div>
            <p className="salon-hero__badge">{s.badge}</p>
            <h1 id="salon-title" className="page-header__title">
              {typo(s.title)}
            </h1>
            <p className="page-header__lead">{typo(s.lead)}</p>
            <div className="salon-hero__actions">
              <a className="btn btn--primary btn--lg" href={register} data-auth="register">
                {s.primary}
                <Icon name="arrowRight" size={18} />
              </a>
              <a className="btn btn--secondary btn--lg" href="#salon-features">
                {s.secondary}
                <Icon name="arrowDown" size={18} />
              </a>
            </div>
            <ul className="salon-hero__chips">
              {s.chips.map((chip) => (
                <li key={chip}>
                  <Icon name="check" size={15} />
                  {chip}
                </li>
              ))}
            </ul>
          </div>
          <figure className="salon-hero__figure">
            <div className="salon-hero__mock">
              <div className="salon-hero__mock-head">
                <div>
                  <strong>{s.mock.title}</strong>
                  <span className="salon-hero__mock-date">{s.mock.date}</span>
                </div>
                <div className="salon-hero__mock-summary">
                  {s.mock.summary.map((item) => (
                    <span key={item.name}>
                      <strong>{item.value}</strong> {item.name}
                    </span>
                  ))}
                </div>
              </div>
              {s.mock.rows.map((row) => (
                <div className="salon-hero__mock-row" key={row.time}>
                  <span className="salon-hero__mock-time">{row.time}</span>
                  <span className="salon-hero__mock-client">{row.client}</span>
                  <span className="salon-hero__mock-service">{row.service}</span>
                  <span className="salon-hero__mock-master">{row.master}</span>
                </div>
              ))}
            </div>
            <figcaption>{s.mock.label}</figcaption>
          </figure>
        </section>

        <ul className="salon-facts">
          {s.facts.map((fact) => (
            <li key={fact.value} className="salon-facts__item">
              <strong>{fact.value}</strong>
              <span>{typo(fact.text)}</span>
            </li>
          ))}
        </ul>

        <section
          id="salon-features"
          className="section section--tight"
          aria-labelledby="salon-features-title"
        >
          <div className="section-heading section-heading--center">
            <p className="eyebrow">{t.nav.features}</p>
            <h2 id="salon-features-title" className="section-heading__title">
              {typo(s.featuresTitle)}
            </h2>
            <p className="section-heading__lead">{typo(s.featuresLead)}</p>
          </div>
          <ul className="card-grid card-grid--4">
            {s.features.map((card) => (
              <li key={card.title} className="card">
                <span className="icon-tile">
                  <Icon name={card.icon} />
                </span>
                <h3 className="card__title">{typo(card.title)}</h3>
                <p className="card__text">{typo(card.text)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="salon-growth" aria-labelledby="salon-growth-title">
          <div className="salon-growth__art">
            <SalonArt />
            <span className="salon-growth__float">
              <strong>{s.growth.float.value}</strong>
              {s.growth.float.text}
            </span>
          </div>
          <div>
            <p className="salon-hero__badge">{s.growth.badge}</p>
            <h2 id="salon-growth-title" className="salon-growth__title">
              {typo(s.growth.title)}
            </h2>
            <p className="salon-growth__text">{typo(s.growth.text)}</p>
            <ul className="salon-growth__points">
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

        <section className="section section--tight faq" aria-labelledby="salon-faq-title">
          <div className="faq__layout">
            <div className="section-heading">
              <p className="eyebrow">{t.faq.eyebrow}</p>
              <h2 id="salon-faq-title" className="section-heading__title">
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

        <div className="cta salon-cta">
          <div className="cta__copy">
            <h2 className="cta__title">{typo(s.ctaTitle)}</h2>
            <p className="cta__text">{typo(s.ctaText)}</p>
            <div className="cta__actions">
              <a className="btn btn--primary btn--lg" href={register} data-auth="register">
                {t.nav.register}
                <Icon name="arrowRight" size={18} />
              </a>
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

/** Интерьер салона со снимка — рисунок на SVG в фирменных тонах (§19.9: вместо фото и стоков). */
function SalonArt() {
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
        {/* зеркало с подсветкой */}
        <rect x="28" y="20" width="64" height="88" rx="10" />
        <circle cx="42" cy="34" r="3" strokeWidth="2" opacity="0.6" />
        <circle cx="60" cy="28" r="3" strokeWidth="2" opacity="0.6" />
        <circle cx="78" cy="34" r="3" strokeWidth="2" opacity="0.6" />
        {/* столик под зеркалом */}
        <path d="M16 124h88M24 124v52M96 124v52" />
        <path d="M40 124v-8h24v8" strokeWidth="2" opacity="0.6" />
        {/* кресло */}
        <path d="M150 84a22 22 0 0 1 44 0v28h-44z" />
        <path d="M144 112h56v14h-56z" />
        <path d="M172 126v30M154 176h36" />
        <path d="M150 96h-8M202 96h-6" strokeWidth="2" opacity="0.6" />
        {/* растение */}
        <path d="M222 176v-28" strokeWidth="2" />
        <path d="M222 152c-8-4-12-12-10-20 8 2 12 10 10 20Z" strokeWidth="2" opacity="0.6" />
        <path d="M222 156c8-4 12-12 10-20-8 2-12 10-10 20Z" strokeWidth="2" opacity="0.6" />
        <path d="M214 176h16" strokeWidth="2" />
        <path d="M16 176h208" opacity="0.4" strokeWidth="2" />
      </svg>
    </span>
  );
}
