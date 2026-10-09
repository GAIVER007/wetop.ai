import { getDictionary } from '../../i18n';
import { registerLink } from '../../lib/site';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/* «Как начать» (LAND2, ТЗ §9): четыре шага и одна кнопка регистрации под ними. */
export function Start() {
  const t = getDictionary();
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
        <div className="start__cta">
          <a className="btn btn--primary btn--lg" href={registerLink().href} data-auth="register">
            {t.hero.primary}
            <Icon name="arrowRight" size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
