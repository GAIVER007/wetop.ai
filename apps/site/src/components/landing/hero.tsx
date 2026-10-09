import { getDictionary } from '../../i18n';
import { registerLink } from '../../lib/site';
import { Icon } from '../icon';

/*
 * Первый экран по снимку владельца (LAND2 v2, 09.10.2026): заголовок в три строки, две кнопки,
 * чипы направлений и дашборд-мокап справа (сайдбар, четыре метрики, ближайшие заезды, график недели).
 * Мокап — чистый HTML/CSS с вымышленными данными и подписью примера; интерактива в нём нет (§19.9).
 */
export function Hero() {
  const t = getDictionary();
  const { dash } = t.hero;
  const max = Math.max(...dash.chartValues);
  const peak = dash.chartValues.indexOf(max);
  return (
    <section id="product" className="public-intro" aria-labelledby="hero-title">
      <div className="public-intro__container">
        <div className="public-intro__copy">
          <p className="public-intro__eyebrow">{t.hero.status}</p>
          <h1 id="hero-title">
            {t.hero.title} <span className="public-intro__accent">{t.hero.titleAccent}</span>
          </h1>
          <p className="public-intro__lead">{t.hero.lead}</p>
          <div className="public-intro__actions">
            <a className="public-intro__primary" href={registerLink().href} data-auth="register">
              {t.hero.primary}
              <Icon name="arrowRight" size={18} />
            </a>
            <a className="public-intro__secondary" href="#features">
              {t.hero.secondary}
              <Icon name="arrowDown" size={18} />
            </a>
          </div>
          <ul className="public-intro__availability" aria-label={t.intro.availability}>
            {t.intro.cards.map((card) => (
              <li key={card.id}>
                <Icon name={card.icon} size={16} />
                <span>{card.title}</span>
              </li>
            ))}
          </ul>
          <p className="public-intro__note">{t.hero.note}</p>
        </div>
        <figure className="public-intro__figure">
          <div className="dash" aria-hidden="false">
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
                  <h2>{dash.title}</h2>
                  <p>{dash.date}</p>
                </div>
                <span className="dash__scope">{dash.scope}</span>
              </div>
              <div className="dash__metrics">
                {dash.metrics.map((metric) => (
                  <div className="dash__metric" key={metric.name}>
                    <span className="dash__metric-name">{metric.name}</span>
                    <strong>{metric.value}</strong>
                    <span className="dash__delta">{metric.delta}</span>
                  </div>
                ))}
              </div>
              <div className="dash__columns">
                <div className="dash__arrivals">
                  <h3>{dash.arrivalsTitle}</h3>
                  {dash.arrivals.map((row) => (
                    <div className="dash__arrival" key={row.name}>
                      <span className="dash__time">{row.time}</span>
                      <strong>{row.name}</strong>
                      <span className="dash__detail">{row.detail}</span>
                      <span className="dash__guests">{row.guests}</span>
                    </div>
                  ))}
                  <span className="dash__more">{dash.showAll}</span>
                </div>
                <div className="dash__chart">
                  <h3>{dash.chartTitle}</h3>
                  <div className="dash__bars" role="img" aria-label={dash.chartTitle}>
                    {dash.chartValues.map((value, i) => (
                      <div className="dash__bar-col" key={dash.chartDays[i]}>
                        {i === peak ? <span className="dash__bar-tip">{dash.chartPeak}</span> : null}
                        <span
                          className={`dash__bar${i === peak ? ' dash__bar--peak' : ''}`}
                          // slop-allow: inline-style высота столбика считается из данных графика
                          style={{ height: `${value}%` }}
                        />
                        <span className="dash__day">{dash.chartDays[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <span className="public-intro__annotation" aria-hidden="true">
            <svg viewBox="0 0 60 40" className="public-intro__annotation-arrow">
              <path d="M52 4C38 10 24 24 10 34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M18 32l-9 3 2-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t.hero.annotation}
          </span>
          <figcaption>{dash.label}</figcaption>
        </figure>
      </div>
    </section>
  );
}
