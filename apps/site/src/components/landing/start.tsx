import { getDictionary } from '../../i18n';
import { contactLinks, hasTrialHref, trialLink } from '../../lib/site';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Как начать». Кнопка заявки здесь — только когда владелец дал ссылку: без неё кнопка вела бы на этот же раздел.
 * Контакты — только заполненные в site.config.ts; если нет ничего, остаётся нейтральный текст.
 */
export function Start() {
  const t = getDictionary();
  const contacts = contactLinks();
  const showTrial = hasTrialHref();

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
            <li key={step.title} className="step">
              <span className="step__number" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="card__title">{typo(step.title)}</h3>
              <p className="card__text">{typo(step.text)}</p>
            </li>
          ))}
        </ol>

        <div className="cta">
          <div className="cta__copy">
            <h3 className="cta__title">{typo(t.start.ctaTitle)}</h3>
            <p className="cta__text">{typo(t.start.ctaText)}</p>
          </div>
          {showTrial || contacts.length > 0 ? (
            <div className="cta__actions">
              {showTrial ? (
                <a className="btn btn--inverse btn--lg" href={trialLink().href}>
                  {t.nav.trial}
                  <Icon name="arrowRight" size={18} />
                </a>
              ) : null}
              {contacts.length > 0 ? (
                <ul className="cta__contacts">
                  {contacts.map((contact) => (
                    <li key={contact.href}>
                      <a href={contact.href}>
                        <Icon name={contact.kind === 'email' ? 'mail' : 'phone'} size={18} />
                        {contact.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
