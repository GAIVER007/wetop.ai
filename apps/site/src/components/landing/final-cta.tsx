import { getDictionary } from '../../i18n';
import { contactLinks, registerLink } from '../../lib/site';
import { Icon } from '../icon';
import { typo } from '../typo';

/*
 * Финальный призыв (LAND2, ТЗ §10): регистрация и «Связаться с нами» на почту из настроек.
 * Чисел клиентов и обещаний результата нет (DESIGN.md §19.9).
 */
export function FinalCta() {
  const t = getDictionary();
  const email = contactLinks().find((contact) => contact.kind === 'email');
  return (
    <section id="get-started" className="section section--tight" aria-labelledby="final-title">
      <div className="container">
        <div className="cta glass glass--strong final-cta">
          <div className="cta__copy">
            <h2 className="cta__title" id="final-title">
              {typo(t.final.title)}
            </h2>
            <p className="cta__text">{typo(t.final.text)}</p>
            <div className="cta__actions">
              <a className="btn btn--primary btn--lg" href={registerLink().href} data-auth="register">
                {t.hero.primary}
                <Icon name="arrowRight" size={18} />
              </a>
              {email ? (
                <a className="btn btn--secondary btn--lg" href={email.href}>
                  {t.final.contact}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
