import { ProductPreview } from '../../../components/landing/product-preview';
import type { Metadata } from 'next';
import { Icon } from '../../../components/icon';
import { LandingFinal } from '../../../components/landing/landing-final';
import { MarketingBlock } from '../../../components/landing/marketing-block';
import { SubtypeLinks } from '../../../components/landing/subtype-links';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { typo } from '../../../components/typo';
import { getDictionary } from '../../../i18n';
import { pageMetadata } from '../../../lib/metadata';
import { registerLink } from '../../../lib/site';

/*
 * Лендинг «Для салонов красоты» (ТЗ владельца 10.10.2026, план plans/salon-landing-2026-10-10.md):
 * герой с мокапом записей, полоса фактов, восемь возможностей, блок роста, вопросы и призыв.
 * Текст только из продукта (§19.9): чисел клиентов, кейсов и тарифов из макета здесь нет
 * (Q-SALON-1, Q-SALON-2); «14 дней» макета снято, условий trial нет (ADR-147); фото заменены
 * мокапом и рисунком на SVG, появятся свои фото — меняются мокап героя и SalonArt (Q-SALON-3).
 */
export const metadata: Metadata = pageMetadata({
  path: '/for/salons/',
  image: '/og/salon.jpg',
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
        <Breadcrumbs
          label={t.a11y.breadcrumbs}
          trail={[
            { name: t.a11y.crumbHome, path: '/' },
            { name: t.salon.badge, path: '/for/salons/' },
          ]}
        />
        <div className="landing">
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
              <ProductPreview vertical="BEAUTY" label={s.mock.label} />
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
              <span className="salon-growth__photo">
                {/* Фото сгенерировано через KIE по решению владельца 10.10.2026: тёплая палитра макета */}
                <img src="/photos/salon-warm.jpg" alt="" loading="lazy" width={1184} height={864} />
              </span>
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

          {/* Настоящий экран продукта: день салона с демо-данными, светлая и тёмная темы */}
          <section className="hotel-shot" aria-labelledby="salon-shot-title">
            <div className="section-heading section-heading--center">
              <p className="eyebrow">{t.salon.shot.eyebrow}</p>
              <h2 id="salon-shot-title" className="section-heading__title">
                {typo(t.salon.shot.title)}
              </h2>
              <p className="section-heading__lead">{typo(t.salon.shot.lead)}</p>
            </div>
            <figure className="hotel-shot__frame">
              <picture>
                <source srcSet="/screens/salon-day-dark.png" media="(prefers-color-scheme: dark)" />
                <img
                  src="/screens/salon-day-light.png"
                  alt={t.salon.shot.alt}
                  width={1440}
                  height={1000}
                  loading="lazy"
                />
              </picture>
              <figcaption>{t.salon.shot.note}</figcaption>
            </figure>
          </section>

          <SubtypeLinks direction="salons" title={t.segments.typesTitle.salons} />

          <MarketingBlock
            id="marketing"
            copy={t.marketing.salon}
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
              photo: { src: '/photos/reception.jpg', alt: '' },
            }}
          />
        </div>
      </div>
    </div>
  );
}
