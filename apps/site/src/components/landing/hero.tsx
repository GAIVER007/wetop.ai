import { getDictionary } from '../../i18n';
import { registerLink } from '../../lib/site';
import { Icon } from '../icon';
import { VerticalStatus } from './vertical-status';

export function Hero() {
  const t = getDictionary();
  return (
    <section id="product" className="public-intro" aria-labelledby="hero-title">
      <div className="public-intro__container">
        <div className="public-intro__copy">
          <p className="public-intro__eyebrow">{t.hero.status}</p>
          <h1 id="hero-title">
            {t.hero.title} <br />
            {t.hero.titleAccent}
          </h1>
          <p className="public-intro__lead">{t.hero.lead}</p>
          <div className="public-intro__actions">
            <a className="public-intro__primary" href={registerLink().href} data-auth="register">
              {t.nav.register}
              <Icon name="arrowRight" size={18} />
            </a>
            <a className="public-intro__secondary" href="#audience">
              {t.hero.secondary}
              <Icon name="arrowDown" size={18} />
            </a>
          </div>
          <ul className="public-intro__availability" aria-label={t.intro.availability}>
            {t.intro.cards.map((card) => (
              <li key={card.id}>
                <span>{card.name}</span>
                <VerticalStatus id={card.id} />
              </li>
            ))}
          </ul>
          <p className="public-intro__note">{t.hero.note}</p>
        </div>
        <figure className="public-intro__figure">
          <div className="today-preview">
            <div className="today-preview__sidebar" aria-hidden="true">
              <span className="today-preview__brand">WETOP.AI</span>
              <div className="today-preview__nav">
                {t.intro.previewNav.map((name, i) => (
                  <span key={name} className={i === 0 ? 'today-preview__selected' : undefined}>
                    {name}
                  </span>
                ))}
              </div>
              <span className="today-preview__workspace">{t.intro.previewWorkspace}</span>
            </div>
            <div className="today-preview__main">
              <div className="today-preview__heading">
                <div>
                  <p>{t.intro.previewContext}</p>
                  <h2>{t.intro.previewTitle}</h2>
                </div>
                <span className="today-preview__date">{t.intro.previewDate}</span>
              </div>
              <div className="today-preview__columns">
                <div className="today-preview__events">
                  <h3>{t.intro.eventsTitle}</h3>
                  {t.intro.events.map((event) => (
                    <div className="today-preview__event" key={event.title}>
                      <span className="today-preview__time">{event.time}</span>
                      <div>
                        <strong>{event.title}</strong>
                        <p>{event.detail}</p>
                      </div>
                      <span className="today-preview__status">{event.status}</span>
                    </div>
                  ))}
                </div>
                <div className="today-preview__attention">
                  <h3>{t.intro.attentionTitle}</h3>
                  {t.intro.attention.map((item) => (
                    <div key={item.title}>
                      <span className="today-preview__dot" aria-hidden="true" />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <figcaption>{t.intro.previewLabel}</figcaption>
        </figure>
      </div>
    </section>
  );
}
