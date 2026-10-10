import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { typo } from '../../components/typo';
import { getDictionary } from '../../i18n';
import { pageMetadata } from '../../lib/metadata';
import { registerLink } from '../../lib/site';

/*
 * «Для ресторанов» (/restaurants/, макет владельца 10.10.2026, вторая итерация «скопируй исходник»):
 * hero с ноутбуком (внутри ресторанный `.dash`) и телефоном, рукописные пометки, полоса показателей,
 * девять процессов, мини-экраны разделов, «Больше, чем просто программа», карточки отчётов с графиками,
 * AI-плитки, шаги рядом с вопросами и финальная плита. Корневой блок `.restl` (DESIGN.md §19.5).
 * Чисел клиентов, цен и обещаний trial нет (§19.9, ADR-147): отличия от макета названы в ADR-162.
 */

const t = getDictionary();
const r = t.restaurants;

export const metadata: Metadata = pageMetadata({
  path: '/restaurants/',
  title: r.metaTitle,
  description: r.description,
});

const register = () => registerLink(undefined, 'FOOD_SERVICE').href;

function RestaurantDash() {
  const { dash } = r;
  return (
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
  );
}

function PhoneMock() {
  const { phone } = r;
  return (
    <div className="restl__phone" aria-hidden="true">
      <span className="restl__phone-brand">
        <span className="dash__logo">W</span> WETOP.AI
      </span>
      <p className="restl__phone-greeting">{phone.greeting}</p>
      <div className="restl__phone-revenue">
        <span>{phone.revenueLabel}</span>
        <strong>{phone.revenue}</strong>
        <em>{phone.delta}</em>
      </div>
      <div className="restl__phone-tiles">
        {phone.tiles.map((tile) => (
          <span key={tile}>{tile}</span>
        ))}
      </div>
    </div>
  );
}

/** Мини-экран раздела: вид по `kind`, числа вымышленные (подпись у заголовка секции) */
function Shot({ shot }: { shot: (typeof r.shots)[number] }) {
  const initials = (name: string) => name.slice(0, 1);
  return (
    <li className="restl__shot card glass" data-kind={shot.kind}>
      <h3 className="restl__shot-title">{typo(shot.title)}</h3>
      {shot.kind === 'floor' && (
        <div className="restl__shot-floor" aria-hidden="true">
          {(['busy', 'free', 'reserved', 'free', 'cleaning', 'busy', 'free', 'reserved'] as const).map(
            (kind, i) => (
              <span className="dash__table" data-kind={kind} key={i}>
                {i + 1}
              </span>
            ),
          )}
        </div>
      )}
      {shot.kind === 'kds' && (
        <div className="restl__shot-kds" aria-hidden="true">
          <i data-tone="blue" />
          <i data-tone="orange" />
          <i data-tone="green" />
        </div>
      )}
      {(shot.kind === 'payroll' || shot.kind === 'analytics') && (
        <div className="restl__shot-bars" aria-hidden="true">
          {[32, 48, 40, 62, 54, 78, 92].map((height, i) => (
            // slop-allow: высота столбика из данных примера
            <i key={i} style={{ height: `${height}%` }} data-tone={shot.kind === 'payroll' ? 'blue' : 'purple'} />
          ))}
        </div>
      )}
      <div className="restl__shot-rows">
        {shot.rows.map((row) => (
          <div className="restl__shot-row" key={row.left}>
            {(shot.kind === 'staff' || shot.kind === 'clients') && (
              <span className="restl__avatar" aria-hidden="true">
                {initials(row.left)}
              </span>
            )}
            {shot.kind === 'menu' && <span className="restl__thumb" aria-hidden="true" />}
            <strong>{row.left}</strong>
            {row.right ? <span>{row.right}</span> : null}
          </div>
        ))}
      </div>
    </li>
  );
}

function ResultChart({ chart, tone }: { chart: 'line' | 'bars'; tone: string }) {
  if (chart === 'bars')
    return (
      <div className="restl__shot-bars restl__result-chart" aria-hidden="true">
        {[30, 44, 38, 58, 52, 74, 88].map((height, i) => (
          // slop-allow: высота столбика из данных примера
          <i key={i} style={{ height: `${height}%` }} data-tone={tone} />
        ))}
      </div>
    );
  return (
    <svg className="restl__result-line" viewBox="0 0 120 44" aria-hidden="true" data-tone={tone}>
      <polyline
        points="2,38 22,32 42,34 62,22 82,24 102,12 118,6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function RestaurantsPage() {
  return (
    <div className="page restl">
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
              <a className="public-intro__secondary" href="#restaurant-shots">
                {r.demo}
                <Icon name="arrowDown" size={18} />
              </a>
            </div>
            <ul className="restl__chips" aria-label={r.eyebrow}>
              {r.chips.map((chip) => (
                <li key={chip}>
                  <Icon name="check" size={15} />
                  {chip}
                </li>
              ))}
            </ul>
            <span className="restl__note restl__note--left" aria-hidden="true">
              {r.noteLeft}
            </span>
          </div>
          <figure className="public-intro__figure restl__scene">
            <div className="restl__laptop">
              <RestaurantDash />
            </div>
            <PhoneMock />
            <span className="restl__note restl__note--right" aria-hidden="true">
              {r.noteRight}
            </span>
            <figcaption>{r.exampleNote}</figcaption>
          </figure>
        </div>
      </section>
      <div className="container">
        <ul className="restl__band" aria-label={r.processesTitle}>
          {r.band.map((item) => (
            <li key={item.value}>
              <span className="icon-tile icon-tile--sm">
                <Icon name={item.icon} />
              </span>
              <div>
                <strong>{item.value}</strong>
                <p>{typo(item.caption)}</p>
              </div>
            </li>
          ))}
        </ul>
        <section className="section section--tight" aria-labelledby="restaurant-features" id="restaurant-features">
          <div className="section-heading section-heading--row">
            <div>
              <p className="eyebrow">{r.processesEyebrow}</p>
              <h2 id="restaurant-features" className="section-heading__title">
                {typo(r.processesTitle)}
              </h2>
              <p className="section-heading__lead">{typo(r.processesLead)}</p>
            </div>
            <a className="link-arrow" href="/#features">
              {r.processesAll}
            </a>
          </div>
          <ul className="restl__processes">
            {r.processes.map((card) => (
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
        <section className="section" aria-labelledby="restaurant-shots" id="restaurant-shots">
          <div className="section-heading">
            <p className="eyebrow">{r.actionEyebrow}</p>
            <h2 className="section-heading__title">{typo(r.actionTitle)}</h2>
            <p className="section-heading__lead">
              {typo(r.actionLead)} {r.exampleNote}
            </p>
          </div>
          <ul className="restl__shots">
            {r.shots.map((shot) => (
              <Shot shot={shot} key={shot.title} />
            ))}
          </ul>
        </section>
        <section className="section section--tight" aria-labelledby="restaurant-more">
          <div className="restl__split">
            <div>
              <p className="eyebrow">{r.moreEyebrow}</p>
              <h2 id="restaurant-more" className="section-heading__title">
                {typo(r.moreTitle)}
              </h2>
              <p className="section-heading__lead">{typo(r.moreLead)}</p>
            </div>
            <ul className="restl__more">
              {r.more.map((item) => (
                <li key={item.title}>
                  <span className="icon-tile icon-tile--sm">
                    <Icon name={item.icon} />
                  </span>
                  <div>
                    <h3>{typo(item.title)}</h3>
                    <p>{typo(item.text)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="section section--tight" aria-labelledby="restaurant-results">
          <div className="restl__split">
            <div>
              <p className="eyebrow">{r.resultsEyebrow}</p>
              <h2 id="restaurant-results" className="section-heading__title">
                {typo(r.resultsTitle)}
              </h2>
              <p className="section-heading__lead">{typo(r.resultsLead)}</p>
            </div>
            <ul className="restl__results">
              {r.results.map((item) => (
                <li key={item.label} className="card glass">
                  <strong>{typo(item.label)}</strong>
                  <ResultChart chart={item.chart} tone={item.tone} />
                  <p>{typo(item.text)}</p>
                </li>
              ))}
            </ul>
          </div>
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
                <span className="icon-tile icon-tile--sm restl__tile" data-tone={card.tone}>
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
          <div className="restl__start">
            <div>
              <p className="eyebrow">{r.stepsEyebrow}</p>
              <h2 id="restaurant-steps" className="section-heading__title">
                {typo(r.stepsTitle)}
              </h2>
              <ol className="restl__steps">
                {r.steps.map((step, i) => (
                  <li key={step.title}>
                    <span className="step__number" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div>
                      <h3>{typo(step.title)}</h3>
                      <p>{typo(step.text)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="faq">
              <p className="eyebrow">{r.faqEyebrow}</p>
              <h2 className="section-heading__title">{typo(r.faqTitle)}</h2>
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
            </div>
          </div>
        </section>
        <div className="cta glass glass--strong restl__cta">
          <div className="cta__copy">
            <h2 className="cta__title">{typo(r.ctaTitle)}</h2>
            <p className="cta__text">{typo(r.ctaText)}</p>
            <div className="cta__actions">
              <a className="btn btn--primary btn--lg" href={register()} data-auth="register">
                {t.nav.register}
                <Icon name="arrowRight" size={18} />
              </a>
              <a className="btn btn--secondary btn--lg" href="#restaurant-shots">
                {r.demo}
              </a>
              <Link className="link-arrow" href="/">
                {r.home}
              </Link>
            </div>
            <ul className="tag-list">
              {r.ctaChips.map((chip) => (
                <li key={chip} className="tag">
                  {chip}
                </li>
              ))}
            </ul>
            <span className="restl__note restl__note--cta" aria-hidden="true">
              {r.ctaNote}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
