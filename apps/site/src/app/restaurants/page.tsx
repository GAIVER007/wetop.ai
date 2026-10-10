import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { typo } from '../../components/typo';
import { getDictionary } from '../../i18n';
import { pageMetadata } from '../../lib/metadata';
import { registerLink } from '../../lib/site';

/*
 * «Для ресторанов» (/restaurants/, макет владельца 10.10.2026): страница направления, на неё ведёт
 * карточка ресторанов на главной. Собрана из блоков §19.5: `.public-intro` с ресторанным `.dash`
 * (план зала и текущие заказы), `.card-grid`, `.steps`, `.faq`, `.cta`. Числа на мини-экранах
 * вымышленные и подписаны (§19.9): цифр клиентов и обещаний результата на странице нет.
 */

const t = getDictionary();
const r = t.restaurants;

export const metadata: Metadata = pageMetadata({
  path: '/restaurants/',
  title: r.metaTitle,
  description: r.description,
});

function register() {
  return registerLink(undefined, 'FOOD_SERVICE').href;
}

function RestaurantDash() {
  const { dash } = r;
  return (
    <figure className="public-intro__figure">
      <div className="dash dash--restaurant" aria-hidden="false">
        <div className="dash__sidebar" aria-hidden="true">
          <span className="dash__brand">
            <span className="dash__logo">W</span> WETOP.AI
          </span>
          <div className="dash__nav">
            {dash.nav.map((name, i) => (
              <span key={name} className={i === 0 ? 'dash__selected' : undefined}>
                {name}
              </span>
            ))}
          </div>
        </div>
        <div className="dash__main">
          <div className="dash__heading">
            <div>
              <h2>{dash.greeting}</h2>
              <p>{dash.date}</p>
            </div>
          </div>
          <div className="dash__metrics">
            {dash.metrics.map((metric) => (
              <div className="dash__metric" key={metric.label}>
                <span className="dash__metric-name">{metric.label}</span>
                <strong>{metric.value}</strong>
                <span className="dash__delta">{metric.delta}</span>
              </div>
            ))}
          </div>
          <div className="dash__columns">
            <div className="dash__arrivals">
              <h3>{dash.planTitle}</h3>
              <div className="dash__tables" aria-hidden="true">
                {dash.tables.map((kind, i) => (
                  <span className="dash__table" data-kind={kind} key={i}>
                    {i + 1}
                  </span>
                ))}
              </div>
              <div className="dash__legend" aria-hidden="true">
                {dash.legend.map((item) => (
                  <span key={item.kind}>
                    <i data-kind={item.kind} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="dash__arrivals">
              <h3>{dash.ordersTitle}</h3>
              {dash.orders.map((row) => (
                <div className="dash__arrival" key={row.table}>
                  <span className="dash__time">{row.time}</span>
                  <strong>{row.table}</strong>
                  <span className="dash__detail">{row.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption>{r.exampleNote}</figcaption>
    </figure>
  );
}

export default function RestaurantsPage() {
  return (
    <div className="page">
      <section className="public-intro" aria-labelledby="restaurants-title">
        <div className="public-intro__container">
          <div className="public-intro__copy">
            <p className="public-intro__eyebrow">{r.eyebrow}</p>
            <h1 id="restaurants-title">
              {r.title} <span className="public-intro__accent">{r.titleAccent}</span>
            </h1>
            <p className="public-intro__lead">{typo(r.lead)}</p>
            <div className="public-intro__actions">
              <a className="public-intro__primary" href={register()} data-auth="register">
                {r.primary}
                <Icon name="arrowRight" size={18} />
              </a>
              <a className="public-intro__secondary" href="#restaurant-features">
                {r.secondary}
                <Icon name="arrowDown" size={18} />
              </a>
            </div>
          </div>
          <RestaurantDash />
        </div>
      </section>
      <div className="container">
        <section className="section section--tight" aria-label={r.facts[0]!.title}>
          <ul className="card-grid card-grid--4">
            {r.facts.map((fact) => (
              <li key={fact.title} className="card card--compact glass">
                <span className="icon-tile icon-tile--sm">
                  <Icon name={fact.icon} />
                </span>
                <div className="card__body">
                  <h3 className="card__title">{typo(fact.title)}</h3>
                  <p className="card__text">{typo(fact.text)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="section" aria-labelledby="restaurant-features" id="restaurant-features">
          <div className="section-heading">
            <p className="eyebrow">{r.featuresEyebrow}</p>
            <h2 className="section-heading__title">{typo(r.featuresTitle)}</h2>
            <p className="section-heading__lead">{typo(r.featuresLead)}</p>
          </div>
          <ul className="card-grid card-grid--3">
            {r.features.map((card) => (
              <li key={card.title} className="card card--compact glass">
                <span className="icon-tile icon-tile--sm">
                  <Icon name={card.icon} />
                </span>
                <div className="card__body">
                  <h3 className="card__title">{typo(card.title)}</h3>
                  <p className="card__text">{typo(card.text)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="section" aria-labelledby="restaurant-modules">
          <div className="section-heading">
            <p className="eyebrow">{r.actionEyebrow}</p>
            <h2 id="restaurant-modules" className="section-heading__title">
              {typo(r.actionTitle)}
            </h2>
            <p className="section-heading__lead">
              {typo(r.actionLead)} {r.exampleNote}
            </p>
          </div>
          <ul className="card-grid card-grid--4">
            {r.modules.map((module) => (
              <li key={module.title} className="card glass">
                <span className="icon-tile icon-tile--sm">
                  <Icon name={module.icon} />
                </span>
                <h3 className="card__title">{typo(module.title)}</h3>
                <div className="dash__arrivals dash__arrivals--card" aria-hidden="true">
                  {module.rows.map((row) => (
                    <div className="dash__arrival" key={row.left}>
                      <strong>{row.left}</strong>
                      {row.right ? <span className="dash__detail">{row.right}</span> : null}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="section section--tight" aria-labelledby="restaurant-reports">
          <div className="section-heading">
            <p className="eyebrow">{r.reportsEyebrow}</p>
            <h2 id="restaurant-reports" className="section-heading__title">
              {typo(r.reportsTitle)}
            </h2>
            <p className="section-heading__lead">{typo(r.reportsLead)}</p>
          </div>
          <ul className="card-grid card-grid--4">
            {r.reports.map((report) => (
              <li key={report.label} className="card card--compact glass">
                <span className="icon-tile icon-tile--sm">
                  <Icon name="chart" />
                </span>
                <div className="card__body">
                  <h3 className="card__title">{typo(report.label)}</h3>
                  <p className="card__text">{typo(report.text)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="section section--tight" aria-labelledby="restaurant-ai">
          <div className="section-heading">
            <p className="eyebrow">{r.aiEyebrow}</p>
            <h2 id="restaurant-ai" className="section-heading__title">
              {typo(r.aiTitle)}
            </h2>
            <p className="section-heading__lead">{typo(r.aiLead)}</p>
          </div>
          <ul className="card-grid card-grid--4">
            {r.ai.map((card) => (
              <li key={card.title} className="card card--compact glass">
                <span className="icon-tile icon-tile--sm">
                  <Icon name={card.icon} />
                </span>
                <div className="card__body">
                  <h3 className="card__title">{typo(card.title)}</h3>
                  <p className="card__text">{typo(card.text)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="section section--tight" aria-labelledby="restaurant-steps">
          <div className="section-heading">
            <p className="eyebrow">{r.stepsEyebrow}</p>
            <h2 id="restaurant-steps" className="section-heading__title">
              {typo(r.stepsTitle)}
            </h2>
          </div>
          <ol className="steps steps--row">
            {r.steps.map((step, i) => (
              <li key={step.title} className="step glass">
                <span className="step__number" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="card__title">{typo(step.title)}</h3>
                <p className="card__text">{typo(step.text)}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="section section--tight faq" aria-labelledby="restaurant-faq">
          <div className="section-heading">
            <p className="eyebrow">{r.faqEyebrow}</p>
            <h2 id="restaurant-faq" className="section-heading__title">
              {typo(r.faqTitle)}
            </h2>
          </div>
          <div className="faq__list">
            {r.faq.map((item) => (
              <details key={item.q}>
                <summary>
                  <span>{typo(item.q)}</span>
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{typo(item.a)}</p>
              </details>
            ))}
          </div>
        </section>
        <div className="cta glass glass--strong">
          <div className="cta__copy">
            <h2 className="cta__title">{typo(r.ctaTitle)}</h2>
            <p className="cta__text">{typo(r.ctaText)}</p>
            <div className="cta__actions">
              <a className="btn btn--primary btn--lg" href={register()} data-auth="register">
                {t.nav.register}
                <Icon name="arrowRight" size={18} />
              </a>
              <Link className="link-arrow" href="/">
                {r.home}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
