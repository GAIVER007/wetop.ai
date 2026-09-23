import { getDictionary } from '../../i18n';
import { contactLinks, hasTrialHref, loginLink, siteUrl, trialLink } from '../../lib/site';
import { siteConfig } from '../../site.config';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Как начать»: три шага и большая стеклянная плита призыва — заголовок, контакты, вход в стойку.
 * Кнопка заявки здесь — только когда владелец дал ссылку: без неё кнопка вела бы на этот же раздел.
 * Контакты — только заполненные в site.config.ts; пустые поля просто не показываются.
 *
 * Заголовков третьего уровня в разделе ровно четыре — три шага и призыв: на это смотрит
 * tests/site/landing.spec.ts. Подписи панелей — обычные абзацы, не заголовки.
 */
export function Start() {
  const t = getDictionary();
  const contacts = contactLinks();
  const showTrial = hasTrialHref();
  const city = siteConfig.company.city.trim();
  const host = new URL(siteUrl()).host;
  const login = loginLink();
  const appHost = new URL(login.href).host;

  return (
    <section id="start" className="section" aria-labelledby="start-title">
      <div className="container">
        <SectionHeading
          id="start-title"
          eyebrow={t.start.eyebrow}
          title={t.start.title}
          lead={t.start.lead}
        />
        <ol className="steps">
          {t.start.steps.map((step, index) => (
            <li key={step.title} className="step glass">
              <span className="step__number" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="card__title">{typo(step.title)}</h3>
              <p className="card__text">{typo(step.text)}</p>
            </li>
          ))}
        </ol>

        <div className="cta glass glass--strong">
          <div className="cta__copy">
            <h3 className="cta__title">{typo(t.start.ctaTitle)}</h3>
            <p className="cta__text">{typo(t.start.ctaText)}</p>
            {showTrial ? (
              <div className="cta__actions">
                <a className="btn btn--primary btn--lg" href={trialLink().href}>
                  {t.nav.trial}
                  <Icon name="arrowRight" size={18} />
                </a>
              </div>
            ) : null}
          </div>

          <div className="contact-panel glass glass--quiet">
            <p className="contact-panel__label">{t.start.contactsLabel}</p>
            <ul className="contact-list">
              {contacts.map((contact) => (
                <li key={contact.href}>
                  <Icon name={contact.kind === 'email' ? 'mail' : 'phone'} size={18} />
                  <a href={contact.href}>{contact.label}</a>
                </li>
              ))}
              {city ? (
                <li>
                  <Icon name="location" size={18} />
                  <span>{city}</span>
                </li>
              ) : null}
              <li>
                <Icon name="globe" size={18} />
                <span>{host}</span>
              </li>
            </ul>
          </div>

          <div className="connect glass glass--quiet">
            <p className="connect__label">{t.start.connectLabel}</p>
            <ConnectGem />
            <p className="connect__text">{typo(t.start.connectText)}</p>
            <a className="connect__link" href={login.href}>
              {appHost}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Стеклянная фигура вместо QR-кода со снимков направления: ссылку видно словами и её можно проверить. */
function ConnectGem() {
  return (
    <svg className="connect__gem" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <path className="connect__gem-face" d="M48 10l30 18v40L48 86 18 68V28z" />
      <path className="connect__gem-face" d="M48 10v76M18 28l30 18 30-18M18 68l30-18 30 18" />
      <circle className="connect__gem-core" cx="48" cy="48" r="13" />
    </svg>
  );
}
